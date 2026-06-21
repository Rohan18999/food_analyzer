import {
  INGREDIENT_QUALITY_THRESHOLDS,
  INGREDIENT_RISK_RULES,
} from './ingredientQualityRules.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeIngredient(ingredient) {
  return String(ingredient || '').trim().toLowerCase();
}

function getPositionWeight(index, total) {
  if (index < 3) return 1.5;
  if (index < Math.ceil(total / 3)) return 1.25;
  return 1;
}

function getComplexityPenalty(ingredientCount) {
  const {
    longListStart,
    longListPenalty,
    veryLongListStart,
    veryLongListPenalty,
  } = INGREDIENT_QUALITY_THRESHOLDS;

  if (ingredientCount >= veryLongListStart) return veryLongListPenalty;
  if (ingredientCount >= longListStart) return longListPenalty;
  return 0;
}

export function analyzeIngredientQuality(ingredients = []) {
  const normalizedIngredients = ingredients.map(normalizeIngredient).filter(Boolean);
  const matches = [];

  normalizedIngredients.forEach((ingredient, index) => {
    for (const rule of INGREDIENT_RISK_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(ingredient))) continue;

      const positionWeight = getPositionWeight(index, normalizedIngredients.length);
      const penalty = Math.ceil(rule.severity * positionWeight);

      matches.push({
        ingredient,
        ingredientIndex: index,
        ruleId: rule.id,
        label: rule.label,
        category: rule.category,
        severity: rule.severity,
        positionWeight,
        penalty,
      });
      break;
    }
  });

  const additivePenalty = matches.reduce((sum, match) => sum + match.penalty, 0);
  const complexityPenalty = getComplexityPenalty(normalizedIngredients.length);
  const totalPenalty = clamp(
    additivePenalty + complexityPenalty,
    0,
    INGREDIENT_QUALITY_THRESHOLDS.maxPenalty
  );

  return {
    raw: {
      ingredientCount: normalizedIngredients.length,
      matchedConcernCount: matches.length,
      matches,
      complexityPenalty,
    },
    penalty: totalPenalty,
  };
}
