export function parseIngredients(ocrText = "") {
  const ingredientMatch = ocrText.match(
    /ingredients?\s*:?\s*([\s\S]{0,1500})/i
  );

  if (!ingredientMatch) {
    return {
      ingredients: [],
      ingredientsRaw: "",
    };
  }

  let raw = ingredientMatch[1];

  const stopWords = [
    "nutrition facts",
    "nutritional information",
    "best before",
    "manufactured",
    "distributed",
    "marketed",
    "allergen",
    "storage",
    "store in",
    "consume within",
    "net weight",
    "fssai",
    "customer care",
  ];

  for (const stop of stopWords) {
    const idx = raw.toLowerCase().indexOf(stop);
    if (idx !== -1) {
      raw = raw.substring(0, idx);
    }
  }

  raw = raw
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ingredients = raw
    .split(",")
    .map((item) => cleanIngredient(item))
    .filter(Boolean)
    .filter((item) => item.length > 2)
    .filter((item) => item.length < 80)
    .filter((item) => !looksLikeGarbage(item));

  return {
    ingredients,
    ingredientsRaw: raw,
  };
}

function cleanIngredient(item) {
  return item
    .replace(/[^\w\s()%\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeGarbage(text) {
  const specialRatio =
    (text.match(/[^a-zA-Z0-9\s]/g) || []).length /
    Math.max(text.length, 1);

  if (specialRatio > 0.25) return true;

  if (/\d{5,}/.test(text)) return true;

  if (/www|http|image id|alamy/i.test(text)) return true;

  return false;
}