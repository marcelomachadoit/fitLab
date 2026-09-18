function showView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.target === viewName));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = '') {
  const toast = document.querySelector('.toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.className = 'toast'; }, 2800);
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);
}

function renderFoods(foods) {
  const list = document.querySelector('#food-list');
  list.innerHTML = foods.length ? foods.map((food) => `<button class="food-item" type="button" data-food-id="${food.id}"><span>🥗</span><strong>${food.name}<small>${formatNumber(food.calories)} kcal · ${food.serving_size || 100} g</small></strong><b>＋</b></button>`).join('') : '<p class="empty-state">Nenhum alimento encontrado.</p>';
  list.querySelectorAll('[data-food-id]').forEach((button) => button.addEventListener('click', () => showToast('Selecione “Adicionar” na tela inicial para registrar uma refeição.')));
}

function renderMeals(meals) {
  const list = document.querySelector('#meal-list');
  const types = { breakfast: ['Café da manhã', '☀', 'breakfast'], lunch: ['Almoço', '◒', 'lunch'], snack: ['Lanches', '✦', 'snack'], dinner: ['Jantar', '☾', 'dinner'] };
  const grouped = Object.entries(types).map(([type, [label, icon, className]]) => {
    const items = meals.filter((meal) => meal.meal_type === type);
    const calories = items.reduce((sum, meal) => sum + (meal.foods ? calculateNutrition(meal.foods, meal.quantity).calories : 0), 0);
    return `<article class="meal-card ${items.length ? '' : 'empty-meal'}"><div class="meal-icon ${className}">${icon}</div><div class="meal-info"><h3>${label}</h3><p>${items.length ? items.map((meal) => `${meal.foods.name} (${meal.quantity} g)`).join(', ') : 'Adicione sua próxima refeição'}</p></div>${items.length ? `<div class="meal-total"><strong>${calories}</strong><small>kcal</small></div><button class="more-button" data-delete-meal="${items[0].id}" aria-label="Excluir refeição">•••</button>` : '<button class="add-small" type="button" data-action="add-meal">+</button>'}</article>`;
  });
  list.innerHTML = grouped.join('');
  list.querySelectorAll('[data-delete-meal]').forEach((button) => button.addEventListener('click', async () => { try { await deleteMeal(button.dataset.deleteMeal); showToast('Refeição removida.'); await refreshDashboard(); } catch (error) { showToast(error.message, 'error'); } }));
  list.querySelectorAll('[data-action="add-meal"]').forEach((button) => button.addEventListener('click', () => showToast('A seleção de alimento será aberta na próxima atualização.')));
}

function renderNutrition(meals, goals = { calories: 2400, protein: 170, carbohydrates: 250, fat: 70 }) {
  const totals = meals.reduce((result, meal) => { const nutrition = meal.foods ? calculateNutrition(meal.foods, meal.quantity) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }; Object.keys(nutrition).forEach((key) => { result[key] += nutrition[key]; }); return result; }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const values = [['calories', totals.calories, goals.calories], ['protein', totals.protein, goals.protein], ['carbs', totals.carbohydrates, goals.carbohydrates], ['fats', totals.fat, goals.fat]];
  values.forEach(([name, value, goal]) => { const total = document.querySelector(`#${name}-total`); if (total) total.textContent = formatNumber(value); const goalElement = document.querySelector(`#${name}-goal`); if (goalElement) goalElement.textContent = formatNumber(goal); const percent = Math.min(100, Math.round((value / goal) * 100)); const progress = document.querySelector(`#${name}-progress`); if (progress) progress.style.width = `${percent}%`; const percentElement = document.querySelector(`#${name}-percent`); if (percentElement) percentElement.textContent = `${percent}% da meta`; });
  document.querySelector('#calorie-ring').style.background = `conic-gradient(var(--red) ${Math.min(100, Math.round((totals.calories / goals.calories) * 100))}%, rgba(255,255,255,.16) 0)`;
}

async function refreshDashboard() {
  const meals = await getTodayMeals();
  renderMeals(meals);
  renderNutrition(meals);
}

document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
document.querySelector('[data-action="profile"]').addEventListener('click', () => showView('perfil'));
document.querySelector('[data-action="logout"]').addEventListener('click', signOut);
document.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
document.querySelector('#auth-switch').addEventListener('click', () => openAuthModal(authMode === 'login' ? 'register' : 'login'));
document.querySelector('#food-search').addEventListener('input', async (event) => { try { renderFoods(await searchFoods(event.target.value)); } catch (error) { showToast(error.message, 'error'); } });
document.querySelector('#profile-form').addEventListener('submit', (event) => { event.preventDefault(); showToast('Perfil salvo nesta versão local.'); });
function showView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.target === viewName));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = '') {
  const toast = document.querySelector('.toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.className = 'toast'; }, 2800);
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);
}

