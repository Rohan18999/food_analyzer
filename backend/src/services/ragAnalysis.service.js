import { runRagAnalysisChain } from '../ai/chains/ragAnalysis.chain.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Orchestrates RAG analysis — isolated from HTTP controllers and OCR pipeline.
 */
export async function runRagAnalysis({ product, healthScore, verdict, scoreBreakdown }) {
  if (!config.groq.apiKey) {
    throw new AppError(
      'Groq API key not configured. Set GROQ_API_KEY to enable RAG analysis.',
      503,
      'LLM_NOT_CONFIGURED'
    );
  }

  try {
    const result = await runRagAnalysisChain({
      product,
      healthScore,
      verdict,
      scoreBreakdown,
    });

    logger.info('RAG analysis complete', {
      retrievedCount: result.retrievedSources.length,
      citedCount: result.retrievedSources.filter((s) => s.usedInExplanation).length,
    });

    return result;
  } catch (error) {
    logger.error('RAG analysis failed', { error: error.message });

    throw new AppError(
      'Failed to generate AI health analysis',
      503,
      'LLM_ERROR'
    );
  }
}
