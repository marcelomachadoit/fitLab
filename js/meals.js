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

/* ---------------------------------------------------------
   Refeições do usuário (meal_slots)
   --------------------------------------------------------- */

// Ícones aceitos pelo banco; a interface desenha o símbolo "i-<icon>".
const MEAL_SLOT_ICONS = ['sunrise', 'utensils', 'apple', 'moon', 'flame', 'bowl'];

// Ponto de partida de quem ainda não personalizou nada.
const DEFAULT_MEAL_SLOTS = [
  { name: 'Café da manhã', icon: 'sunrise' },
  { name: 'Almoço', icon: 'utensils' },
  { name: 'Lanche', icon: 'apple' },
  { name: 'Jantar', icon: 'moon' },
];

async function getMealSlots() {
  if (!hasSupabase()) return [];
  const { data, error } = await supabaseClient.from('meal_slots').select('*').order('position').order('id');
  if (error) throw error;
  return data;
}

async function createDefaultMealSlots() {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = DEFAULT_MEAL_SLOTS.map((slot, index) => ({ user_id: user.id, name: slot.name, icon: slot.icon, position: index }));
  const { data, error } = await supabaseClient.from('meal_slots').insert(rows).select('*');
  if (error) throw error;
  return data;
}

async function saveMealSlot(slot) {
  const user = await getCurrentUser();
  if (!user) return null;
  const payload = { name: slot.name, icon: slot.icon, position: slot.position, user_id: user.id };
  const query = slot.id
    ? supabaseClient.from('meal_slots').update(payload).eq('id', slot.id)
    : supabaseClient.from('meal_slots').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

// Apagar a refeição leva junto os registros dela (on delete cascade em meals.slot_id).
async function deleteMealSlot(slotId) {
  const { error } = await supabaseClient.from('meal_slots').delete().eq('id', slotId);
  if (error) throw error;
}

/* ---------------------------------------------------------
   Consumo do dia
   --------------------------------------------------------- */

async function getTodayMeals() {
  if (!hasSupabase()) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseClient.from('meals').select('*, foods(*)').eq('date', today).order('created_at');
  if (error) throw error;
  return data;
}

async function addMeal(foodId, quantity, slotId) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('meals')
    .insert({ user_id: user.id, food_id: foodId, quantity, slot_id: slotId })
    .select('*, foods(*)')
    .single();
  if (error) throw error;
  return data;
}

// Uma receita entra como vários registros: assim cada item continua editável em separado.
async function addRecipeMeals(items, slotId) {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = items.map((item) => ({ user_id: user.id, food_id: item.food_id, quantity: item.quantity, slot_id: slotId }));
  const { data, error } = await supabaseClient.from('meals').insert(rows).select('*, foods(*)');
  if (error) throw error;
  return data;
}

async function deleteMeal(mealId) {
  const { error } = await supabaseClient.from('meals').delete().eq('id', mealId);
  if (error) throw error;
}
