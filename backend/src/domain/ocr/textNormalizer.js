/**
 * Normalize OCR text for parsing.
 */
export function normalizeOcrText(rawText) {
  if (!rawText) return "";

  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/(\d)\s+(\d)/g, "$1$2");

  // Remove common OCR artifacts and special characters
  text = text
    .replace(/[\[\]{}()—––]/g, " ")
    .replace(/[«»""''`']/g, "'")
    .replace(/[•·●○]/g, " ")
    .replace(/[©®™]/g, " ")
    .replace(/[§¶]/g, " ")
    .replace(/[±×÷]/g, " ")
    .replace(/[¹²³]/g, " ")
    .replace(/[¼½¾]/g, " ")
    .replace(/[;:]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/[\\\/]/g, " ")
    .replace(/[=+*]/g, " ")
    .replace(/[?]/g, " ")
    .replace(/[!]/g, " ");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function extractSection(text, startPattern, endPatterns = []) {
  const startMatch = text.match(startPattern);
  if (!startMatch) return null;

  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = text.length;

  for (const pattern of endPatterns) {
    const endMatch = text.slice(startIndex).match(pattern);
    if (endMatch && endMatch.index < endIndex - startIndex) {
      endIndex = startIndex + endMatch.index;
    }
  }

  return text.slice(startIndex, endIndex).trim();
}
