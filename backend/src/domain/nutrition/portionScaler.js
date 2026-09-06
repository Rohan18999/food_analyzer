import { findFoodEntry } from '../../data/nutritionDatabase.js';

export function resolveGrams(foodName, portion = {}) {
  const found = findFoodEntry(foodName);
  const entry = found?.entry;

  // Direct grams
  if (portion.grams != null && !isNaN(portion.grams)) {
    const g = Number(portion.grams);
    if (g > 0 && g <= 5000) return { grams: g, source: 'grams' };
  }
  // Quantity (countable)
  if (portion.quantity != null && portion.unit) {
    const qty = Number(portion.quantity);
    if (!isNaN(qty) && qty > 0) {
      if (entry?.pieceGrams) return { grams: qty * entry.pieceGrams, source: `quantity:${qty}x${entry.pieceLabel || 'piece'}` };
      // fallback: assume pieceGrams 50 if not in DB
      return { grams: qty * (entry?.defaultGrams || 100), source: `quantity:${qty}` };
    }
  }
  if (portion.quantity != null && !isNaN(portion.quantity) && entry?.pieceGrams) {
    const qty = Number(portion.quantity);
    return { grams: qty * entry.pieceGrams, source: `quantity:${qty}` };
  }
  // Cup/bowl volume - approximate
  if (portion.volume) {
    const vol = String(portion.volume).toLowerCase();
    const amount = Number(portion.volumeAmount || portion.quantity || 1);
    if (vol.includes('cup')) return { grams: amount * 150, source: `${amount} cup` };
    if (vol.includes('bowl')) return { grams: amount * 200, source: `${amount} bowl` };
    if (vol.includes('plate')) return { grams: amount * 300, source: `${amount} plate` };
  }
  // Size preset
  if (portion.size && entry?.portions) {
    const size = String(portion.size).toLowerCase();
    if (entry.portions[size]) return { grams: entry.portions[size], source: `size:${size}` };
  }
  if (portion.size) {
    const map = { small: 120, medium: 200, large: 320 };
    const s = String(portion.size).toLowerCase();
    if (map[s]) return { grams: map[s], source: `size:${s} (fallback)` };
  }

  // Fallback
  const fallback = entry?.defaultGrams || 200;
  return { grams: fallback, source: 'default' };
}

export function scaleNutrition(per100g, grams) {
  const factor = grams / 100;
  const round1 = (v) => Math.round(v * 10) / 10;
  return {
    calories: Math.round(per100g.calories * factor),
    protein: { amount: round1(per100g.protein * factor), unit: 'g' },
    totalCarbohydrates: { amount: round1(per100g.carbs * factor), unit: 'g' },
    totalFat: { amount: round1(per100g.fat * factor), unit: 'g' },
    dietaryFiber: { amount: round1(per100g.fiber * factor), unit: 'g' },
    sodium: { amount: round1(per100g.sodium * factor), unit: 'mg' },
    saturatedFat: { amount: round1(per100g.saturatedFat * factor), unit: 'g' },
    totalSugars: { amount: round1(per100g.sugar * factor), unit: 'g' },
    // aliases for health engine compatibility
    carbs: per100g.carbs * factor,
    fat: per100g.fat * factor,
  };
}

/**
 * Build estimated nutrition facts compatible with healthScoreEngine input.
 * Returns both detailed nutritionFacts and summary for LLM.
 */
export function buildEstimatedNutrition(foodName, portion) {
  const found = findFoodEntry(foodName);
  if (!found) return null;
  const { grams, source } = resolveGrams(foodName, portion);
  const scaled = scaleNutrition(found.entry.per100g, grams);

  const nutritionFacts = {
    servingSize: `${grams}g (${source})`,
    calories: scaled.calories,
    protein: scaled.protein,
    totalCarbohydrates: scaled.totalCarbohydrates,
    totalFat: scaled.totalFat,
    dietaryFiber: scaled.dietaryFiber,
    sodium: scaled.sodium,
    saturatedFat: scaled.saturatedFat,
    totalSugars: scaled.totalSugars,
  };

  const summary = {
    foodName: found.entry.displayName,
    matchedKey: found.key,
    grams,
    portionSource: source,
    per100g: found.entry.per100g,
    calories: scaled.calories,
    protein: scaled.protein.amount,
    carbs: scaled.totalCarbohydrates.amount,
    fat: scaled.totalFat.amount,
    fiber: scaled.dietaryFiber.amount,
    sodium: scaled.sodium.amount,
    saturatedFat: scaled.saturatedFat.amount,
    sugar: scaled.totalSugars.amount,
    isEstimated: true,
  };

  return { nutritionFacts, summary, entry: found.entry };
}

/**
 * For multiple foods (thali/meal), aggregate.
 */
export function aggregateNutrition(items) {
  // items: [{ foodName, portion }]
  const parts = items.map(({ foodName, portion }) => buildEstimatedNutrition(foodName, portion)).filter(Boolean);
  if (!parts.length) return null;

  const totalGrams = parts.reduce((s, p) => s + p.summary.grams, 0);
  const aggFacts = {
    servingSize: `${totalGrams}g total (${parts.length} items)`,
    calories: parts.reduce((s, p) => s + p.nutritionFacts.calories, 0),
    protein: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.protein.amount, 0)), unit: 'g' },
    totalCarbohydrates: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.totalCarbohydrates.amount, 0)), unit: 'g' },
    totalFat: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.totalFat.amount, 0)), unit: 'g' },
    dietaryFiber: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.dietaryFiber.amount, 0)), unit: 'g' },
    sodium: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.sodium.amount, 0)), unit: 'mg' },
    saturatedFat: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.saturatedFat.amount, 0)), unit: 'g' },
    totalSugars: { amount: round1(parts.reduce((s, p) => s + p.nutritionFacts.totalSugars.amount, 0)), unit: 'g' },
  };

  return { parts, aggFacts, totalGrams };
}

function round1(v) { return Math.round(v * 10) / 10; }
