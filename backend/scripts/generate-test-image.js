import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, 'fixtures/sample-label.png');

const labelText = `Organic Granola Bar
Chocolate Chip

Nutrition Facts
Serving Size 1 bar (40g)
Servings Per Container 6
Calories 180
Total Fat 7g
Saturated Fat 3g
Sodium 120mg
Total Carbohydrate 28g
Dietary Fiber 3g
Total Sugars 12g
Added Sugars 10g
Protein 4g

Ingredients: Whole grain oats, honey, chocolate chips,
soy lecithin, natural flavor, sea salt.`;

const lines = labelText.split('\n');
const lineHeight = 28;
const height = lines.length * lineHeight + 40;
const width = 500;

const textElements = lines
  .map((line, i) => `<text x="20" y="${30 + i * lineHeight}" font-family="Arial" font-size="18" fill="black">${escapeXml(line)}</text>`)
  .join('\n');

const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  ${textElements}
</svg>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(outputPath);
console.log(`Test image written to ${outputPath}`);

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
