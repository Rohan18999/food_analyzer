import fs from 'fs';
import { calculateHealthScore } from '../domain/scoring/healthScoreEngine.js';
import { buildEstimatedNutrition, aggregateNutrition, resolveGrams } from '../domain/nutrition/portionScaler.js';
import { findFoodEntry, listFoodNames } from '../data/nutritionDatabase.js';
import { MongoKeywordRetriever } from '../ai/retrievers/mongoKeywordRetriever.js';
import { buildSearchQuery, formatRetrievedContext } from '../ai/queryBuilder.js';
import { generateGroqJson } from '../ai/clients/groqClient.js';
import { NORMAL_FOOD_SYSTEM_PROMPT, NORMAL_FOOD_USER_PROMPT } from '../ai/prompts/normalFoodAnalysis.prompt.js';
import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

export function getSupportedFoods() {
  return listFoodNames().map((k) => {
    const f = findFoodEntry(k);
    return { key: k, displayName: f.entry.displayName, category: f.entry.category, per100g: f.entry.per100g, portions: f.entry.portions, pieceGrams: f.entry.pieceGrams || null, defaultGrams: f.entry.defaultGrams };
  });
}

/**
 * Deterministic normal food analysis: nutrition scaling + health score + LLM explanation.
 * foods: [{ name, portion: { grams, size, quantity, volume, etc } }]
 */
export async function analyzeNormalFood({ foods, portion: globalPortion }) {
  if (!Array.isArray(foods) || foods.length === 0) {
    throw new AppError('At least one food item is required', 400, 'INVALID_INPUT');
  }

  // Normalize foods: support both { name, portion } and flat { name } with global portion
  const normalizedItems = foods.map((f) => {
    if (typeof f === 'string') return { foodName: f, portion: globalPortion || {} };
    return { foodName: f.name || f.foodName, portion: f.portion || globalPortion || {} };
  }).filter((x) => x.foodName);

  if (!normalizedItems.length) throw new AppError('No valid food names provided', 400, 'INVALID_INPUT');

  // Validate each food exists (warn if not)
  const missing = [];
  for (const item of normalizedItems) {
    if (!findFoodEntry(item.foodName)) missing.push(item.foodName);
  }
  if (missing.length) {
    throw new AppError(`Food not found in nutrition database: ${missing.join(', ')}. Use /api/v1/food/supported-foods to list available items.`, 400, 'FOOD_NOT_FOUND');
  }

  let nutritionResult;
  let summaries = [];
  let nutritionFacts;

  if (normalizedItems.length === 1) {
    const built = buildEstimatedNutrition(normalizedItems[0].foodName, normalizedItems[0].portion);
    if (!built) throw new AppError('Failed to build nutrition', 500, 'NUTRITION_ERROR');
    nutritionFacts = built.nutritionFacts;
    summaries = [built.summary];
  } else {
    const agg = aggregateNutrition(normalizedItems);
    if (!agg) throw new AppError('Failed to aggregate nutrition', 500, 'NUTRITION_ERROR');
    nutritionFacts = agg.aggFacts;
    summaries = agg.parts.map((p) => p.summary);
  }

  const scoringResult = calculateHealthScore({
    nutritionFacts,
    ingredients: summaries.map((s) => s.foodName),
  });

  // RAG retrieval: use first food + nutrition for query
  const productForRag = {
    productName: summaries.map((s) => s.foodName).join(' + '),
    ingredients: summaries.map((s) => s.foodName),
    nutritionFacts,
  };

  let retrievedDocs = [];
  let retrievedSources = [];
  let searchQuery = '';

  try {
    searchQuery = buildSearchQuery(productForRag);
    // Also append food names for better keyword hit
    searchQuery += ' ' + summaries.map(s => s.foodName).join(' ');
    const { isDatabaseConnected } = await import('../config/database.js');
    if (isDatabaseConnected()) {
      const retriever = new MongoKeywordRetriever({ topK: config.rag.topK });
      retrievedDocs = await retriever.invoke(searchQuery);
      retrievedSources = retrievedDocs.map((doc) => ({
        title: doc.metadata.title,
        category: doc.metadata.category,
        excerpt: doc.pageContent.slice(0, 250),
        relevanceScore: doc.metadata.score ?? null,
        usedInExplanation: false,
      }));
    }
  } catch (e) {
    logger.warn('RAG retrieval failed for normal food, continuing without context', { error: e.message });
  }

  const retrievedContext = formatRetrievedContext(
    retrievedDocs.map((doc) => ({
      title: doc.metadata.title,
      category: doc.metadata.category,
      content: doc.pageContent,
      score: doc.metadata.score,
    }))
  );

  const mealJson = JSON.stringify({
    foods: summaries.map((s) => ({ name: s.foodName, grams: s.grams, portionSource: s.portionSource })),
    estimatedNutrition: nutritionFacts,
    summaries,
    scoreBreakdown: scoringResult.scoreBreakdown,
    isEstimated: true,
  }, null, 2);

  const userPrompt = NORMAL_FOOD_USER_PROMPT
    .replace('{retrieved_documents}', retrievedContext)
    .replace('{meal_json}', mealJson)
    .replace('{health_score}', String(scoringResult.healthScore))
    .replace('{verdict}', scoringResult.verdict);

  let llmOutput;
  try {
    if (!config.groq.apiKey) throw new Error('GROQ_API_KEY not configured');
    llmOutput = await generateGroqJson({
      systemPrompt: NORMAL_FOOD_SYSTEM_PROMPT,
      userPrompt,
    });
    // mark used sources
    retrievedSources = retrievedSources.map((s) => ({
      ...s,
      usedInExplanation: llmOutput.citedSourceTitles?.includes(s.title) ?? false,
    }));
  } catch (e) {
    logger.warn('Normal food LLM failed, using fallback explanation', { error: e.message });
    llmOutput = {
      explanation: `Estimated analysis for ${summaries.map(s=>s.foodName).join(' + ')} (${nutritionFacts.calories} kcal). This is an estimate — actual values vary by recipe and preparation. Health score ${scoringResult.healthScore}/100 (${scoringResult.verdict}).`,
      evidenceBasedRisks: [],
      pros: scoringResult.scoreBreakdown.protein?.bonus ? ['Good protein content'] : [],
      cons: [],
      alternatives: [{ name: 'Add vegetables or fiber-rich side', reason: 'Increase fiber and micronutrients' }],
      citedSourceTitles: [],
    };
  }

  return {
    mode: 'normal',
    foods: summaries,
    nutritionFacts: { ...nutritionFacts, isEstimated: true },
    healthScore: scoringResult.healthScore,
    verdict: scoringResult.verdict,
    scoreBreakdown: scoringResult.scoreBreakdown,
    explanation: llmOutput.explanation,
    evidenceBasedRisks: llmOutput.evidenceBasedRisks,
    pros: llmOutput.pros,
    cons: llmOutput.cons,
    alternatives: llmOutput.alternatives,
    retrievedSources,
    searchQuery,
    isEstimated: true,
  };
}
