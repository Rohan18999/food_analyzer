import { SCORING_THRESHOLDS } from './thresholds.js';
import {
  scoreSodium,
  scoreSugar,
  scoreSaturatedFat,
  scoreProtein,
  scoreFiber,
} from './scoringRules.js';
import { analyzeIngredientQuality } from './ingredientQualityAnalyzer.js';
import { mapScoreToVerdict } from './verdictMapper.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deterministic health scoring engine.
 * High sodium/sugar/saturated fat decrease score; protein/fiber increase it.
 *
 * @param {{
 *   nutritionFacts: import('../models/nutrition.model.js').NutritionFacts,
 *   ingredients?: string[]
 * }} input
 */
function parseServingGrams(servingSize) {
  if (!servingSize) return null;
  const str = String(servingSize);
  // Prefer explicit grams in parentheses: "1 bar (40g)" -> 40
  const paren = str.match(/\((\d+(?:\.\d+)?)\s*g/i);
  if (paren) return parseFloat(paren[1]);
  // Direct grams: "350g" or "200g total"
  const direct = str.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (direct) return parseFloat(direct[1]);
  // ml approx as g for water-like
  const ml = str.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (ml) return parseFloat(ml[1]);
  return null;
}

function isNaturalSugarContext(ingredients, facts) {
  // Fruit/veg without added sugars -> natural
  if (facts.addedSugars?.amount != null) return false;
  const txt = ingredients.join(' ').toLowerCase();
  return /apple|banana|orange|fruit|berry|mango|grape|pear|peach/.test(txt);
}

export function calculateHealthScore(input) {
  const { nutritionFacts, ingredients = [] } = input;
  const { baseScore } = SCORING_THRESHOLDS;

  // --- Per 100g normalization for accuracy (fixes per-serving clustering) ---
  const servingGrams = parseServingGrams(nutritionFacts.servingSize);
  const per100g = servingGrams && servingGrams > 10 && servingGrams < 2000; // valid range
  const factor = per100g ? 100 / servingGrams : 1;

  // Normalize nutrients to per 100g if serving grams known
  const norm = (val) => (val != null && per100g ? val * factor : val);
  const caloriesPer100g = nutritionFacts.calories != null && per100g ? nutritionFacts.calories * factor : null;

  // Compute both per-serving and per-100g and take the more penalizing/bonus for accuracy
  // Fixes: chips 28g (per 100g high) vs Coke 330ml (per serving high)
  const isNatural = isNaturalSugarContext(ingredients, nutritionFacts);
  const sugarRaw = nutritionFacts.addedSugars?.amount ?? nutritionFacts.totalSugars?.amount;
  const sodiumPerServing = scoreSodium(nutritionFacts.sodium?.amount, false);
  const sodiumPer100g = per100g ? scoreSodium(norm(nutritionFacts.sodium?.amount), true) : sodiumPerServing;
  const sodium = { ...sodiumPer100g, raw: nutritionFacts.sodium?.amount, penalty: Math.max(sodiumPerServing.penalty, sodiumPer100g.penalty), perServing: sodiumPerServing.penalty, per100gPenalty: sodiumPer100g.penalty };

  const sugarPerServing = scoreSugar(sugarRaw, false, isNatural);
  const sugarPer100g = per100g ? scoreSugar(norm(sugarRaw), true, isNatural) : sugarPerServing;
  const sugar = { ...sugarPer100g, raw: sugarRaw, penalty: Math.max(sugarPerServing.penalty, sugarPer100g.penalty), perServing: sugarPerServing.penalty, per100gPenalty: sugarPer100g.penalty };

  const satPerServing = scoreSaturatedFat(nutritionFacts.saturatedFat?.amount, false);
  const satPer100g = per100g ? scoreSaturatedFat(norm(nutritionFacts.saturatedFat?.amount), true) : satPerServing;
  const saturatedFat = { ...satPer100g, raw: nutritionFacts.saturatedFat?.amount, penalty: Math.max(satPerServing.penalty, satPer100g.penalty), perServing: satPerServing.penalty, per100gPenalty: satPer100g.penalty };

  const protPerServing = scoreProtein(nutritionFacts.protein?.amount, false);
  const protPer100g = per100g ? scoreProtein(norm(nutritionFacts.protein?.amount), true) : protPerServing;
  const protein = { ...protPer100g, raw: nutritionFacts.protein?.amount, bonus: Math.max(protPerServing.bonus, protPer100g.bonus) };

  const fibPerServing = scoreFiber(nutritionFacts.dietaryFiber?.amount, false);
  const fibPer100g = per100g ? scoreFiber(norm(nutritionFacts.dietaryFiber?.amount), true) : fibPerServing;
  const fiber = { ...fibPer100g, raw: nutritionFacts.dietaryFiber?.amount, bonus: Math.max(fibPerServing.bonus, fibPer100g.bonus) };

  const ingredientQuality = analyzeIngredientQuality(ingredients);

  // Special case: water / very low calorie, no sugar/sodium -> Very Healthy
  const isWaterLike = (nutritionFacts.calories === 0 || caloriesPer100g === 0) && (nutritionFacts.sodium?.amount ?? 0) < 20 && (sugar.raw ?? 0) === 0;
  if (isWaterLike && ingredients.length === 0) {
    return {
      healthScore: 95,
      verdict: mapScoreToVerdict(95),
      scoreBreakdown: {
        sodium: { raw: 0, penalty: 0, per100g }, sugar: { raw: 0, penalty: 0, per100g }, saturatedFat: { raw: 0, penalty: 0, per100g },
        ingredientQuality, protein, fiber, baseScore, totalPenalties: 0, totalBonuses: 0, finalScore: 95, normalized: true, servingGrams, per100g,
      },
    };
  }

  // Calories penalty for energy-dense per 100g
  const caloriesPenalty = (() => {
    if (!per100g || caloriesPer100g == null) return 0;
    if (caloriesPer100g > 400) return 6;
    if (caloriesPer100g > 300) return 3;
    return 0;
  })();

  const totalPenalties =
    sodium.penalty +
    sugar.penalty +
    saturatedFat.penalty +
    ingredientQuality.penalty +
    caloriesPenalty;
  const totalBonuses = protein.bonus + fiber.bonus;
  let finalScore = clamp(baseScore + totalBonuses - totalPenalties, 0, 100);

  // Whole fruit bonus: natural sugar with fiber should be rewarded
  if (isNatural) {
    const fiberPer100g = norm(nutritionFacts.dietaryFiber?.amount);
    if (fiberPer100g != null && fiberPer100g >= 1.5) finalScore = Math.min(100, finalScore + 10);
    else if (fiber.bonus > 0) finalScore = Math.min(100, finalScore + 5);
  }
  // Ultra-processed with many additives -> cap at 55 even if nutrients look okay
  if (ingredientQuality.penalty >= 10 && finalScore > 55) finalScore = Math.min(finalScore, 58);

  const breakdown = {
    sodium,
    sugar,
    saturatedFat,
    ingredientQuality,
    protein,
    fiber,
    baseScore,
    totalPenalties,
    totalBonuses,
    finalScore,
    servingGrams,
    per100g,
    caloriesPer100g,
    caloriesPenalty,
    normalized: per100g,
  };

  return {
    healthScore: finalScore,
    verdict: mapScoreToVerdict(finalScore),
    scoreBreakdown: breakdown,
  };
}
