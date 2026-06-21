import { SCORING_THRESHOLDS } from './thresholds.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function scoreSodium(amountMg) {
  const { baselineMg, penaltyPer100mg, maxPenalty } = SCORING_THRESHOLDS.sodium;
  if (amountMg == null || isNaN(amountMg)) return { raw: null, penalty: 0 };

  const excess = Math.max(0, amountMg - baselineMg);
  const penalty = clamp(Math.floor(excess / 100) * penaltyPer100mg, 0, maxPenalty);
  return { raw: amountMg, penalty };
}

export function scoreSugar(amountG) {
  const { baselineG, penaltyPer5g, maxPenalty } = SCORING_THRESHOLDS.sugar;
  if (amountG == null || isNaN(amountG)) return { raw: null, penalty: 0 };

  const excess = Math.max(0, amountG - baselineG);
  const penalty = clamp(Math.floor(excess / 5) * penaltyPer5g, 0, maxPenalty);
  return { raw: amountG, penalty };
}

export function scoreSaturatedFat(amountG) {
  const { baselineG, penaltyPer2g, maxPenalty } = SCORING_THRESHOLDS.saturatedFat;
  if (amountG == null || isNaN(amountG)) return { raw: null, penalty: 0 };

  const excess = Math.max(0, amountG - baselineG);
  const penalty = clamp(Math.floor(excess / 2) * penaltyPer2g, 0, maxPenalty);
  return { raw: amountG, penalty };
}

export function scoreProtein(amountG) {
  const { baselineG, bonusPer3g, maxBonus } = SCORING_THRESHOLDS.protein;
  if (amountG == null || isNaN(amountG)) return { raw: null, bonus: 0 };

  const excess = Math.max(0, amountG - baselineG);
  const bonus = clamp(Math.floor(excess / 3) * bonusPer3g, 0, maxBonus);
  return { raw: amountG, bonus };
}

export function scoreFiber(amountG) {
  const { baselineG, bonusPer2g, maxBonus } = SCORING_THRESHOLDS.fiber;
  if (amountG == null || isNaN(amountG)) return { raw: null, bonus: 0 };

  const excess = Math.max(0, amountG - baselineG);
  const bonus = clamp(Math.floor(excess / 2) * bonusPer2g, 0, maxBonus);
  return { raw: amountG, bonus };
}
