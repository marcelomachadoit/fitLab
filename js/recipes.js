// Receitas são combinações fixas de alimentos ("Almoço 1"), privadas de cada conta.

async function getRecipes() {
  if (!hasSupabase()) return [];
  const { data, error } = await supabaseClient
    .from('recipes')
    .select('id, name, recipe_items(id, quantity, food_id, foods(*))')
    .order('name');
  if (error) throw error;
  return data;
}

async function saveRecipe({ id = null, name, items }) {
  const user = await getCurrentUser();
  if (!user) return null;
  let recipeId = id;

  if (recipeId) {
    const { error } = await supabaseClient.from('recipes').update({ name }).eq('id', recipeId);
    if (error) throw error;
    const { error: clearError } = await supabaseClient.from('recipe_items').delete().eq('recipe_id', recipeId);
    if (clearError) throw clearError;
  } else {
    const { data, error } = await supabaseClient.from('recipes').insert({ user_id: user.id, name }).select('id').single();
    if (error) throw error;
    recipeId = data.id;
  }

  const rows = items.map((item) => ({ recipe_id: recipeId, food_id: item.food_id, quantity: item.quantity }));
  const { error } = await supabaseClient.from('recipe_items').insert(rows);
  if (error) {
    // Não deixa uma receita nova sem ingredientes quando a segunda gravação falha.
    if (!id) await supabaseClient.from('recipes').delete().eq('id', recipeId);
    throw error;
  }
  return recipeId;
}

async function deleteRecipe(recipeId) {
  const { error } = await supabaseClient.from('recipes').delete().eq('id', recipeId);
  if (error) throw error;
}

function calculateRecipeTotals(items) {
  return items.reduce((totals, item) => {
    const food = item.foods;
    if (!food) return totals;
    const nutrition = calculateNutrition(food, item.quantity);
    totals.calories += nutrition.calories;
    totals.protein += nutrition.protein;
    totals.carbohydrates += nutrition.carbohydrates;
    totals.fat += nutrition.fat;
    return totals;
  }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
}
