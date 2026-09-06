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

  // Resilient: unknown foods get generic estimated fallback instead of hard fail
  // This handles vision outputs like "Coke", "Sushi" not in 43-item DB
  const fallbackPer100g = { calories: 150, protein: 4, carbs: 18, fat: 5, fiber: 1.5, sodium: 220, saturatedFat: 1.5, sugar: 4 };
  const missing = [];
  for (const item of normalizedItems) {
    if (!findFoodEntry(item.foodName)) {
      missing.push(item.foodName);
      logger.warn('Food not in DB, using generic fallback', { foodName: item.foodName });
    }
  }
  // If any missing, we will create synthetic entries below instead of throwing

  let nutritionResult;
  let summaries = [];
  let nutritionFacts;

  // Helper to build even for unknown foods via generic fallback
  function buildWithFallback(foodName, portion) {
    let built = buildEstimatedNutrition(foodName, portion);
    if (built) return built;
    // Generic fallback for unknown food
    const { grams, source } = resolveGrams(foodName, portion);
    // Use fallback per100g scaled
    const scaled = (() => {
      const f = fallbackPer100g;
      const factor = grams / 100;
      const round1 = (v) => Math.round(v * 10) / 10;
      return {
        calories: Math.round(f.calories * factor),
        protein: { amount: round1(f.protein * factor), unit: 'g' },
        totalCarbohydrates: { amount: round1(f.carbs * factor), unit: 'g' },
        totalFat: { amount: round1(f.fat * factor), unit: 'g' },
        dietaryFiber: { amount: round1(f.fiber * factor), unit: 'g' },
        sodium: { amount: round1(f.sodium * factor), unit: 'mg' },
        saturatedFat: { amount: round1(f.saturatedFat * factor), unit: 'g' },
        totalSugars: { amount: round1(f.sugar * factor), unit: 'g' },
      };
    })();
    const nutritionFacts = {
      servingSize: `${grams}g (${source} generic)`,
      calories: scaled.calories,
      protein: scaled.protein,
      totalCarbohydrates: scaled.totalCarbohydrates,
      totalFat: scaled.totalFat,
      dietaryFiber: scaled.dietaryFiber,
      sodium: scaled.sodium,
      saturatedFat: scaled.saturatedFat,
      totalSugars: scaled.totalSugars,
    };
    const summary = {
      foodName,
      matchedKey: null,
      grams,
      portionSource: source + ' (generic estimate)',
      per100g: fallbackPer100g,
      calories: scaled.calories,
      protein: scaled.protein.amount,
      carbs: scaled.totalCarbohydrates.amount,
      fat: scaled.totalFat.amount,
      fiber: scaled.dietaryFiber.amount,
      sodium: scaled.sodium.amount,
      saturatedFat: scaled.saturatedFat.amount,
      sugar: scaled.totalSugars.amount,
      isEstimated: true,
      isGenericFallback: true,
    };
    return { nutritionFacts, summary, entry: { displayName: foodName, per100g: fallbackPer100g } };
  }

  if (normalizedItems.length === 1) {
    const built = buildWithFallback(normalizedItems[0].foodName, normalizedItems[0].portion);
    if (!built) throw new AppError('Failed to build nutrition', 500, 'NUTRITION_ERROR');
    nutritionFacts = built.nutritionFacts;
    summaries = [built.summary];
  } else {
    const parts = normalizedItems.map(({ foodName, portion }) => buildWithFallback(foodName, portion)).filter(Boolean);
    if (!parts.length) throw new AppError('Failed to aggregate nutrition', 500, 'NUTRITION_ERROR');
    // Use existing aggregate logic but with fallback parts
    const agg = (() => {
      const totalGrams = parts.reduce((s, p) => s + p.summary.grams, 0);
      const round1 = (v) => Math.round(v * 10) / 10;
      const aggFacts = {
        servingSize: `${totalGrams}g total (${parts.length} items)`,
        calories: parts.reduce((s, p) => s + p.nutritionFacts.calories, 0),
        protein: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.protein.amount, 0)), unit: 'g' },
        totalCarbohydrates: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.totalCarbohydrates.amount, 0)), unit: 'g' },
        totalFat: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.totalFat.amount, 0)), unit: 'g' },
        dietaryFiber: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.dietaryFiber.amount, 0)), unit: 'g' },
        sodium: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.sodium.amount, 0)), unit: 'mg' },
        saturatedFat: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.saturatedFat.amount, 0)), unit: 'g' },
        totalSugars: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.totalSugars.amount, 0)), unit: 'g' },
      };
      return { parts, aggFacts };
    })();
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
    if (!config.openrouter.apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    const groqPromise = generateGroqJson({
      systemPrompt: NORMAL_FOOD_SYSTEM_PROMPT,
      userPrompt,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI insights timed out after 12s')), 12000)
    );
    llmOutput = await Promise.race([groqPromise, timeoutPromise]);
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
