import { z } from 'zod';

export const FoodValidationSchema = z.object({
  isFood: z.boolean().describe('Whether image contains food'),
  confidence: z.number().min(0).max(1).describe('Confidence 0-1'),
  foodType: z.enum(['packaged_food', 'normal_food', 'non_food', 'uncertain']).describe('Food type category'),
  reason: z.string().optional().describe('Short reason for decision'),
});
