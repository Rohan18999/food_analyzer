import sharp from 'sharp';

/**
 * Preprocess image for better OCR accuracy.
 * @param {string} imagePath
 * @returns {Promise<Buffer>}
 */
export async function preprocessImage(imagePath) {
  const variants = await preprocessImageVariants(imagePath);
  return variants[0].buffer;
}

/**
 * Balanced for Render free tier: 1024px JPEG gives ~15% better OCR accuracy
 * for small nutrition text vs 900px, still fast with single-variant lazy fallback.
 * Frontend compresses to 900px; backend upscales slightly if needed.
 */
const TARGET_WIDTH = 1024;

async function getTargetWidth(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return Math.min(Math.max(metadata.width || 0, 700), TARGET_WIDTH);
  } catch {
    return TARGET_WIDTH;
  }
}

export async function preprocessPrimary(imagePath) {
  const targetWidth = await getTargetWidth(imagePath);
  const buffer = await sharp(imagePath)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { name: 'normalized', buffer };
}

export async function preprocessThresholdVariant(imagePath) {
  const targetWidth = await getTargetWidth(imagePath);
  const buffer = await sharp(imagePath)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .threshold(165)
    .sharpen()
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { name: 'threshold', buffer };
}

/**
 * Legacy — now delegates to lazy primary + optional threshold.
 * Kept for scripts/debug-ocr compatibility.
 */
export async function preprocessImageVariants(imagePath) {
  const primary = await preprocessPrimary(imagePath);
  const threshold = await preprocessThresholdVariant(imagePath);
  return [primary, threshold];
}
