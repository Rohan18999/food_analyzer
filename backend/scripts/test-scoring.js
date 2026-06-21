import { calculateHealthScore } from '../src/domain/scoring/healthScoreEngine.js';
import { parseNutritionFacts } from '../src/domain/ocr/parsers/nutritionParser.js';
import { parseIngredients } from '../src/domain/ocr/parsers/ingredientsParser.js';
import { parseProductName } from '../src/domain/ocr/parsers/productNameParser.js';

const sampleOcrText = `
Organic Granola Bar
Chocolate Chip

Nutrition Facts
Serving Size 1 bar (40g)
Servings Per Container 6
Calories 180
Total Fat 7g 9%
Saturated Fat 3g 15%
Trans Fat 0g
Cholesterol 0mg 0%
Sodium 120mg 5%
Total Carbohydrate 28g 10%
Dietary Fiber 3g 11%
Total Sugars 12g
Added Sugars 10g 20%
Protein 4g

Ingredients: Whole grain oats, honey, chocolate chips (sugar, cocoa butter),
soy lecithin, natural flavor, sea salt.
`;

console.log('=== Parser Test ===');
console.log('Product:', parseProductName(sampleOcrText));
console.log('Ingredients:', parseIngredients(sampleOcrText).ingredients);

const nutrition = parseNutritionFacts(sampleOcrText);
console.log('Nutrition:', JSON.stringify(nutrition, null, 2));

console.log('\n=== Scoring Test ===');
const parsedIngredients = parseIngredients(sampleOcrText).ingredients;
const result = calculateHealthScore({
  nutritionFacts: nutrition,
  ingredients: parsedIngredients,
});
console.log(JSON.stringify(result, null, 2));
