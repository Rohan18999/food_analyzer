import fs from "fs";
import { extractProductFromImage } from "../domain/ocr/ocr.service.js";
import { calculateHealthScore } from "../domain/scoring/healthScoreEngine.js";
import { createProduct } from "../repositories/product.repository.js";
import { createAnalysis } from "../repositories/analysis.repository.js";
import { runRagAnalysis } from "./ragAnalysis.service.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Full Phase 1 pipeline: OCR → structured extraction → health scoring.
 * @param {string} imagePath - Path to uploaded image
 */
export async function analyzeProductImage(imagePath) {
  const pipelineStart = Date.now();

  try {
    const ocrResult = await extractProductFromImage(imagePath);

    if (!ocrResult.success) {
      throw new AppError(ocrResult.message, 422, ocrResult.error);
    }

    const extracted = ocrResult.data;

    // Lowered from 0.3 to 0.18 — many real labels omit fiber or have sparse ingredients but still scorable.
    // We log details to help user understand what was missed.
    if (extracted.extractionConfidence < 0.18) {
      const found = Object.entries(extracted.nutritionFacts)
        .filter(([, v]) => v != null && (typeof v === 'object' ? v.amount != null : true))
        .map(([k]) => k)
        .join(', ') || 'none';
      logger.warn('Extraction confidence low', {
        confidence: extracted.extractionConfidence,
        foundFields: found,
        ocrVariant: extracted.ocrVariant,
        ingredientCount: extracted.ingredients.length,
        ocrPreview: extracted.ocrRawText.slice(0, 300),
      });
      throw new AppError(
        `Could not extract sufficient nutrition information (confidence ${Math.round(extracted.extractionConfidence * 100)}% — found: ${found}). Try a tighter crop of the nutrition table, ensure good lighting and that the label is flat and in focus. Tip: also try the “Normal Food” mode if this is a meal without a label.`,
        422,
        "EXTRACTION_INCOMPLETE",
        {
          extractionConfidence: extracted.extractionConfidence,
          foundFields: found,
          ocrVariant: extracted.ocrVariant,
          ingredientCount: extracted.ingredients.length,
          ocrPreview: extracted.ocrRawText.slice(0, 400),
          suggestion: 'Crop tightly around nutrition table + ingredients, avoid glare, hold phone parallel to label',
        }
      );
    }

    if (extracted.extractionConfidence < 0.32) {
      logger.warn('Proceeding with low-confidence extraction', {
        confidence: extracted.extractionConfidence,
        variant: extracted.ocrVariant,
      });
    }

    const scoringStart = Date.now();
    const scoringResult = calculateHealthScore({
      nutritionFacts: extracted.nutritionFacts,
      ingredients: extracted.ingredients,
    });
    const scoringDurationMs = Date.now() - scoringStart;

    const productPayload = {
      productName: extracted.productName,
      ingredients: extracted.ingredients,
      ingredientsRaw: extracted.ingredientsRaw,
      nutritionFacts: extracted.nutritionFacts,
    };

    const ragStart = Date.now();
    let ragResult;
    let ragDurationMs = 0;
    let ragFallback = false;
    let ragError = null;
    try {
      // Allow up to 12s for Groq (now with internal retry up to 2×10s truncated handling)
      const ragPromise = runRagAnalysis({
        product: productPayload,
        healthScore: scoringResult.healthScore,
        verdict: scoringResult.verdict,
        scoreBreakdown: scoringResult.scoreBreakdown,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI insights timed out after 12s — using fast fallback')), 12000)
      );
      ragResult = await Promise.race([ragPromise, timeoutPromise]);
      ragDurationMs = Date.now() - ragStart;
    } catch (error) {
      ragDurationMs = Date.now() - ragStart;
      ragError = error;
      ragFallback = true;
      logger.warn('RAG analysis unavailable, using deterministic fallback', {
        code: error.code || 'TIMEOUT',
        message: error.message,
        ragDurationMs,
      });
      ragResult = buildPackagedFallback({
        product: productPayload,
        healthScore: scoringResult.healthScore,
        verdict: scoringResult.verdict,
        scoreBreakdown: scoringResult.scoreBreakdown,
        error,
      });
    }

    const totalDurationMs = Date.now() - pipelineStart;

    // DB writes are persisted async (non-blocking) — saves 300-800ms on Atlas cold connection.
    // Response returns immediately; persistence happens in background.
    let productId = null;
    let analysisId = null;
    const persistPromise = (async () => {
      try {
        const product = await createProduct({
          ...productPayload,
          imagePath,
          ocrRawText: extracted.ocrRawText,
          extractionConfidence: extracted.extractionConfidence,
        });
        productId = product?._id?.toString() || null;
        const analysisRecord = await createAnalysis({
          productId: product?._id || null,
          version: "v2",
          healthScore: scoringResult.healthScore,
          verdict: scoringResult.verdict,
          scoreBreakdown: scoringResult.scoreBreakdown,
          llmOutput: ragResult.llmOutput,
          retrievedSources: ragResult.retrievedSources,
          ragContext: {
            searchQuery: ragResult.searchQuery,
            retrievedDocIds: ragResult.retrievedDocIds,
          },
          extractedData: extracted,
          processingMetrics: {
            ocrDurationMs: ocrResult.durationMs,
            scoringDurationMs,
            ragDurationMs,
            totalDurationMs,
          },
          status: "completed",
        });
        analysisId = analysisRecord?._id?.toString() || null;
        logger.info("Analysis persisted", { analysisId, productId });
      } catch (e) {
        logger.warn("Background persist failed (non-critical)", { error: e.message });
      }
    })();
    // Don't block response on DB; only wait up to 400ms then return anyway
    await Promise.race([persistPromise, new Promise((r) => setTimeout(r, 400))]);

    const response = {
      analysisId,
      product: productPayload,
      healthScore: scoringResult.healthScore,
      verdict: scoringResult.verdict,
      scoreBreakdown: scoringResult.scoreBreakdown,
      explanation: ragResult.llmOutput.explanation,
      evidenceBasedRisks: ragResult.llmOutput.evidenceBasedRisks,
      pros: ragResult.llmOutput.pros,
      cons: ragResult.llmOutput.cons,
      alternatives: ragResult.llmOutput.alternatives,
      retrievedSources: ragResult.retrievedSources,
      extractionConfidence: extracted.extractionConfidence,
      processingTimeMs: totalDurationMs,
      isFallback: ragFallback || false,
      fallbackReason: ragError ? { code: ragError.code || 'LLM_ERROR', message: ragError.message } : null,
    };

    logger.info("Analysis complete", {
      analysisId: response.analysisId,
      healthScore: response.healthScore,
      verdict: response.verdict,
      fallback: ragFallback,
      totalDurationMs,
    });

    return response;
  } finally {
    // Clean up uploaded file after processing
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlink(imagePath, (err) => {
        if (err) logger.warn("Failed to delete temp upload", { imagePath });
      });
    }
  }
}

