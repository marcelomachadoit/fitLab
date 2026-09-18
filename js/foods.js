const sampleFoods = [
  { id: 'banana', name: 'Banana prata', calories: 89, protein: 1.1, carbohydrates: 22.8, fat: 0.3, serving_size: 100 },
  { id: 'chicken', name: 'Peito de frango', calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, serving_size: 100 },
  { id: 'yogurt', name: 'Iogurte grego', calories: 97, protein: 9, carbohydrates: 3.6, fat: 5, serving_size: 100 },
];

async function searchFoods(searchTerm = '') {
  if (!hasSupabase()) return sampleFoods.filter((food) => food.name.toLowerCase().includes(searchTerm.toLowerCase()));
  let query = supabaseClient.from('foods').select('*').order('name').limit(30);
  if (searchTerm) query = query.ilike('name', `%${searchTerm}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
