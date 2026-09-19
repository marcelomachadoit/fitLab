// Os valores de um alimento valem para serving_size na unidade dele (100 g, 250 ml, 1 unidade...).
// A conversão para a quantidade consumida é sempre proporcional a essa base.
function calculateNutrition(food, quantity) {
  const base = Number(food.serving_size) > 0 ? Number(food.serving_size) : 100;
  const factor = quantity / base;
  return {
    calories: Math.round(food.calories * factor),
    protein: Number((food.protein * factor).toFixed(1)),
    carbohydrates: Number((food.carbohydrates * factor).toFixed(1)),
    fat: Number((food.fat * factor).toFixed(1)),
  };
}

async function getTodayMeals() {
  if (!hasSupabase()) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseClient.from('meals').select('*, foods(*)').eq('date', today).order('created_at');
  if (error) throw error;
  return data;
}

async function addMeal(food, quantity, mealType) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient.from('meals').insert({ user_id: user.id, food_id: food.id, quantity, meal_type: mealType }).select('*, foods(*)').single();
  if (error) throw error;
  return data;
}

async function deleteMeal(mealId) {
  const { error } = await supabaseClient.from('meals').delete().eq('id', mealId);
  if (error) throw error;
}
