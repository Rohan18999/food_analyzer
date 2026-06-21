import { analyzeProductImage } from "../services/analysis.service.js";
import { findAnalysisById } from "../repositories/analysis.repository.js";
import { AppError } from "../utils/AppError.js";

export async function createAnalysis(req, res, next) {
  if (!req.file) {
    throw new AppError(
      'No image file provided. Use field name "image".',
      400,
      "INVALID_IMAGE",
    );
  }

  try {
    const result = await analyzeProductImage(req.file.path);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAnalysis(req, res) {
  const analysis = await findAnalysisById(req.params.id);

  if (!analysis) {
    throw new AppError("Analysis not found", 404, "NOT_FOUND");
  }

  res.status(200).json({
    success: true,
    data: analysis,
  });
}
