import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { upload, handleMulterError } from '../middleware/upload.js';
import * as analysisController from '../controllers/analysis.controller.js';

const router = Router();

router.post(
  '/',
  upload.single('image'),
  handleMulterError,
  asyncHandler(analysisController.createAnalysis)
);

router.get('/:id', asyncHandler(analysisController.getAnalysis));

export default router;
