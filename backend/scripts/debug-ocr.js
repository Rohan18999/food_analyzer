import path from 'path';
import { extractProductFromImage } from '../src/domain/ocr/ocr.service.js';

const imagePath = process.argv[2];

if (!imagePath) {
  console.error('Usage: npm run debug:ocr -- /path/to/product-label.png');
  process.exit(1);
}

const result = await extractProductFromImage(path.resolve(imagePath));

if (!result.success) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

const data = result.data;

console.log('\n=== Extracted Fields ===');
console.log(JSON.stringify({
  productName: data.productName,
  extractionConfidence: data.extractionConfidence,
  ocrVariant: data.ocrVariant,
  ingredients: data.ingredients,
  nutritionFacts: data.nutritionFacts,
}, null, 2));

console.log('\n=== Raw OCR Text ===');
console.log(data.ocrRawText);
