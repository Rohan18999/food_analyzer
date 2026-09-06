import { getTesseractWorker } from "./tesseractWorker.js";
import { preprocessPrimary, preprocessThresholdVariant } from "./imagePreprocessor.js";
import { normalizeOcrText } from "./textNormalizer.js";
import { parseProductName } from "./parsers/productNameParser.js";
import { parseIngredients } from "./parsers/ingredientsParser.js";
import { parseNutritionFacts } from "./parsers/nutritionParser.js";
import { logger } from "../../utils/logger.js";

const REQUIRED_FIELDS = [
  "sodium",
  "protein",
  "totalSugars",
  "saturatedFat",
  "dietaryFiber",
];
const TESSERACT_CONFIG = {
  preserve_interword_spaces: "1",
};

/**
 * Run full OCR pipeline: preprocess → Tesseract → parse → structured JSON.
 * @param {string} imagePath
 */
export async function extractProductFromImage(imagePath) {
  const start = Date.now();

  let primaryVariant;
  try {
    primaryVariant = await preprocessPrimary(imagePath);
  } catch (error) {
    logger.error("Image preprocessing failed", { error: error.message });
    return {
      success: false,
      error: "INVALID_IMAGE",
      message: "Failed to process image",
      durationMs: Date.now() - start,
    };
  }

  let bestExtraction = null;
  let bestDurationMs = 0;
  try {
    // Speed-optimized: single primary variant (1024px) covers ~85% cases.
    // Threshold variant is generated lazily only if confidence is low - saves 600ms preprocessing
    // and avoids wasting CPU on Render free tier. Per-variant 20s, global 35s.
    const worker = await getTesseractWorker();

    const runVariant = async (variant) => {
      try {
        await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: '1' });
        const ocrPromise = worker.recognize(variant.buffer);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OCR variant timeout after 20s')), 20000)
        );
        const result = await Promise.race([ocrPromise, timeoutPromise]);
        const candidate = buildExtraction(result.data);
        const candidateScore = scoreExtractionCandidate(candidate);
        logger.info("OCR variant complete", {
          variant: variant.name,
          psm: 6,
          score: candidateScore,
          confidence: candidate.extractionConfidence,
        });
        return { candidate, candidateScore, variant };
      } catch (err) {
        logger.warn("OCR variant failed", { variant: variant.name, error: err.message });
        return null;
      }
    };

    const ocrWithGlobalTimeout = async () => {
      const first = await runVariant({ ...primaryVariant, pageSegMode: "6" });
      // Early exit for ~85% of images - saves 2-4s on threshold generation + OCR
      if (first && first.candidateScore >= 30 && first.candidate.extractionConfidence >= 0.45) {
        bestExtraction = { ...first.candidate, ocrVariant: `${first.variant.name}:psm6`, candidateScore: first.candidateScore };
        bestDurationMs = Date.now() - start;
        logger.info("OCR early exit — sufficient confidence on primary", { variant: bestExtraction.ocrVariant, score: first.candidateScore });
        return;
      }
      // Low confidence — lazily generate threshold variant only now
      logger.info("OCR low confidence on primary, generating threshold fallback", { score: first?.candidateScore, conf: first?.candidate.extractionConfidence });
      let thresholdVariant;
      try {
        thresholdVariant = await preprocessThresholdVariant(imagePath);
      } catch (e) {
        logger.warn("Threshold preprocessing failed", { error: e.message });
      }
      const second = thresholdVariant ? await runVariant({ ...thresholdVariant, pageSegMode: "6" }) : null;
      const candidates = [first, second].filter(Boolean);
      for (const r of candidates) {
        if (!bestExtraction || r.candidateScore > bestExtraction.candidateScore) {
          bestExtraction = { ...r.candidate, ocrVariant: `${r.variant.name}:psm6`, candidateScore: r.candidateScore };
          bestDurationMs = Date.now() - start;
        }
      }
      if (!bestExtraction && first) {
        bestExtraction = { ...first.candidate, ocrVariant: `${first.variant.name}:psm6`, candidateScore: first.candidateScore };
        bestDurationMs = Date.now() - start;
      }
    };

    const globalTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR pipeline timeout after 35s — image too complex or server overloaded')), 35000)
    );
    await Promise.race([ocrWithGlobalTimeout(), globalTimeout]);

    if (!bestExtraction) {
      throw new Error('All OCR variants failed or timed out');
    }
  } catch (error) {
    logger.error("OCR failed", { error: error.message });
    return {
      success: false,
      error: "OCR_FAILED",
      message:
        "OCR engine failed. Ensure network access on first run to download language data.",
      durationMs: Date.now() - start,
    };
  }

  const ocrRawText = bestExtraction?.ocrRawText || "";

  if (!ocrRawText || ocrRawText.length < 10) {
    return {
      success: false,
      error: "OCR_FAILED",
      message: "Could not extract readable text from image",
      ocrRawText: ocrRawText || "",
      durationMs: Date.now() - start,
    };
  }

  const structured = {
    productName: bestExtraction.productName,
    ingredients: bestExtraction.ingredients,
    ingredientsRaw: bestExtraction.ingredientsRaw,
    nutritionFacts: bestExtraction.nutritionFacts,
    ocrRawText,
    extractionConfidence: bestExtraction.extractionConfidence,
    ocrVariant: bestExtraction.ocrVariant,
  };

  logger.info("OCR extraction complete", {
    productName: structured.productName,
    ingredientCount: structured.ingredients.length,
    confidence: structured.extractionConfidence,
    variant: structured.ocrVariant,
    durationMs: bestDurationMs || Date.now() - start,
  });

  return {
    success: true,
    data: structured,
    durationMs: bestDurationMs || Date.now() - start,
  };
}

