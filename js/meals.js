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
  const rows = DEFAULT_MEAL_SLOTS.map((slot, index) => ({ user_id: user.id, name: t(slot.name), icon: slot.icon, position: index }));
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
   Datas — sempre no fuso do aparelho
   --------------------------------------------------------- */

// "2026-09-21" no horário local. Não usar toISOString(): ela converte para UTC e, no
// Brasil, qualquer registro depois das 21h cairia no dia seguinte.
function toDateKey(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function parseDateKey(key) {
  const [ano, mes, dia] = key.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function todayKey() {
  return toDateKey(new Date());
}

function addDaysToKey(key, dias) {
  const data = parseDateKey(key);
  data.setDate(data.getDate() + dias);
  return toDateKey(data);
}

// Semana de segunda a domingo: devolve a segunda-feira da semana que contém a data.
function weekStartKey(key) {
  const data = parseDateKey(key);
  const deslocamento = (data.getDay() + 6) % 7; // domingo (0) vira 6, segunda (1) vira 0
  data.setDate(data.getDate() - deslocamento);
  return toDateKey(data);
}

/* ---------------------------------------------------------
   Consumo
   --------------------------------------------------------- */

async function getMealsForDate(dateKey) {
  if (!hasSupabase()) return [];
  const { data, error } = await supabaseClient.from('meals').select('*, foods(*)').eq('date', dateKey).order('created_at');
  if (error) throw error;
  return data;
}

// Consumo de um intervalo, só com o necessário para somar calorias e macros por dia.
async function getMealsInRange(startKey, endKey) {
  if (!hasSupabase()) return [];
  const { data, error } = await supabaseClient
    .from('meals')
    .select('date, quantity, foods(calories, protein, carbohydrates, fat, serving_size)')
    .gte('date', startKey)
    .lte('date', endKey);
  if (error) throw error;
  return data;
}

// Dias com algum registro no intervalo — marca os dias no calendário.
async function getLoggedDates(startKey, endKey) {
  if (!hasSupabase()) return new Set();
  const { data, error } = await supabaseClient.from('meals').select('date').gte('date', startKey).lte('date', endKey);
  if (error) throw error;
  return new Set(data.map((row) => row.date));
}

// Soma calorias e macros por dia. Dias sem registro entram zerados, nunca ausentes.
function summarizeByDay(meals, startKey, dias = 7) {
  const resumo = [];
  for (let i = 0; i < dias; i += 1) {
    resumo.push({ date: addDaysToKey(startKey, i), calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  }
  const porData = new Map(resumo.map((dia) => [dia.date, dia]));
  meals.forEach((meal) => {
    const dia = porData.get(meal.date);
    if (!dia || !meal.foods) return;
    const n = calculateNutrition(meal.foods, meal.quantity);
    dia.calories += n.calories;
    dia.protein += n.protein;
    dia.carbohydrates += n.carbohydrates;
    dia.fat += n.fat;
  });
  return resumo;
}

async function addMeal(foodId, quantity, slotId, dateKey) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('meals')
    .insert({ user_id: user.id, food_id: foodId, quantity, slot_id: slotId, date: dateKey })
    .select('*, foods(*)')
    .single();
  if (error) throw error;
  return data;
}

// Uma receita entra como vários registros: assim cada item continua editável em separado.
async function addRecipeMeals(items, slotId, dateKey) {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = items.map((item) => ({ user_id: user.id, food_id: item.food_id, quantity: item.quantity, slot_id: slotId, date: dateKey }));
  const { data, error } = await supabaseClient.from('meals').insert(rows).select('*, foods(*)');
  if (error) throw error;
  return data;
}

async function deleteMeal(mealId) {
  const { error } = await supabaseClient.from('meals').delete().eq('id', mealId);
  if (error) throw error;
}