function renderFoods(foods) {
  const list = document.querySelector('#food-list');
  list.innerHTML = foods.length ? foods.map((food) => `<button class="food-item" type="button" data-food-id="${food.id}"><span>🥗</span><strong>${food.name}<small>${formatNumber(food.calories)} kcal · ${food.serving_size || 100} g</small></strong><b>＋</b></button>`).join('') : '<p class="empty-state">Nenhum alimento encontrado.</p>';
  list.querySelectorAll('[data-food-id]').forEach((button) => button.addEventListener('click', () => showToast('Selecione “Adicionar” na tela inicial para registrar uma refeição.')));
}

function renderMeals(meals) {
  const list = document.querySelector('#meal-list');
  const types = { breakfast: ['Café da manhã', '☀', 'breakfast'], lunch: ['Almoço', '◒', 'lunch'], snack: ['Lanches', '✦', 'snack'], dinner: ['Jantar', '☾', 'dinner'] };
  const grouped = Object.entries(types).map(([type, [label, icon, className]]) => {
    const items = meals.filter((meal) => meal.meal_type === type);
    const calories = items.reduce((sum, meal) => sum + (meal.foods ? calculateNutrition(meal.foods, meal.quantity).calories : 0), 0);
    return `<article class="meal-card ${items.length ? '' : 'empty-meal'}"><div class="meal-icon ${className}">${icon}</div><div class="meal-info"><h3>${label}</h3><p>${items.length ? items.map((meal) => `${meal.foods.name} (${meal.quantity} g)`).join(', ') : 'Adicione sua próxima refeição'}</p></div>${items.length ? `<div class="meal-total"><strong>${calories}</strong><small>kcal</small></div><button class="more-button" data-delete-meal="${items[0].id}" aria-label="Excluir refeição">•••</button>` : '<button class="add-small" type="button" data-action="add-meal">+</button>'}</article>`;
  });
  list.innerHTML = grouped.join('');
  list.querySelectorAll('[data-delete-meal]').forEach((button) => button.addEventListener('click', async () => { try { await deleteMeal(button.dataset.deleteMeal); showToast('Refeição removida.'); await refreshDashboard(); } catch (error) { showToast(error.message, 'error'); } }));
  list.querySelectorAll('[data-action="add-meal"]').forEach((button) => button.addEventListener('click', () => showToast('A seleção de alimento será aberta na próxima atualização.')));
}

function renderNutrition(meals, goals = { calories: 2400, protein: 170, carbohydrates: 250, fat: 70 }) {
  const totals = meals.reduce((result, meal) => { const nutrition = meal.foods ? calculateNutrition(meal.foods, meal.quantity) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }; Object.keys(nutrition).forEach((key) => { result[key] += nutrition[key]; }); return result; }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const values = [['calories', totals.calories, goals.calories], ['protein', totals.protein, goals.protein], ['carbs', totals.carbohydrates, goals.carbohydrates], ['fats', totals.fat, goals.fat]];
  values.forEach(([name, value, goal]) => { const total = document.querySelector(`#${name}-total`); if (total) total.textContent = formatNumber(value); const goalElement = document.querySelector(`#${name}-goal`); if (goalElement) goalElement.textContent = formatNumber(goal); const percent = Math.min(100, Math.round((value / goal) * 100)); const progress = document.querySelector(`#${name}-progress`); if (progress) progress.style.width = `${percent}%`; const percentElement = document.querySelector(`#${name}-percent`); if (percentElement) percentElement.textContent = `${percent}% da meta`; });
  document.querySelector('#calorie-ring').style.background = `conic-gradient(var(--red) ${Math.min(100, Math.round((totals.calories / goals.calories) * 100))}%, rgba(255,255,255,.16) 0)`;
}

async function refreshDashboard() {
  const meals = await getTodayMeals();
  renderMeals(meals);
  renderNutrition(meals);
}

document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
document.querySelector('[data-action="profile"]').addEventListener('click', () => showView('perfil'));
document.querySelector('[data-action="logout"]').addEventListener('click', signOut);
document.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
document.querySelector('#auth-switch').addEventListener('click', () => openAuthModal(authMode === 'login' ? 'register' : 'login'));
document.querySelector('#food-search').addEventListener('input', async (event) => { try { renderFoods(await searchFoods(event.target.value)); } catch (error) { showToast(error.message, 'error'); } });
document.querySelector('#profile-form').addEventListener('submit', (event) => { event.preventDefault(); showToast('Perfil salvo nesta versão local.'); });
