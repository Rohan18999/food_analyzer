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
 * Speed-optimized for Render free tier (512MB, shared CPU): 900px JPEG
 * is ~28% fewer pixels than 1024px → ~25-30% faster Tesseract, still
 * enough for nutrition tables if user crops tightly (prompted in UI).
 */
const TARGET_WIDTH = 900;

async function getTargetWidth(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return Math.min(Math.max(metadata.width || 0, 640), TARGET_WIDTH);
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
    .jpeg({ quality: 72, mozjpeg: true })
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
    .jpeg({ quality: 72, mozjpeg: true })
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
