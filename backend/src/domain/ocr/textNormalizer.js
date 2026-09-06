/**
 * Normalize OCR text for parsing.
 */
export function normalizeOcrText(rawText) {
  if (!rawText) return "";

  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/(\d)\s+(\d)/g, "$1$2");

  // Remove common OCR artifacts and special characters — but keep colon for label parsing
  text = text
    .replace(/[\[\]{}()—––]/g, " ")
    .replace(/[«»""''`']/g, "'")
    .replace(/[•·●○]/g, " ")
    .replace(/[©®™]/g, " ")
    .replace(/[§¶]/g, " ")
    .replace(/[±×÷]/g, " ")
    .replace(/[¹²³]/g, " ")
    .replace(/[¼½¾]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/[\\\/]/g, " ")
    .replace(/[=+*]/g, " ")
    .replace(/[?]/g, " ")
    .replace(/[!]/g, " ");

  // Fix common OCR misreads before parsing — careful not to corrupt ingredients (e.g., sea salt)
  text = text
    .replace(/\b[tT]otai\b/g, "Total")
    .replace(/\b[Ss]od[i1l]um\b/g, "Sodium")
    .replace(/\b[Ss]od[i1l]urn\b/g, "Sodium")
    .replace(/\bPro\w*in\b/gi, "Protein")
    .replace(/\b[Pp]rotien\b/gi, "Protein")
    .replace(/\b[Ss]ug[ae]r\b/gi, "Sugar")
    .replace(/\b[Ss]ugars\b/gi, "Sugars")
    .replace(/\b[Ff]at\b/gi, "Fat")
    .replace(/\b[Ff]ibre\b/gi, "Fiber")
    .replace(/\b[Ff]ibre\b/gi, "Fiber")
    .replace(/\b[Cc]alor[i1]e?s\b/gi, "Calories")
    .replace(/\b[Cc]arbo\b/gi, "Carbohydrate")
    .replace(/\b[Ss]aturat\w*\b/gi, "Saturated")
    .replace(/\b[Cc]holest\w*\b/gi, "Cholesterol");

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
