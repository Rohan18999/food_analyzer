import mongoose from 'mongoose';

const nutrientSchema = new mongoose.Schema(
  {
    amount: Number,
    unit: { type: String, enum: ['g', 'mg'] },
    dailyValue: Number,
  },
  { _id: false }
);

const nutritionFactsSchema = new mongoose.Schema(
  {
    servingSize: String,
    servingsPerContainer: Number,
    calories: Number,
    totalFat: nutrientSchema,
    saturatedFat: nutrientSchema,
    transFat: nutrientSchema,
    cholesterol: nutrientSchema,
    sodium: nutrientSchema,
    totalCarbohydrates: nutrientSchema,
    dietaryFiber: nutrientSchema,
    totalSugars: nutrientSchema,
    addedSugars: nutrientSchema,
    protein: nutrientSchema,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    brand: String,
    ingredients: [String],
    ingredientsRaw: String,
    nutritionFacts: nutritionFactsSchema,
    imagePath: String,
    ocrRawText: String,
    extractionConfidence: Number,
  },
  { timestamps: true }
);

productSchema.index({ createdAt: -1 });

export const Product = mongoose.model('Product', productSchema);