function buildPackagedFallback({ product, healthScore, verdict, scoreBreakdown, error }) {
  const reasons = [];
  if (scoreBreakdown.sodium?.penalty) reasons.push(`high sodium (${product.nutritionFacts.sodium?.amount ?? '?'}mg)`);
  if (scoreBreakdown.sugar?.penalty) reasons.push(`added sugar (${product.nutritionFacts.addedSugars?.amount ?? product.nutritionFacts.totalSugars?.amount ?? '?'}g)`);
  if (scoreBreakdown.saturatedFat?.penalty) reasons.push(`saturated fat (${product.nutritionFacts.saturatedFat?.amount ?? '?'}g)`);
  if (scoreBreakdown.ingredientQuality?.penalty) reasons.push(`ingredient quality flags`);
  if (scoreBreakdown.protein?.bonus) reasons.push(`good protein`);
  if (scoreBreakdown.fiber?.bonus) reasons.push(`fiber content`);

  const isMissingKey = error?.code === 'LLM_NOT_CONFIGURED';
  const explanation = isMissingKey
    ? `${product.productName || 'This product'} scored ${healthScore}/100 (${verdict}) based on deterministic nutrition scoring. ${reasons.length ? `Key factors: ${reasons.join(', ')}.` : ''} AI explanation is unavailable — set GROQ_API_KEY in backend/.env to enable Groq-powered insights. Score remains accurate.`
    : `${product.productName || 'This product'} scored ${healthScore}/100 (${verdict}). ${reasons.length ? `Key factors: ${reasons.join(', ')}.` : ''} AI explanation temporarily unavailable (${error?.message || 'LLM error'}) — showing deterministic summary. Try again shortly.`;

  const pros = [];
  const cons = [];
  if (scoreBreakdown.protein?.bonus) pros.push('Good protein content');
  if (scoreBreakdown.fiber?.bonus) pros.push('Contains dietary fiber');
  if (!scoreBreakdown.sodium?.penalty && !scoreBreakdown.sugar?.penalty) pros.push('No major sodium/sugar penalty');
  if (scoreBreakdown.sodium?.penalty) cons.push(`High sodium — ${product.nutritionFacts.sodium?.amount ?? ''}mg per serving exceeds baseline`);
  if (scoreBreakdown.sugar?.penalty) cons.push(`High sugar — consider lower-sugar alternatives`);
  if (scoreBreakdown.saturatedFat?.penalty) cons.push(`Saturated fat elevated — check ingredient oils/fats`);
  if (scoreBreakdown.ingredientQuality?.penalty) cons.push(`Contains flagged ingredients — see ingredient quality section`);
  if (!pros.length) pros.push('Score calculated — see breakdown for details');
  if (!cons.length) cons.push('No major concerns flagged by deterministic scoring');

  return {
    llmOutput: {
      explanation,
      evidenceBasedRisks: cons.slice(0, 3),
      pros,
      cons,
      alternatives: [{ name: 'Choose lower-sodium / lower-sugar variant', reason: 'Similar product with better nutrition per 100g often improves score by 10-15 points.' }],
      citedSourceTitles: [],
    },
    retrievedSources: [],
    searchQuery: '',
    retrievedDocIds: [],
  };
}
