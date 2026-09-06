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
 * Nutrition labels vary a lot: glossy packs, low contrast, table grids, and
 * angled photos. Running a few cheap preprocessing variants lets us choose the
 * OCR pass that extracts the most useful nutrition fields.
 *
 * @param {string} imagePath
 * @returns {Promise<Array<{ name: string, buffer: Buffer }>>}
 */
export async function preprocessImageVariants(imagePath) {
  const base = sharp(imagePath).rotate();
  const metadata = await base.metadata();
  // Optimized for Render free tier (512MB, shared CPU): 1200px is enough for
  // nutrition tables and ~40% faster OCR vs 1600-1800px. JPEG @80% quality
  // is ~5x smaller than PNG and tesseract accuracy is nearly identical.
  const targetWidth = Math.min(Math.max(metadata.width || 0, 1000), 1200);

  const common = () =>
    sharp(imagePath)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: false })
      .grayscale();

  // Generate cheaper JPEG variants; threshold variant is fallback-only now
  // so we return normalized first and let ocr.service fallback sequentially.
  const variants = await Promise.all([
    common()
      .normalize()
      .sharpen({ sigma: 1 })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer(),
    common()
      .normalize()
      .threshold(165)
      .sharpen()
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer(),
  ]);

  return [
    { name: 'normalized', buffer: variants[0] },
    { name: 'threshold', buffer: variants[1] },
  ];
}
