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

    if (extracted.extractionConfidence < 0.3) {
      throw new AppError(
        "Could not extract sufficient nutrition information from image. Try a clearer photo of the nutrition label.",
        422,
        "EXTRACTION_INCOMPLETE",
      );
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
    const ragResult = await runRagAnalysis({
      product: productPayload,
      healthScore: scoringResult.healthScore,
      verdict: scoringResult.verdict,
      scoreBreakdown: scoringResult.scoreBreakdown,
    });
    const ragDurationMs = Date.now() - ragStart;

    const product = await createProduct({
      ...productPayload,
      imagePath,
      ocrRawText: extracted.ocrRawText,
      extractionConfidence: extracted.extractionConfidence,
    });

    const totalDurationMs = Date.now() - pipelineStart;

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

    const response = {
      analysisId: analysisRecord?._id?.toString() || null,
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
    };

    logger.info("Analysis complete", {
      analysisId: response.analysisId,
      healthScore: response.healthScore,
      verdict: response.verdict,
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
