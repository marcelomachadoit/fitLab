const sampleFoods = [
  { id: 'banana', name: 'Banana prata', calories: 89, protein: 1.1, carbohydrates: 22.8, fat: 0.3, serving_size: 100 },
  { id: 'chicken', name: 'Peito de frango', calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, serving_size: 100 },
  { id: 'yogurt', name: 'Iogurte grego', calories: 97, protein: 9, carbohydrates: 3.6, fat: 5, serving_size: 100 },
];

// Base compartilhada + alimentos do próprio usuário: quem separa os dois é a RLS.
async function listAllFoods() {
  if (!hasSupabase()) return sampleFoods;
  const { data, error } = await supabaseClient.from('foods').select('*').order('name').limit(500);
  if (error) throw error;
  return data;
}

async function saveFood(food, foodId = null) {
  const user = await getCurrentUser();
  if (!user) return null;
  // A porção só existe para alimentos medidos em g/ml: é o que permite lançá-los por unidade.
  const portionAmount = food.base_unit !== 'un' && Number(food.portion_amount) > 0 ? Number(food.portion_amount) : null;
  const payload = {
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbohydrates: food.carbohydrates,
    fat: food.fat,
    base_unit: food.base_unit,
    serving_size: food.serving_size,
    portion_amount: portionAmount,
    portion_label: portionAmount ? t('1 unidade ({0} {1})', portionAmount, food.base_unit) : null,
    user_id: user.id,
  };
  const query = foodId
    ? supabaseClient.from('foods').update(payload).eq('id', foodId)
    : supabaseClient.from('foods').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

async function deleteFood(foodId) {
  const { error } = await supabaseClient.from('foods').delete().eq('id', foodId);
  if (error) throw error;
}
