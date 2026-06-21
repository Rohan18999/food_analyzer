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
export function calculateHealthScore(input) {
  const { nutritionFacts, ingredients = [] } = input;
  const { baseScore } = SCORING_THRESHOLDS;

  const sodium = scoreSodium(nutritionFacts.sodium?.amount);
  const sugar = scoreSugar(
    nutritionFacts.addedSugars?.amount ?? nutritionFacts.totalSugars?.amount
  );
  const saturatedFat = scoreSaturatedFat(nutritionFacts.saturatedFat?.amount);
  const protein = scoreProtein(nutritionFacts.protein?.amount);
  const fiber = scoreFiber(nutritionFacts.dietaryFiber?.amount);
  const ingredientQuality = analyzeIngredientQuality(ingredients);

  const totalPenalties =
    sodium.penalty +
    sugar.penalty +
    saturatedFat.penalty +
    ingredientQuality.penalty;
  const totalBonuses = protein.bonus + fiber.bonus;
  const finalScore = clamp(baseScore + totalBonuses - totalPenalties, 0, 100);

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
  };

  return {
    healthScore: finalScore,
    verdict: mapScoreToVerdict(finalScore),
    scoreBreakdown: breakdown,
  };
}
