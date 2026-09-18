function calculateNutrition(food, quantityInGrams) {
  const factor = quantityInGrams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Number((food.protein * factor).toFixed(1)),
    carbohydrates: Number((food.carbohydrates * factor).toFixed(1)),
    fat: Number((food.fat * factor).toFixed(1)),
  };
}
