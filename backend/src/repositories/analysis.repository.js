import { Analysis } from '../db/schemas/analysis.schema.js';
import { isDatabaseConnected } from '../config/database.js';

export async function createAnalysis(analysisData) {
  if (!isDatabaseConnected()) return null;
  return Analysis.create(analysisData);
}

export async function findAnalysisById(id) {
  if (!isDatabaseConnected()) return null;
  return Analysis.findById(id).populate('productId');
}
