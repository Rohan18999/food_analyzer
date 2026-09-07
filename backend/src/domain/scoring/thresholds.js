export const SCORING_THRESHOLDS = {
  baseScore: 70,

  // Per 100g thresholds — balanced for discrimination
  sodium: {
    baselineMg: 120,
    penaltyPer100mg: 2,
    maxPenalty: 22,
  },

  sugar: {
    baselineG: 6, // moderate per 100g
    penaltyPer5g: 4,
    maxPenalty: 28,
  },

  saturatedFat: {
    baselineG: 3, // moderate per 100g
    penaltyPer1_5g: 3,
    maxPenalty: 20,
  },

  protein: {
    baselineG: 6,
    bonusPer3g: 2,
    maxBonus: 12,
  },

  fiber: {
    baselineG: 2.5,
    bonusPer2g: 3,
    maxBonus: 15,
  },

  // Legacy per-serving fallback — slightly more aggressive for drinks
  legacy: {
    sodium: { baselineMg: 140, penaltyPer100mg: 1, maxPenalty: 20 },
    sugar: { baselineG: 8, penaltyPer5g: 4, maxPenalty: 28 },
    saturatedFat: { baselineG: 3, penaltyPer2g: 3, maxPenalty: 20 },
  },
};

export const VERDICT_RANGES = [
  { min: 80, max: 100, verdict: 'Very Healthy' },
  { min: 65, max: 79, verdict: 'Healthy' },
  { min: 50, max: 64, verdict: 'Moderately Healthy' },
  { min: 35, max: 49, verdict: 'Unhealthy' },
  { min: 0, max: 34, verdict: 'Very Unhealthy' },
];
