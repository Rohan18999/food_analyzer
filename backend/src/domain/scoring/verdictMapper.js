import { VERDICT_RANGES } from './thresholds.js';

export function mapScoreToVerdict(score) {
  const range = VERDICT_RANGES.find((r) => score >= r.min && score <= r.max);
  return range ? range.verdict : 'Moderately Healthy';
}
