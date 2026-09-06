import { createEmptyNutritionFacts } from "../../models/nutrition.model.js";

/**
 * Parse FDA-style nutrition facts from OCR text.
 */
export function parseNutritionFacts(ocrText) {
  const facts = createEmptyNutritionFacts();
  const text = normalizeForParsing(ocrText.replace(/\n/g, " "));
  const lines = ocrText.split("\n").map(normalizeForParsing).filter(Boolean);

  const servingSize = text.match(
    /serving\s*size\s*[:\s]*([^,]+?)(?:,|servings|calories|$)/i,
  );
  if (servingSize) facts.servingSize = cleanServingSize(servingSize[1].trim());

  const servings = text.match(
    /servings?\s*per\s*container\s*[:\s]*(\d+(?:\.\d+)?)/i,
  );
  if (servings) facts.servingsPerContainer = parseFloat(servings[1]);

  facts.calories =
    parseNumber(text, /calories\s*(\d+(?:\.\d+)?)/i) ??
    parseNumber(text, /energy\s*(\d+(?:\.\d+)?)\s*k?cal/i);

  facts.totalFat = parseNutrient(
    text,
    /(?:total\s*)?fat\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
    /(?:total\s*)?fat\s*\d+(?:\.\d+)?\s*g\s*(\d+)\s*%/i,
  );
  facts.saturatedFat = parseNutrient(
    text,
    /satur(?:ated|ates?)\s*fat\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
    /satur(?:ated|ates?)\s*fat\s*\d+(?:\.\d+)?\s*g\s*(\d+)\s*%/i,
  );
  facts.transFat = parseNutrient(
    text,
    /trans\s*fat\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
  );
  facts.cholesterol = parseNutrient(
    text,
    /cholesterol\s*(\d+(?:\.\d+)?)\s*mg/i,
    "mg",
    /cholesterol\s*\d+(?:\.\d+)?\s*mg\s*(\d+)\s*%/i,
  );
  facts.sodium = parseNutrient(
    text,
    /sodium\s*(\d+(?:\.\d+)?)\s*mg/i,
    "mg",
    /sodium\s*\d+(?:\.\d+)?\s*mg\s*(\d+)\s*%/i,
  );
  facts.totalCarbohydrates = parseNutrient(
    text,
    /(?:total\s*)?carbohydrate[s]?\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
    /(?:total\s*)?carbohydrate[s]?\s*\d+(?:\.\d+)?\s*g\s*(\d+)\s*%/i,
  );
  facts.dietaryFiber = parseNutrient(
    text,
    /(?:dietary\s*)?fib(?:er|re)\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
    /(?:dietary\s*)?fib(?:er|re)\s*\d+(?:\.\d+)?\s*g\s*(\d+)\s*%/i,
  );
  facts.totalSugars = parseNutrient(
    text,
    /(?:total\s*)?sugars?\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
  );
  facts.addedSugars = parseNutrient(
    text,
    /added\s*sugars?\s*(\d+(?:\.\d+)?)\s*g/i,
    "g",
    /added\s*sugars?\s*\d+(?:\.\d+)?\s*g\s*(\d+)\s*%/i,
  );
  facts.protein = parseNutrient(text, /protein\s*(\d+(?:\.\d+)?)\s*g/i, "g");

  applyLineFallbacks(facts, lines);

  return facts;
}

function normalizeForParsing(text) {
  return text
    .replace(/[|]/g, " ")
    .replace(/[;]+/g, ":")
    .replace(/\s+/g, " ")
    .replace(/\bk cal\b/gi, "kcal")
    .replace(/\bcarbo hydrates?\b/gi, "carbohydrate")
    .replace(/\bprotien\b/gi, "protein")
    .replace(/\bsuger\b/gi, "sugar")
    .replace(/\bof which\b/gi, "")
    .replace(/\bsodium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*9\b/gi, "Sodium $1 mg")
    .replace(/\bsalt\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b/gi, (m, n) => `Sodium ${parseFloat(n) * 1000} mg`)
    .trim();
}

function parseNumber(text, pattern) {
  const match = text.match(pattern);
  return match ? parseFloat(match[1]) : undefined;
}

function cleanServingSize(value) {
  return value.replace(/\((\d{1,3})9\)/g, "($1g)");
}

function parseNutrient(text, amountPattern, unit, dvPattern) {
  const match = text.match(amountPattern);
  if (!match) return undefined;

  const nutrient = {
    amount: parseFloat(match[1]),
    unit,
  };

  if (dvPattern) {
    const dvMatch = text.match(dvPattern);
    if (dvMatch) nutrient.dailyValue = parseInt(dvMatch[1], 10);
  }

  return nutrient;
}

function applyLineFallbacks(facts, lines) {
  const lineRules = [
    {
      key: "calories",
      aliases: [/calories/i, /energy/i],
      unit: "kcal",
      scalar: true,
    },
    { key: "totalFat", aliases: [/total fat/i, /^fat\b/i], unit: "g" },
    { key: "saturatedFat", aliases: [/satur/i], unit: "g" },
    { key: "transFat", aliases: [/trans fat/i], unit: "g" },
    { key: "cholesterol", aliases: [/cholesterol/i], unit: "mg" },
    { key: "sodium", aliases: [/sodium/i, /\bsalt\b/i], unit: "mg" },
    {
      key: "totalCarbohydrates",
      aliases: [/carbohydrate/i, /\bcarbs?\b/i],
      unit: "g",
    },
    { key: "dietaryFiber", aliases: [/fiber/i, /fibre/i], unit: "g" },
    {
      key: "totalSugars",
      aliases: [/total sugar/i, /^sugar/i, /sugars/i],
      unit: "g",
    },
    { key: "addedSugars", aliases: [/added sugar/i], unit: "g" },
    { key: "protein", aliases: [/protein/i], unit: "g" },
  ];

  for (const line of lines) {
    for (const rule of lineRules) {
      if (facts[rule.key] != null) continue;
      if (!rule.aliases.some((alias) => alias.test(line))) continue;

      const parsed = parseLineValue(line, rule.unit);
      if (parsed == null) continue;

      if (rule.scalar) {
        facts[rule.key] = parsed.amount;
      } else {
        facts[rule.key] = parsed;
      }
    }
  }
}

function parseLineValue(line, preferredUnit) {
  const unitPattern =
    preferredUnit === "mg"
      ? /(\d+(?:\.\d+)?)\s*(mg|g)?/gi
      : /(\d+(?:\.\d+)?)\s*(g|mg|kcal|cal)?/gi;
  const matches = [...line.matchAll(unitPattern)];
  if (!matches.length) return null;

  const matchWithUnit = matches.find((match) => {
    const unit = match[2]?.toLowerCase();
    if (!unit) return false;
    if (preferredUnit === "mg") return unit === "mg" || unit === "g";
    if (preferredUnit === "kcal") return unit === "kcal" || unit === "cal";
    return unit === preferredUnit;
  });

  const match = matchWithUnit || matches[matches.length - 1];
  const amount = parseFloat(match[1]);
  const foundUnit = match[2]?.toLowerCase();

  if (Number.isNaN(amount)) return null;

  if (preferredUnit === "mg" && foundUnit === "g") {
    return { amount: amount * 1000, unit: "mg" };
  }

  return {
    amount,
    unit: preferredUnit === "kcal" ? undefined : preferredUnit,
  };
}
