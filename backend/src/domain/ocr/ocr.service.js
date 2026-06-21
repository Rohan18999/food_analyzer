import Tesseract from "tesseract.js";
import { preprocessImageVariants } from "./imagePreprocessor.js";
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

  let imageVariants;
  try {
    imageVariants = await preprocessImageVariants(imagePath);
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
    const attempts = imageVariants.flatMap((variant) => [
      { ...variant, pageSegMode: "6" },
      { ...variant, pageSegMode: "11" },
    ]);

    for (const variant of attempts) {
      const result = await Tesseract.recognize(variant.buffer, "eng", {
        ...TESSERACT_CONFIG,
        tessedit_pageseg_mode: variant.pageSegMode,
        logger: (m) => {
          if (m.status === "recognizing text") {
            logger.debug("OCR progress", {
              variant: variant.name,
              psm: variant.pageSegMode,
              progress: m.progress,
            });
          }
        },
      });

      const candidate = buildExtraction(result.data);
      const candidateScore = scoreExtractionCandidate(candidate);

      logger.info("OCR variant complete", {
        variant: variant.name,
        psm: variant.pageSegMode,
        score: candidateScore,
        confidence: candidate.extractionConfidence,
      });

      if (!bestExtraction || candidateScore > bestExtraction.candidateScore) {
        bestExtraction = {
          ...candidate,
          ocrVariant: `${variant.name}:psm${variant.pageSegMode}`,
          candidateScore,
        };
        bestDurationMs = Date.now() - start;
      }
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

  const fieldScore = fieldsFound / REQUIRED_FIELDS.length;
  const ingredientScore = ingredients.length > 0 ? 1 : 0;
  const ocrScore =
    typeof ocrConfidence === "number" ? ocrConfidence / 100 : 0.5;

  return (
    Math.round(
      (fieldScore * 0.5 + ingredientScore * 0.2 + ocrScore * 0.3) * 100,
    ) / 100
  );
}
