import { SCORING_THRESHOLDS } from './thresholds.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function scoreSodium(amountMg, per100g = false) {
  const cfg = per100g ? SCORING_THRESHOLDS.sodium : SCORING_THRESHOLDS.legacy.sodium;
  const { baselineMg, penaltyPer100mg, maxPenalty } = cfg;
  if (amountMg == null || isNaN(amountMg)) return { raw: null, penalty: 0, per100g };
  const excess = Math.max(0, amountMg - baselineMg);
  const penalty = clamp(Math.floor(excess / 100) * penaltyPer100mg, 0, maxPenalty);
  return { raw: amountMg, penalty, per100g };
}

export function scoreSugar(amountG, per100g = false, isNatural = false) {
  const cfg = per100g ? SCORING_THRESHOLDS.sugar : SCORING_THRESHOLDS.legacy.sugar;
  if (amountG == null || isNaN(amountG)) return { raw: null, penalty: 0, per100g };
  // Natural fruit sugar less penalized (half)
  const effective = isNatural ? amountG * 0.5 : amountG;
  const baseline = cfg.baselineG;
  const excess = Math.max(0, effective - baseline);
  const per = per100g ? SCORING_THRESHOLDS.sugar.penaltyPer5g : cfg.penaltyPer5g;
  const penalty = clamp(Math.floor(excess / 5) * per, 0, cfg.maxPenalty);
  return { raw: amountG, penalty, per100g, isNatural };
}

export function scoreSaturatedFat(amountG, per100g = false) {
  const cfg = per100g ? SCORING_THRESHOLDS.saturatedFat : SCORING_THRESHOLDS.legacy.saturatedFat;
  if (amountG == null || isNaN(amountG)) return { raw: null, penalty: 0, per100g };
  const excess = Math.max(0, amountG - cfg.baselineG);
  const per = per100g ? cfg.penaltyPer1_5g : cfg.penaltyPer2g;
  const divisor = per100g ? 1.5 : 2;
  const penalty = clamp(Math.floor(excess / divisor) * per, 0, cfg.maxPenalty);
  return { raw: amountG, penalty, per100g };
}

export function scoreProtein(amountG, per100g = false) {
  const cfg = SCORING_THRESHOLDS.protein;
  if (amountG == null || isNaN(amountG)) return { raw: null, bonus: 0, per100g };
  // Per 100g and per serving share same thresholds but per100g is more meaningful
  const excess = Math.max(0, amountG - cfg.baselineG);
  const bonus = clamp(Math.floor(excess / 3) * cfg.bonusPer3g, 0, cfg.maxBonus);
  return { raw: amountG, bonus, per100g };
}

export function scoreFiber(amountG, per100g = false) {
  const cfg = SCORING_THRESHOLDS.fiber;
  if (amountG == null || isNaN(amountG)) return { raw: null, bonus: 0, per100g };
  const excess = Math.max(0, amountG - cfg.baselineG);
  const bonus = clamp(Math.floor(excess / 2) * cfg.bonusPer2g, 0, cfg.maxBonus);
  return { raw: amountG, bonus, per100g };
}

// Calories: very low cal density (water) should not be penalized; very high cal density penalized slightly
export function scoreCalories(calories, per100g = false) {
  if (calories == null || isNaN(calories)) return { raw: null, penalty: 0 };
  // Only penalize extreme energy density per 100g (>300 kcal/100g)
  if (!per100g) return { raw: calories, penalty: 0 };
  if (calories > 350) return { raw: calories, penalty: 4 };
  if (calories > 300) return { raw: calories, penalty: 2 };
  return { raw: calories, penalty: 0 };
}
