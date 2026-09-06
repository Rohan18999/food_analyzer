import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { upload, handleMulterError } from '../middleware/upload.js';
import * as foodController from '../controllers/food.controller.js';

const router = Router();

router.get('/supported-foods', asyncHandler(foodController.listSupportedFoods));

router.post('/recognize', upload.single('image'), handleMulterError, asyncHandler(foodController.recognizeFood));

router.post('/analyze', asyncHandler(foodController.analyzeNormal));

export default router;
