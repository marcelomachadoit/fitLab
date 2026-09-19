const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const THEME_KEY = 'fitlab-theme';

function createIcon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function toggleTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = document.documentElement.dataset.theme || (prefersDark ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  showToast(next === 'dark' ? 'Tema escuro ativado.' : 'Tema claro ativado.');
}

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
  list.replaceChildren();
  if (!foods.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Nenhum alimento encontrado.';
    list.append(emptyState);
    return;
  }
  foods.forEach((food) => {
    const button = document.createElement('button');
    button.className = 'food-item';
    button.type = 'button';
    button.dataset.foodId = String(food.id);

    const thumb = document.createElement('span');
    thumb.className = 'food-thumb';
    thumb.append(createIcon('i-apple'));

    const body = document.createElement('span');
    body.className = 'food-body';
    const name = document.createElement('strong');
    name.textContent = food.name;
    const unit = food.base_unit === 'ml' ? 'ml' : 'g';
    const nutrition = document.createElement('small');
    nutrition.textContent = `${formatNumber(food.calories)} kcal · ${food.serving_size || 100} ${unit}${food.portion_label ? ` · ${food.portion_label}` : ''}`;
    const macros = document.createElement('span');
    macros.className = 'food-macros';
    [['P', food.protein], ['C', food.carbohydrates], ['G', food.fat]].forEach(([label, value]) => {
      const chip = document.createElement('span');
      const key = document.createElement('b');
      key.textContent = label;
      chip.append(key, document.createTextNode(` ${formatNumber(value)} g`));
      macros.append(chip);
    });
    body.append(name, nutrition, macros);

    const addIcon = document.createElement('span');
    addIcon.className = 'food-add';
    addIcon.append(createIcon('i-plus'));

    button.append(thumb, body, addIcon);
    button.addEventListener('click', () => showToast('Selecione “Adicionar” na tela inicial para registrar uma refeição.'));
    list.append(button);
  });
}

function renderMeals(meals) {
  const list = document.querySelector('#meal-list');
  const types = {
    breakfast: ['Café da manhã', 'i-sunrise', 'breakfast'],
    lunch: ['Almoço', 'i-utensils', 'lunch'],
    snack: ['Lanches', 'i-apple', 'snack'],
    dinner: ['Jantar', 'i-moon', 'dinner'],
  };
  list.replaceChildren();
  Object.entries(types).forEach(([type, [label, icon, className]]) => {
    const items = meals.filter((meal) => meal.meal_type === type);
    const calories = items.reduce((sum, meal) => sum + (meal.foods ? calculateNutrition(meal.foods, meal.quantity).calories : 0), 0);
    const card = document.createElement('article');
    card.className = `meal-card${items.length ? '' : ' empty-meal'}`;
    const mealIcon = document.createElement('div');
    mealIcon.className = `meal-icon ${className}`;
    mealIcon.append(createIcon(icon));
    const mealInfo = document.createElement('div');
    mealInfo.className = 'meal-info';
    const heading = document.createElement('h3');
    heading.textContent = label;
    const description = document.createElement('p');
    description.textContent = items.length ? items.map((meal) => `${meal.foods.name} (${meal.quantity} g)`).join(', ') : 'Adicione sua próxima refeição';
    mealInfo.append(heading, description);
    card.append(mealIcon, mealInfo);
    if (items.length) {
      const total = document.createElement('div');
      total.className = 'meal-total';
      const caloriesValue = document.createElement('strong');
      caloriesValue.textContent = calories;
      const caloriesUnit = document.createElement('small');
      caloriesUnit.textContent = 'kcal';
      total.append(caloriesValue, caloriesUnit);
      const deleteButton = document.createElement('button');
      deleteButton.className = 'more-button';
      deleteButton.type = 'button';
      deleteButton.dataset.deleteMeal = String(items[0].id);
      deleteButton.setAttribute('aria-label', 'Excluir refeição');
      deleteButton.append(createIcon('i-trash'));
      deleteButton.addEventListener('click', async () => { try { await deleteMeal(items[0].id); showToast('Refeição removida.'); await refreshDashboard(); } catch (error) { showToast('Não foi possível remover a refeição.', 'error'); } });
      card.append(total, deleteButton);
    } else {
      const addButton = document.createElement('button');
      addButton.className = 'add-small';
      addButton.type = 'button';
      addButton.setAttribute('aria-label', `Adicionar ${label}`);
      addButton.append(createIcon('i-plus'));
      addButton.addEventListener('click', () => showToast('A seleção de alimento será aberta na próxima atualização.'));
      card.append(addButton);
    }
    list.append(card);
  });
}

function renderNutrition(meals, goals = { calories: 2400, protein: 170, carbohydrates: 250, fat: 70 }) {
  const totals = meals.reduce((result, meal) => { const nutrition = meal.foods ? calculateNutrition(meal.foods, meal.quantity) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }; Object.keys(nutrition).forEach((key) => { result[key] += nutrition[key]; }); return result; }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  const values = [['calories', totals.calories, goals.calories], ['protein', totals.protein, goals.protein], ['carbs', totals.carbohydrates, goals.carbohydrates], ['fats', totals.fat, goals.fat]];
  values.forEach(([name, value, goal]) => { const total = document.querySelector(`#${name}-total`); if (total) total.textContent = formatNumber(value); const goalElement = document.querySelector(`#${name}-goal`); if (goalElement) goalElement.textContent = formatNumber(goal); const percent = Math.min(100, Math.round((value / goal) * 100)); const progress = document.querySelector(`#${name}-progress`); if (progress) progress.style.width = `${percent}%`; const percentElement = document.querySelector(`#${name}-percent`); if (percentElement) percentElement.textContent = `${percent}% da meta`; });

  const caloriePercent = Math.min(100, Math.round((totals.calories / goals.calories) * 100));
  const ring = document.querySelector('#calorie-ring-progress');
  if (ring) ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - caloriePercent / 100));
  const remaining = document.querySelector('#calories-remaining');
  if (remaining) remaining.textContent = `${formatNumber(Math.max(0, goals.calories - totals.calories))} kcal`;
  const percentLabel = document.querySelector('#calories-share');
  if (percentLabel) percentLabel.textContent = `${caloriePercent}%`;
}

async function refreshDashboard() {
  const meals = await getTodayMeals();
  renderMeals(meals);
  renderNutrition(meals);
}

applyTheme(getStoredTheme());

document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
document.querySelectorAll('[data-action="add-meal"]').forEach((button) => button.addEventListener('click', () => { showView('alimentos'); document.querySelector('#food-search').focus(); }));
document.querySelector('[data-action="theme"]').addEventListener('click', toggleTheme);
document.querySelector('[data-action="profile"]').addEventListener('click', () => showView('perfil'));
document.querySelector('[data-action="logout"]').addEventListener('click', signOut);
document.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
document.querySelector('#auth-switch').addEventListener('click', () => openAuthModal(authMode === 'login' ? 'register' : 'login'));
document.querySelector('#forgot-password').addEventListener('click', () => openAuthModal('forgot'));
document.querySelector('#auth-password').addEventListener('input', (event) => updatePasswordRules(event.target.value));
document.querySelector('#food-search').addEventListener('input', async (event) => { try { renderFoods(await searchFoods(event.target.value)); } catch (error) { showToast('Não foi possível carregar os alimentos.', 'error'); } });
document.querySelector('#profile-form').addEventListener('submit', (event) => { event.preventDefault(); showToast('Perfil salvo nesta versão local.'); });
window.addEventListener('scroll', () => { document.querySelector('.topbar').classList.toggle('is-stuck', window.scrollY > 8); }, { passive: true });
