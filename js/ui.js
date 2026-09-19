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
    const icon = document.createElement('span');
    icon.textContent = '🥗';
    const details = document.createElement('strong');
    details.textContent = food.name;
    const nutrition = document.createElement('small');
    nutrition.textContent = `${formatNumber(food.calories)} kcal · ${food.serving_size || 100} g`;
    details.append(nutrition);
    const addIcon = document.createElement('b');
    addIcon.textContent = '＋';
    button.append(icon, details, addIcon);
    button.addEventListener('click', () => showToast('Selecione “Adicionar” na tela inicial para registrar uma refeição.'));
    list.append(button);
  });
}

function renderMeals(meals) {
  const list = document.querySelector('#meal-list');
  const types = { breakfast: ['Café da manhã', '☀', 'breakfast'], lunch: ['Almoço', '◒', 'lunch'], snack: ['Lanches', '✦', 'snack'], dinner: ['Jantar', '☾', 'dinner'] };
  list.replaceChildren();
  Object.entries(types).forEach(([type, [label, icon, className]]) => {
    const items = meals.filter((meal) => meal.meal_type === type);
    const calories = items.reduce((sum, meal) => sum + (meal.foods ? calculateNutrition(meal.foods, meal.quantity).calories : 0), 0);
    const card = document.createElement('article');
    card.className = `meal-card${items.length ? '' : ' empty-meal'}`;
    const mealIcon = document.createElement('div');
    mealIcon.className = `meal-icon ${className}`;
    mealIcon.textContent = icon;
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
      deleteButton.textContent = '•••';
      deleteButton.addEventListener('click', async () => { try { await deleteMeal(items[0].id); showToast('Refeição removida.'); await refreshDashboard(); } catch (error) { showToast('Não foi possível remover a refeição.'); } });
      card.append(total, deleteButton);
    } else {
      const addButton = document.createElement('button');
      addButton.className = 'add-small';
      addButton.type = 'button';
      addButton.textContent = '+';
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
document.querySelector('#forgot-password').addEventListener('click', () => openAuthModal('forgot'));
document.querySelector('#auth-password').addEventListener('input', (event) => updatePasswordRules(event.target.value));
document.querySelector('#food-search').addEventListener('input', async (event) => { try { renderFoods(await searchFoods(event.target.value)); } catch (error) { showToast('Não foi possível carregar os alimentos.', 'error'); } });
document.querySelector('#profile-form').addEventListener('submit', (event) => { event.preventDefault(); showToast('Perfil salvo nesta versão local.'); });
