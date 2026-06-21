export const SCORING_THRESHOLDS = {
  baseScore: 70,

  sodium: {
    baselineMg: 140,
    penaltyPer100mg: 1,
    maxPenalty: 20,
  },

  sugar: {
    baselineG: 10,
    penaltyPer5g: 2,
    maxPenalty: 25,
  },

  saturatedFat: {
    baselineG: 3,
    penaltyPer2g: 3,
    maxPenalty: 20,
  },

  protein: {
    baselineG: 5,
    bonusPer3g: 1,
    maxBonus: 10,
  },

  fiber: {
    baselineG: 3,
    bonusPer2g: 2,
    maxBonus: 15,
  },
};

export const VERDICT_RANGES = [
  { min: 80, max: 100, verdict: 'Very Healthy' },
  { min: 65, max: 79, verdict: 'Healthy' },
  { min: 50, max: 64, verdict: 'Moderately Healthy' },
  { min: 35, max: 49, verdict: 'Unhealthy' },
  { min: 0, max: 34, verdict: 'Very Unhealthy' },
];
