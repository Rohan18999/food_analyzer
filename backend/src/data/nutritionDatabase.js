/**
 * Structured nutrition database for normal/day-to-day foods.
 * All values are per 100g (or per piece where noted) and are ESTIMATES.
 * Sources: USDA approximate values, adjusted for typical Indian preparations.
 *
 * Deterministic scaling: grams / 100 * per100g
 */

export const NUTRITION_DB = {
  // === South Indian ===
  'chicken biryani': {
    displayName: 'Chicken Biryani',
    category: 'Main Course',
    per100g: { calories: 180, protein: 7.5, carbs: 22, fat: 7, fiber: 1.5, sodium: 350, saturatedFat: 2.2, sugar: 1.2 },
    defaultGrams: 350, portions: { small: 200, medium: 350, large: 500 },
    pieceGrams: null,
    description: 'Spiced rice with chicken',
  },
  'veg biryani': {
    displayName: 'Veg Biryani',
    category: 'Main Course',
    per100g: { calories: 150, protein: 3.5, carbs: 23, fat: 5, fiber: 2, sodium: 300, saturatedFat: 1.2, sugar: 1.5 },
    defaultGrams: 350, portions: { small: 200, medium: 350, large: 500 },
  },
  'dosa': {
    displayName: 'Dosa',
    category: 'South Indian',
    per100g: { calories: 150, protein: 3, carbs: 24, fat: 4.5, fiber: 1, sodium: 280, saturatedFat: 1, sugar: 0.8 },
    defaultGrams: 100, portions: { small: 80, medium: 120, large: 180 },
    pieceGrams: 80, pieceLabel: 'dosa',
  },
  'masala dosa': {
    displayName: 'Masala Dosa',
    category: 'South Indian',
    per100g: { calories: 165, protein: 3.2, carbs: 22, fat: 6.5, fiber: 1.8, sodium: 310, saturatedFat: 1.5, sugar: 1 },
    defaultGrams: 150, portions: { small: 120, medium: 180, large: 250 },
    pieceGrams: 150, pieceLabel: 'dosa',
  },
  'idli': {
    displayName: 'Idli',
    category: 'South Indian',
    per100g: { calories: 110, protein: 3.5, carbs: 20, fat: 1.2, fiber: 1.2, sodium: 180, saturatedFat: 0.2, sugar: 0.5 },
    defaultGrams: 120, portions: { small: 80, medium: 120, large: 200 },
    pieceGrams: 40, pieceLabel: 'idli',
  },
  'sambar': {
    displayName: 'Sambar',
    category: 'South Indian',
    per100g: { calories: 65, protein: 2.5, carbs: 10, fat: 1.8, fiber: 2.5, sodium: 280, saturatedFat: 0.4, sugar: 2 },
    defaultGrams: 150, portions: { small: 100, medium: 150, large: 250 },
  },
  'coconut chutney': {
    displayName: 'Coconut Chutney',
    category: 'Side',
    per100g: { calories: 180, protein: 2, carbs: 8, fat: 15, fiber: 3, sodium: 320, saturatedFat: 10, sugar: 2 },
    defaultGrams: 40, portions: { small: 30, medium: 40, large: 60 },
  },
  'upma': {
    displayName: 'Upma',
    category: 'South Indian',
    per100g: { calories: 130, protein: 3, carbs: 20, fat: 4, fiber: 1.5, sodium: 300, saturatedFat: 1, sugar: 1 },
    defaultGrams: 200, portions: { small: 150, medium: 200, large: 300 },
  },
  'pongal': {
    displayName: 'Pongal',
    category: 'South Indian',
    per100g: { calories: 140, protein: 4, carbs: 20, fat: 4.5, fiber: 1.8, sodium: 260, saturatedFat: 1.8, sugar: 0.5 },
    defaultGrams: 200, portions: { small: 150, medium: 200, large: 300 },
  },

  // === North Indian / Staples ===
  'chapati': {
    displayName: 'Chapati',
    category: 'Staple',
    per100g: { calories: 290, protein: 8, carbs: 48, fat: 7, fiber: 6, sodium: 150, saturatedFat: 1.2, sugar: 1 },
    defaultGrams: 80, portions: { small: 40, medium: 80, large: 120 },
    pieceGrams: 40, pieceLabel: 'chapati',
  },
  'roti': {
    displayName: 'Roti',
    category: 'Staple',
    per100g: { calories: 290, protein: 8, carbs: 48, fat: 7, fiber: 6, sodium: 150, saturatedFat: 1.2, sugar: 1 },
    defaultGrams: 80, portions: { small: 40, medium: 80, large: 120 },
    pieceGrams: 40, pieceLabel: 'roti',
  },
  'naan': {
    displayName: 'Naan',
    category: 'Staple',
    per100g: { calories: 310, protein: 9, carbs: 45, fat: 10, fiber: 2, sodium: 380, saturatedFat: 3, sugar: 2 },
    defaultGrams: 100, portions: { small: 80, medium: 100, large: 150 },
    pieceGrams: 90, pieceLabel: 'naan',
  },
  'paratha': {
    displayName: 'Paratha',
    category: 'Staple',
    per100g: { calories: 280, protein: 6, carbs: 32, fat: 14, fiber: 3, sodium: 300, saturatedFat: 4, sugar: 1 },
    defaultGrams: 120, portions: { small: 80, medium: 120, large: 180 },
    pieceGrams: 80, pieceLabel: 'paratha',
  },
  'rice': {
    displayName: 'Steamed Rice',
    category: 'Staple',
    per100g: { calories: 130, protein: 2.5, carbs: 28, fat: 0.3, fiber: 0.4, sodium: 5, saturatedFat: 0.1, sugar: 0.1 },
    defaultGrams: 200, portions: { small: 120, medium: 200, large: 300 },
  },
  'dal': {
    displayName: 'Dal',
    category: 'Staple',
    per100g: { calories: 105, protein: 6, carbs: 14, fat: 2.5, fiber: 4, sodium: 220, saturatedFat: 0.5, sugar: 1 },
    defaultGrams: 150, portions: { small: 100, medium: 150, large: 250 },
  },
  'rajma': {
    displayName: 'Rajma Curry',
    category: 'Main Course',
    per100g: { calories: 120, protein: 6, carbs: 16, fat: 3.5, fiber: 5, sodium: 280, saturatedFat: 0.8, sugar: 1.2 },
    defaultGrams: 180, portions: { small: 120, medium: 180, large: 250 },
  },
  'chole': {
    displayName: 'Chole',
    category: 'Main Course',
    per100g: { calories: 135, protein: 6.5, carbs: 18, fat: 4, fiber: 5, sodium: 300, saturatedFat: 0.6, sugar: 2 },
    defaultGrams: 180, portions: { small: 120, medium: 180, large: 250 },
  },
  'chicken curry': {
    displayName: 'Chicken Curry',
    category: 'Main Course',
    per100g: { calories: 150, protein: 12, carbs: 6, fat: 9, fiber: 1, sodium: 340, saturatedFat: 2.5, sugar: 1 },
    defaultGrams: 200, portions: { small: 120, medium: 200, large: 300 },
  },
  'paneer curry': {
    displayName: 'Paneer Curry',
    category: 'Main Course',
    per100g: { calories: 180, protein: 8, carbs: 8, fat: 13, fiber: 1, sodium: 320, saturatedFat: 6, sugar: 2 },
    defaultGrams: 180, portions: { small: 120, medium: 180, large: 250 },
  },
  'raita': {
    displayName: 'Raita',
    category: 'Side',
    per100g: { calories: 60, protein: 2.5, carbs: 5, fat: 3, fiber: 0.5, sodium: 180, saturatedFat: 1.5, sugar: 3 },
    defaultGrams: 100, portions: { small: 60, medium: 100, large: 150 },
  },
  'curd': {
    displayName: 'Curd',
    category: 'Side',
    per100g: { calories: 60, protein: 3, carbs: 4, fat: 3.5, fiber: 0, sodium: 50, saturatedFat: 2, sugar: 3 },
    defaultGrams: 100, portions: { small: 60, medium: 100, large: 150 },
  },
  'pickle': {
    displayName: 'Pickle',
    category: 'Side',
    per100g: { calories: 120, protein: 1, carbs: 8, fat: 9, fiber: 2, sodium: 1200, saturatedFat: 1.5, sugar: 4 },
    defaultGrams: 20, portions: { small: 15, medium: 20, large: 30 },
  },

  // === Fruits & Salad ===
  'apple': {
    displayName: 'Apple',
    category: 'Fruit',
    per100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sodium: 1, saturatedFat: 0, sugar: 10 },
    defaultGrams: 150, portions: { small: 100, medium: 150, large: 200 },
    pieceGrams: 150, pieceLabel: 'apple',
  },
  'banana': {
    displayName: 'Banana',
    category: 'Fruit',
    per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sodium: 1, saturatedFat: 0.1, sugar: 12 },
    defaultGrams: 120, portions: { small: 80, medium: 120, large: 180 },
    pieceGrams: 120, pieceLabel: 'banana',
  },
  'orange': {
    displayName: 'Orange',
    category: 'Fruit',
    per100g: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sodium: 0, saturatedFat: 0, sugar: 9 },
    defaultGrams: 130, portions: { small: 100, medium: 130, large: 180 },
    pieceGrams: 130, pieceLabel: 'orange',
  },
  'fruit salad': {
    displayName: 'Fruit Salad',
    category: 'Fruit',
    per100g: { calories: 60, protein: 0.8, carbs: 15, fat: 0.3, fiber: 2, sodium: 2, saturatedFat: 0, sugar: 11 },
    defaultGrams: 200, portions: { small: 120, medium: 200, large: 300 },
  },
  'salad': {
    displayName: 'Green Salad',
    category: 'Salad',
    per100g: { calories: 25, protein: 1.5, carbs: 4, fat: 0.5, fiber: 2.5, sodium: 120, saturatedFat: 0.1, sugar: 2 },
    defaultGrams: 150, portions: { small: 80, medium: 150, large: 250 },
  },
  'vegetable salad': {
    displayName: 'Vegetable Salad',
    category: 'Salad',
    per100g: { calories: 35, protein: 1.8, carbs: 6, fat: 0.8, fiber: 2.8, sodium: 150, saturatedFat: 0.1, sugar: 3 },
    defaultGrams: 150, portions: { small: 80, medium: 150, large: 250 },
  },

  // === Western / Fast food ===
  'pizza': {
    displayName: 'Pizza',
    category: 'Fast Food',
    per100g: { calories: 260, protein: 10, carbs: 30, fat: 11, fiber: 1.5, sodium: 580, saturatedFat: 4.5, sugar: 3 },
    defaultGrams: 200, portions: { small: 120, medium: 200, large: 300 },
    pieceGrams: 100, pieceLabel: 'slice',
  },
  'burger': {
    displayName: 'Burger',
    category: 'Fast Food',
    per100g: { calories: 250, protein: 11, carbs: 24, fat: 12, fiber: 1.8, sodium: 480, saturatedFat: 4, sugar: 4 },
    defaultGrams: 180, portions: { small: 120, medium: 180, large: 250 },
    pieceGrams: 180, pieceLabel: 'burger',
  },
  'french fries': {
    displayName: 'French Fries',
    category: 'Fast Food',
    per100g: { calories: 310, protein: 3.5, carbs: 38, fat: 15, fiber: 3, sodium: 300, saturatedFat: 3.5, sugar: 0.5 },
    defaultGrams: 120, portions: { small: 80, medium: 120, large: 200 },
  },
  'pasta': {
    displayName: 'Pasta',
    category: 'Main Course',
    per100g: { calories: 160, protein: 5, carbs: 28, fat: 2.5, fiber: 2, sodium: 200, saturatedFat: 0.8, sugar: 1.5 },
    defaultGrams: 220, portions: { small: 150, medium: 220, large: 320 },
  },
  'white bread': {
    displayName: 'White Bread',
    category: 'Bakery',
    per100g: { calories: 265, protein: 9, carbs: 49, fat: 3.5, fiber: 2, sodium: 490, saturatedFat: 0.8, sugar: 5 },
    defaultGrams: 60, portions: { small: 30, medium: 60, large: 90 },
    pieceGrams: 30, pieceLabel: 'slice',
  },
  'sandwich': {
    displayName: 'Veg Sandwich',
    category: 'Fast Food',
    per100g: { calories: 180, protein: 5, carbs: 22, fat: 8, fiber: 2.5, sodium: 380, saturatedFat: 2, sugar: 3 },
    defaultGrams: 150, portions: { small: 100, medium: 150, large: 220 },
    pieceGrams: 150, pieceLabel: 'sandwich',
  },

  // === Others ===
  'khichdi': {
    displayName: 'Khichdi',
    category: 'Main Course',
    per100g: { calories: 110, protein: 4, carbs: 18, fat: 2.5, fiber: 2.5, sodium: 200, saturatedFat: 0.5, sugar: 0.8 },
    defaultGrams: 250, portions: { small: 150, medium: 250, large: 350 },
  },
  'poha': {
    displayName: 'Poha',
    category: 'Breakfast',
    per100g: { calories: 130, protein: 2.5, carbs: 22, fat: 3.5, fiber: 1.8, sodium: 250, saturatedFat: 0.8, sugar: 1.2 },
    defaultGrams: 180, portions: { small: 120, medium: 180, large: 250 },
  },
  'samosa': {
    displayName: 'Samosa',
    category: 'Snack',
    per100g: { calories: 320, protein: 5, carbs: 30, fat: 20, fiber: 3, sodium: 400, saturatedFat: 5, sugar: 2 },
    defaultGrams: 80, portions: { small: 50, medium: 80, large: 120 },
    pieceGrams: 50, pieceLabel: 'samosa',
  },
  'omelette': {
    displayName: 'Omelette',
    category: 'Breakfast',
    per100g: { calories: 150, protein: 10, carbs: 1.5, fat: 11, fiber: 0, sodium: 300, saturatedFat: 3, sugar: 0.5 },
    defaultGrams: 100, portions: { small: 60, medium: 100, large: 150 },
    pieceGrams: 60, pieceLabel: 'egg',
  },
  'boiled egg': {
    displayName: 'Boiled Egg',
    category: 'Breakfast',
    per100g: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0, sodium: 140, saturatedFat: 3, sugar: 0.5 },
    defaultGrams: 100, portions: { small: 50, medium: 100, large: 150 },
    pieceGrams: 50, pieceLabel: 'egg',
  },
  'chicken tikka': {
    displayName: 'Chicken Tikka',
    category: 'Main Course',
    per100g: { calories: 160, protein: 18, carbs: 4, fat: 8, fiber: 0.5, sodium: 380, saturatedFat: 2.5, sugar: 1 },
    defaultGrams: 150, portions: { small: 100, medium: 150, large: 220 },
  },
  'fish curry': {
    displayName: 'Fish Curry',
    category: 'Main Course',
    per100g: { calories: 130, protein: 14, carbs: 5, fat: 6, fiber: 0.8, sodium: 320, saturatedFat: 1.5, sugar: 1 },
    defaultGrams: 180, portions: { small: 120, medium: 180, large: 250 },
  },
  'curd rice': {
    displayName: 'Curd Rice',
    category: 'Main Course',
    per100g: { calories: 110, protein: 3, carbs: 16, fat: 3.5, fiber: 0.5, sodium: 150, saturatedFat: 1.8, sugar: 2 },
    defaultGrams: 250, portions: { small: 150, medium: 250, large: 350 },
  },
  'fried rice': {
    displayName: 'Fried Rice',
    category: 'Main Course',
    per100g: { calories: 170, protein: 4, carbs: 24, fat: 6, fiber: 1.2, sodium: 380, saturatedFat: 1.2, sugar: 1 },
    defaultGrams: 250, portions: { small: 150, medium: 250, large: 350 },
  },
};

export function normalizeFoodKey(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function findFoodEntry(name) {
  const key = normalizeFoodKey(name);
  if (NUTRITION_DB[key]) return { key, entry: NUTRITION_DB[key] };
  // fuzzy: contains
  const fuzzyKey = Object.keys(NUTRITION_DB).find(k => k.includes(key) || key.includes(k));
  if (fuzzyKey) return { key: fuzzyKey, entry: NUTRITION_DB[fuzzyKey] };
  return null;
}

export function listFoodNames() {
  return Object.keys(NUTRITION_DB);
}