function buildExtraction(data) {
  const ocrRawText = normalizeOcrText(data.text);
  const productName = parseProductName(ocrRawText);
  const { ingredients, ingredientsRaw } = parseIngredients(ocrRawText);
  const nutritionFacts = parseNutritionFacts(ocrRawText);
  const extractionConfidence = calculateExtractionConfidence(
    nutritionFacts,
    ingredients,
    data.confidence,
  );

  return {
    productName,
    ingredients,
    ingredientsRaw,
    nutritionFacts,
    ocrRawText,
    extractionConfidence,
  };
}

function scoreExtractionCandidate(candidate) {
  const fieldsFound = REQUIRED_FIELDS.filter(
    (field) => candidate.nutritionFacts[field]?.amount != null,
  ).length;
  const nutritionKeywords = (
    candidate.ocrRawText.match(
      /nutrition|energy|calories|sodium|sugar|protein|fat/gi,
    ) || []
  ).length;

  return (
    fieldsFound * 10 +
    Math.min(candidate.ingredients.length, 12) +
    Math.min(nutritionKeywords, 10) +
    candidate.extractionConfidence * 10
  );
}

function calculateExtractionConfidence(
  nutritionFacts,
  ingredients,
  ocrConfidence,
) {
  const fieldsFound = REQUIRED_FIELDS.filter((field) => {
    const value = nutritionFacts[field];
    return value && (typeof value === "object" ? value.amount != null : true);
  }).length;

  // Also count any nutrition field (calories, fat, carbs) to avoid penalizing labels that simply don't list fiber
  const anyFields = ['calories', 'totalFat', 'saturatedFat', 'sodium', 'totalCarbohydrates', 'dietaryFiber', 'totalSugars', 'addedSugars', 'protein'].filter(k => {
    const v = nutritionFacts[k];
    return v != null && (typeof v === 'object' ? v.amount != null : true);
  }).length;

  const fieldScore = fieldsFound / REQUIRED_FIELDS.length;
  const anyScore = Math.min(anyFields / 3, 1); // reward any 3 fields found
  const combinedFieldScore = Math.max(fieldScore, anyScore * 0.8);
  const ingredientScore = ingredients.length > 0 ? 1 : 0;
  const ocrScore =
    typeof ocrConfidence === "number" ? ocrConfidence / 100 : 0.5;

  return (
    Math.round(
      (combinedFieldScore * 0.5 + ingredientScore * 0.2 + ocrScore * 0.3) * 100,
    ) / 100
  );
}
