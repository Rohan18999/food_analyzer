import fs from 'fs';
import { recognizeFoodFromImage } from '../ai/foodRecognition/foodRecognition.service.js';
import { analyzeNormalFood, getSupportedFoods } from '../services/normalFood.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export async function recognizeFood(req, res, next) {
  if (!req.file) throw new AppError('No image file provided. Use field name "image".', 400, 'INVALID_IMAGE');
  const imagePath = req.file.path;
  try {
    const foods = await recognizeFoodFromImage(imagePath);
    res.status(200).json({ success: true, data: { foods } });
  } catch (error) {
    next(new AppError(error.message || 'Food recognition failed', 503, 'VISION_ERROR'));
  } finally {
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlink(imagePath, (err) => { if (err) logger.warn('Failed to delete temp upload', { imagePath }); });
    }
  }
}

export async function analyzeNormal(req, res, next) {
  try {
    let foods = req.body.foods;
    let portion = req.body.portion;

    // Support JSON string in multipart
    if (typeof foods === 'string') {
      try { foods = JSON.parse(foods); } catch {}
    }
    if (typeof portion === 'string') {
      try { portion = JSON.parse(portion); } catch {}
    }

    // Also support single foodName + portion fields
    if (!foods && req.body.foodName) {
      foods = [{ name: req.body.foodName, portion: portion || { grams: req.body.grams, size: req.body.size, quantity: req.body.quantity } }];
    }

    // If file uploaded alongside analyze (optional re-recognition) -> ignore, use provided foods
    if (req.file) {
      const p = req.file.path;
      if (fs.existsSync(p)) fs.unlink(p, () => {});
    }

    const result = await analyzeNormalFood({ foods, portion });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function listSupportedFoods(req, res) {
  const foods = getSupportedFoods();
  res.status(200).json({ success: true, data: { foods, count: foods.length } });
}
