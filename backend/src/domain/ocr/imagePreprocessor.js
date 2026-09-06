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
  // Smaller width = faster OCR on Render free tier (512MB). 1600px is enough for nutrition tables.
  const targetWidth = Math.min(Math.max(metadata.width || 0, 1400), 1800);

  const common = () =>
    sharp(imagePath)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: false })
      .grayscale();

  const variants = await Promise.all([
    common()
      .normalize()
      .sharpen({ sigma: 1 })
      .png()
      .toBuffer(),
    common()
      .normalize()
      .threshold(165)
      .sharpen()
      .png()
      .toBuffer(),
  ]);

  return [
    { name: 'normalized', buffer: variants[0] },
    { name: 'threshold', buffer: variants[1] },
  ];
}
