/**
 * Extract product name from OCR text (typically above nutrition facts).
 */
export function parseProductName(ocrText) {
  const lines = ocrText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const nutritionIndex = lines.findIndex((line) =>
    /nutrition\s*facts|nutritional\s*information|nutrition\s*information|ingredients/i.test(
      line,
    ),
  );

  const candidateLines =
    nutritionIndex > 0 ? lines.slice(0, nutritionIndex) : lines.slice(0, 3);

  // Score each line by likelihood of being a product name
  const scored = candidateLines.map((line) => ({
    line,
    score: scoreProductNameLine(line),
  }));

  // Filter out lines with negative scores (likely not product names)
  const filtered = scored.filter((item) => item.score > 0);

  if (filtered.length === 0) return "Product";

  // Sort by score descending and take the best match
  filtered.sort((a, b) => b.score - a.score);

  // Only use the result if it has a reasonably high score
  if (filtered[0].score < 20) {
    return "Product";
  }

  const rawName = filtered[0].line;
  return cleanProductName(rawName);
}

function scoreProductNameLine(line) {
  let score = 0;

  // Penalize lines that start with common non-product patterns
  if (
    /^(serving|amount|per|daily|value|percent|manufactured|marketed|packed|address|mfg|batch|license|lic|fssai|net|weight|volume|mrp|n\s*ns|district)/i.test(
      line,
    )
  ) {
    return -100;
  }

  // Penalize address/license patterns
  if (
    /(kolkata|mumbai|delhi|pune|bangalore|chennai|hyderabad|india|plot no|sector|pvt|ltd|fssai|pin|road|street|distributed|manufactured|district|state|tel|email|www|package|best before|expiry|use by|packaged by)/i.test(
      line,
    )
  ) {
    return -100;
  }

  // Penalize license numbers
  if (/lic\s*no|license\s*no|fssai\s*no|batch\s*no/i.test(line)) {
    return -100;
  }

  // Penalize pin codes
  if (/\b\d{6}\b/.test(line)) {
    return -100;
  }

  // Penalize state code + pin code pattern
  if (/\b[A-Z]{2}\s*\d{6}\b/.test(line)) {
    return -100;
  }

  // Penalize lines starting with digits
  if (/^\d/.test(line)) {
    return -100;
  }

  // Penalize state codes alone
  if (/^[A-Z]{2,3}\s*$/.test(line)) {
    return -100;
  }

  // Penalize state codes with space
  if (/^[A-Z]{2}\s+[A-Z]{2}\s*$/.test(line)) {
    return -100;
  }

  // Require at least one letter
  if (!/[a-z]/i.test(line)) {
    return -100;
  }

  // Penalize lines with too many special characters
  const specialCharRatio =
    (line.match(/[^a-zA-Z0-9\s]/g) || []).length / line.length;
  if (specialCharRatio > 0.3) {
    return -100;
  }

  // Base score for passing all filters
  score += 10;

  // Bonus for lines that look like food products
  if (
    /(biscuit|cookie|chips|cracker|snack|cereal|bread|milk|juice|soda|water|tea|coffee|chocolate|candy|ice cream|yogurt|cheese|butter|oil|sauce|pasta|rice|noodles|soup|jam|honey|sugar|salt|spice|flour|oats|nuts|dried fruit)/i.test(
      line,
    )
  ) {
    score += 20;
  }

  // Bonus for brand-like patterns (capitalized words)
  const words = line.split(/\s+/);
  const capitalizedWords = words.filter((word) => /^[A-Z][a-z]/.test(word));
  if (capitalizedWords.length >= 2) {
    score += 15;
  }

  // Bonus for reasonable length (not too short, not too long)
  if (line.length >= 3 && line.length <= 40) {
    score += 10;
  }

  // Penalize very long lines
  if (line.length > 60) {
    score -= 10;
  }

  return score;
}

function cleanProductName(name) {
  // Remove all special characters except letters, numbers, spaces, hyphens, and apostrophes
  let cleaned = name.replace(/[^a-zA-Z0-9\s\-']/g, " ");
  // Remove any remaining standalone special characters
  cleaned = cleaned.replace(/\s[\W_]\s/g, " ");
  // Normalize multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned.trim().slice(0, 120);
}
