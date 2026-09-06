import { runRagAnalysisChain } from '../ai/chains/ragAnalysis.chain.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Orchestrates RAG analysis — isolated from HTTP controllers and OCR pipeline.
 * Now resilient: throws original AppError with cause so callers can fallback.
 */
export async function runRagAnalysis({ product, healthScore, verdict, scoreBreakdown }) {
  if (!config.openrouter.apiKey) {
    throw new AppError(
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY in backend/.env to enable AI explanations. Deterministic score is still calculated.',
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
    // Preserve AppError status/code, just enhance logging
    if (error instanceof AppError) throw error;

    logger.error('RAG analysis failed', { error: error.message });

    const appError = new AppError(
      error.message || 'Failed to generate AI health analysis',
      503,
      'LLM_ERROR'
    );
    // keep original for debugging but don't expose raw provider payload to client if it contains key
    appError.cause = error;
    throw appError;
  }
}
