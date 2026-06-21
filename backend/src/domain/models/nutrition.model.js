/**
 * @typedef {Object} NutrientValue
 * @property {number} amount
 * @property {'g' | 'mg'} unit
 * @property {number} [dailyValue]
 */

/**
 * @typedef {Object} NutritionFacts
 * @property {string} [servingSize]
 * @property {number} [servingsPerContainer]
 * @property {number} [calories]
 * @property {NutrientValue} [totalFat]
 * @property {NutrientValue} [saturatedFat]
 * @property {NutrientValue} [transFat]
 * @property {NutrientValue} [cholesterol]
 * @property {NutrientValue} [sodium]
 * @property {NutrientValue} [totalCarbohydrates]
 * @property {NutrientValue} [dietaryFiber]
 * @property {NutrientValue} [totalSugars]
 * @property {NutrientValue} [addedSugars]
 * @property {NutrientValue} [protein]
 */

export function createEmptyNutritionFacts() {
  return {};
}
