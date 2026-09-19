const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const THEME_KEY = 'fitlab-theme';
const FOOD_PAGE_SIZE = 60;

let foodCatalog = [];
let editingFoodId = null;
let recipeDraft = { id: null, items: [] };
let recipeQuantityTouched = false;

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

function createIconButton(icon, className, label, onClick) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(createIcon(icon));
  button.addEventListener('click', onClick);
  return button;
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

function baseUnitOf(food) {
  const unit = food && food.base_unit;
  if (unit === 'ml') return 'ml';
  if (unit === 'un') return 'un';
  return 'g';
}

function baseAmountOf(food) {
  const amount = Number(food && food.serving_size);
  return amount > 0 ? amount : 100;
}

// "100 g", "250 ml", "1 unidade" — a referência a que os valores do alimento se aplicam.
function baseLabel(food) {
  const amount = baseAmountOf(food);
  if (baseUnitOf(food) === 'un') return amount === 1 ? '1 unidade' : `${formatNumber(amount)} unidades`;
  return `${formatNumber(amount)} ${baseUnitOf(food)}`;
}

function formatQuantity(quantity, food) {
  return `${formatNumber(quantity)} ${baseUnitOf(food)}`;
}

function appendMacroChips(target, values) {
  [['P', values.protein], ['C', values.carbohydrates], ['G', values.fat]].forEach(([label, value]) => {
    const chip = document.createElement('span');
    const key = document.createElement('b');
    key.textContent = label;
    chip.append(key, document.createTextNode(` ${formatNumber(value)} g`));
    target.append(chip);
  });
}

function openDialog(id) {
  document.querySelector(`#${id}`).showModal();
}

function closeDialog(id) {
  document.querySelector(`#${id}`).close();
}

/* ---------------------------------------------------------
   Alimentos
   --------------------------------------------------------- */

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
    const card = document.createElement('article');
    card.className = `food-item${food.user_id ? ' is-own' : ''}`;
    card.dataset.foodId = String(food.id);

    const thumb = document.createElement('span');
    thumb.className = 'food-thumb';
    thumb.append(createIcon(food.user_id ? 'i-sparkle' : 'i-apple'));

    const body = document.createElement('span');
    body.className = 'food-body';
    const title = document.createElement('span');
    title.className = 'food-title';
    const name = document.createElement('strong');
    name.textContent = food.name;
    title.append(name);
    if (food.user_id) {
      const badge = document.createElement('span');
      badge.className = 'own-badge';
      badge.textContent = 'Meu';
      title.append(badge);
    }
    const nutrition = document.createElement('small');
    nutrition.textContent = `${formatNumber(food.calories)} kcal · ${baseLabel(food)}${food.portion_label ? ` · ${food.portion_label}` : ''}`;
    const macros = document.createElement('span');
    macros.className = 'food-macros';
    appendMacroChips(macros, food);
    body.append(title, nutrition, macros);

    card.append(thumb, body);

    if (food.user_id) {
      const actions = document.createElement('span');
      actions.className = 'item-actions';
      actions.append(
        createIconButton('i-edit', 'ghost-button', `Editar ${food.name}`, () => openFoodDialog(food)),
        createIconButton('i-trash', 'ghost-button danger', `Excluir ${food.name}`, () => removeFood(food)),
      );
      card.append(actions);
    }

    list.append(card);
  });
}

function openFoodDialog(food = null) {
  editingFoodId = food ? food.id : null;
  document.querySelector('#food-dialog-title').textContent = food ? 'Editar alimento' : 'Novo alimento';
  document.querySelector('#food-submit').textContent = food ? 'Salvar alterações' : 'Salvar alimento';
  document.querySelector('#food-name').value = food ? food.name : '';
  document.querySelector('#food-unit').value = food ? baseUnitOf(food) : 'g';
  document.querySelector('#food-serving').value = food ? baseAmountOf(food) : 100;
  document.querySelector('#food-calories').value = food ? food.calories : '';
  document.querySelector('#food-protein').value = food ? food.protein : '';
  document.querySelector('#food-carbs').value = food ? food.carbohydrates : '';
  document.querySelector('#food-fat').value = food ? food.fat : '';
  document.querySelector('#food-portion').value = food && food.portion_amount ? food.portion_amount : '';
  document.querySelector('#food-feedback').textContent = '';
  updateFoodBaseLabels();
  openDialog('food-dialog');
}

// Mantém o sufixo do campo e a legenda dos macros de acordo com unidade e quantidade base.
function updateFoodBaseLabels() {
  const unit = document.querySelector('#food-unit').value;
  const amount = Number(document.querySelector('#food-serving').value);
  const preview = { base_unit: unit, serving_size: Number.isFinite(amount) && amount > 0 ? amount : 100 };
  document.querySelector('#food-serving-unit').textContent = baseUnitOf(preview);
  document.querySelector('#food-base-label').textContent = baseLabel(preview);
  // Alimento já contado por unidade não precisa declarar o peso de uma unidade.
  document.querySelector('#food-portion-unit').textContent = baseUnitOf(preview);
  document.querySelector('#food-portion-field').hidden = baseUnitOf(preview) === 'un';
}

// Trocar o tipo de unidade ajusta a base padrão: 1 unidade faz sentido, 100 unidades não.
function handleFoodUnitChange() {
  const unit = document.querySelector('#food-unit').value;
  const serving = document.querySelector('#food-serving');
  const current = Number(serving.value);
  if (unit === 'un' && current === 100) serving.value = 1;
  else if (unit !== 'un' && current === 1) serving.value = 100;
  updateFoodBaseLabels();
}

async function handleFoodSubmit(event) {
  event.preventDefault();
  const feedback = document.querySelector('#food-feedback');
  const button = document.querySelector('#food-submit');
  const name = document.querySelector('#food-name').value.trim();
  const servingSize = Number(document.querySelector('#food-serving').value);
  const portionInput = document.querySelector('#food-portion').value.trim();
  const portionAmount = portionInput === '' ? null : Number(portionInput);
  const values = {
    calories: Number(document.querySelector('#food-calories').value),
    protein: Number(document.querySelector('#food-protein').value || 0),
    carbohydrates: Number(document.querySelector('#food-carbs').value || 0),
    fat: Number(document.querySelector('#food-fat').value || 0),
  };
  if (!name) {
    feedback.textContent = 'Dê um nome ao alimento.';
    return;
  }
  if (!Number.isFinite(servingSize) || servingSize <= 0) {
    feedback.textContent = 'Informe uma quantidade base maior que zero.';
    return;
  }
  if (portionAmount !== null && (!Number.isFinite(portionAmount) || portionAmount <= 0)) {
    feedback.textContent = 'O peso de 1 unidade precisa ser maior que zero.';
    return;
  }
  if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
    feedback.textContent = 'Use apenas números iguais ou maiores que zero.';
    return;
  }
  button.disabled = true;
  feedback.textContent = '';
  try {
    await saveFood({
      name,
      base_unit: document.querySelector('#food-unit').value,
      serving_size: servingSize,
      portion_amount: portionAmount,
      ...values,
    }, editingFoodId);
    closeDialog('food-dialog');
    showToast(editingFoodId ? 'Alimento atualizado.' : 'Alimento criado.');
    await loadFoodCatalog();
    filterFoodList(name);
  } catch (error) {
    feedback.textContent = error && error.code === '23505'
      ? 'Você já tem um alimento com esse nome.'
      : 'Não foi possível salvar o alimento. Tente novamente.';
  } finally {
    button.disabled = false;
  }
}

async function removeFood(food) {
  if (!window.confirm(`Excluir “${food.name}”? Ele também sai das receitas em que aparece.`)) return;
  try {
    await deleteFood(food.id);
    showToast('Alimento excluído.');
    await loadFoodCatalog();
    await loadRecipes();
  } catch (error) {
    showToast(error && error.code === '23503'
      ? 'Esse alimento está em uma refeição registrada. Remova a refeição antes.'
      : 'Não foi possível excluir o alimento.', 'error');
  }
}

function filterFoodList(term = '') {
  const search = document.querySelector('#food-search');
  search.value = term;
  const needle = term.trim().toLowerCase();
  const matches = needle
    ? foodCatalog.filter((food) => food.name.toLowerCase().includes(needle))
    : foodCatalog.slice(0, FOOD_PAGE_SIZE);
  renderFoods(matches);
}

async function loadFoodCatalog() {
  foodCatalog = await listAllFoods();
  fillRecipeFoodSelect();
  renderFoods(foodCatalog.slice(0, FOOD_PAGE_SIZE));
}

/* ---------------------------------------------------------
   Receitas
   --------------------------------------------------------- */

function renderRecipes(recipes) {
  const list = document.querySelector('#recipe-list');
  list.replaceChildren();
  if (!recipes.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Você ainda não tem receitas. Crie uma para registrar suas refeições de sempre em um toque.';
    list.append(emptyState);
    return;
  }
  recipes.forEach((recipe) => {
    const items = recipe.recipe_items || [];
    const totals = calculateRecipeTotals(items);
    const card = document.createElement('article');
    card.className = 'recipe-card';

    const header = document.createElement('div');
    header.className = 'recipe-header';
    const heading = document.createElement('h3');
    heading.textContent = recipe.name;
    const actions = document.createElement('span');
    actions.className = 'item-actions';
    actions.append(
      createIconButton('i-edit', 'ghost-button', `Editar ${recipe.name}`, () => openRecipeDialog(recipe)),
      createIconButton('i-trash', 'ghost-button danger', `Excluir ${recipe.name}`, () => removeRecipe(recipe)),
    );
    header.append(heading, actions);

    const ingredients = document.createElement('p');
    ingredients.className = 'recipe-ingredients';
    ingredients.textContent = items.length
      ? items.map((item) => `${item.foods ? item.foods.name : 'Alimento removido'} ${formatQuantity(item.quantity, item.foods)}`).join(' · ')
      : 'Sem ingredientes.';

    const summary = document.createElement('div');
    summary.className = 'recipe-total';
    const calories = document.createElement('strong');
    calories.textContent = `${formatNumber(totals.calories)} kcal`;
    const macros = document.createElement('span');
    macros.className = 'food-macros';
    appendMacroChips(macros, totals);
    summary.append(calories, macros);

    card.append(header, ingredients, summary);
    list.append(card);
  });
}

// Busca sem acento e sem caixa: "acucar" encontra "Açúcar", "PAO" encontra "Pão francês".
function normalizeText(value) {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function fillRecipeFoodSelect() {
  const select = document.querySelector('#recipe-food');
  const previous = select.value;
  const term = normalizeText(document.querySelector('#recipe-food-search').value.trim());
  const matches = term ? foodCatalog.filter((food) => normalizeText(food.name).includes(term)) : foodCatalog;

  select.replaceChildren();
  matches.forEach((food) => {
    const option = document.createElement('option');
    option.value = String(food.id);
    option.textContent = food.user_id ? `${food.name} (meu)` : food.name;
    select.append(option);
  });
  // Mantém o alimento escolhido enquanto ele continuar entre os resultados.
  if (previous && matches.some((food) => String(food.id) === previous)) select.value = previous;

  const counter = document.querySelector('#recipe-food-count');
  if (!matches.length) counter.textContent = '(nenhum resultado)';
  else if (!term) counter.textContent = `(${matches.length})`;
  else counter.textContent = matches.length === 1 ? '(1 resultado)' : `(${matches.length} resultados)`;

  updateRecipeUnit(true);
}

function selectedRecipeFood() {
  return foodCatalog.find((item) => String(item.id) === document.querySelector('#recipe-food').value);
}

// Medidas oferecidas para um alimento: a unidade base dele e, quando existe uma conversão
// conhecida (portion_amount), a porção prática. Sem conversão registrada a opção não aparece,
// porque converter g em ml ou em unidade sem densidade ou peso seria inventar número.
function recipeUnitOptions(food) {
  if (!food) return [];
  const unit = baseUnitOf(food);
  const options = [{ value: 'base', label: unit === 'un' ? 'unidade' : unit, factor: 1 }];
  const portion = Number(food.portion_amount);
  if (unit !== 'un' && portion > 0) {
    options.push({ value: 'portion', label: food.portion_label || `1 unidade (${formatNumber(portion)} ${unit})`, factor: portion });
  }
  return options;
}

function selectedRecipeUnit() {
  const value = document.querySelector('#recipe-unit').value;
  return recipeUnitOptions(selectedRecipeFood()).find((option) => option.value === value);
}

// A quantidade só recebe o padrão da medida enquanto o usuário não digitou nada:
// trocar de alimento depois de escolher a quantidade não pode apagar o que foi digitado.
function applyRecipeQuantityDefault() {
  if (recipeQuantityTouched) return;
  const option = selectedRecipeUnit();
  const porUnidade = !option || option.factor !== 1 || baseUnitOf(selectedRecipeFood()) === 'un';
  document.querySelector('#recipe-quantity').value = porUnidade ? '1' : '100';
}

function updateRecipeUnit(resetQuantity = false) {
  const select = document.querySelector('#recipe-unit');
  const previous = select.value;
  const options = recipeUnitOptions(selectedRecipeFood());
  select.replaceChildren();
  options.forEach((option) => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  });
  if (options.some((option) => option.value === previous)) select.value = previous;
  if (resetQuantity) applyRecipeQuantityDefault();
}

function openRecipeDialog(recipe = null) {
  recipeDraft = {
    id: recipe ? recipe.id : null,
    items: recipe
      ? (recipe.recipe_items || []).filter((item) => item.foods).map((item) => ({ food_id: item.food_id, quantity: Number(item.quantity), foods: item.foods }))
      : [],
  };
  document.querySelector('#recipe-dialog-title').textContent = recipe ? 'Editar receita' : 'Nova receita';
  document.querySelector('#recipe-submit').textContent = recipe ? 'Salvar alterações' : 'Salvar receita';
  document.querySelector('#recipe-name').value = recipe ? recipe.name : '';
  document.querySelector('#recipe-feedback').textContent = '';
  document.querySelector('#recipe-food-search').value = '';
  recipeQuantityTouched = false;
  fillRecipeFoodSelect();
  renderRecipeDraft();
  openDialog('recipe-dialog');
}

function renderRecipeDraft() {
  const list = document.querySelector('#recipe-items');
  list.replaceChildren();
  recipeDraft.items.forEach((item, index) => {
    const row = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'ingredient-info';
    const name = document.createElement('strong');
    name.textContent = item.foods.name;
    const detail = document.createElement('small');
    const nutrition = calculateNutrition(item.foods, item.quantity);
    detail.textContent = `${formatQuantity(item.quantity, item.foods)} · ${formatNumber(nutrition.calories)} kcal`;
    info.append(name, detail);
    row.append(info, createIconButton('i-trash', 'ghost-button danger', `Remover ${item.foods.name}`, () => {
      recipeDraft.items.splice(index, 1);
      renderRecipeDraft();
    }));
    list.append(row);
  });

  const summary = document.querySelector('#recipe-summary');
  summary.replaceChildren();
  if (!recipeDraft.items.length) {
    summary.textContent = 'Inclua pelo menos um alimento.';
    return;
  }
  const totals = calculateRecipeTotals(recipeDraft.items);
  const calories = document.createElement('strong');
  calories.textContent = `${formatNumber(totals.calories)} kcal no total`;
  const macros = document.createElement('span');
  macros.className = 'food-macros';
  appendMacroChips(macros, totals);
  summary.append(calories, macros);
}

function addRecipeItem() {
  const feedback = document.querySelector('#recipe-feedback');
  const food = selectedRecipeFood();
  const option = selectedRecipeUnit();
  const typed = Number(document.querySelector('#recipe-quantity').value);
  if (!food || !option) {
    feedback.textContent = 'Escolha um alimento.';
    return;
  }
  if (!Number.isFinite(typed) || typed <= 0) {
    feedback.textContent = 'Informe uma quantidade maior que zero.';
    return;
  }
  // Guardamos sempre na unidade base do alimento; a medida escolhida é só a forma de digitar.
  const quantity = Number((typed * option.factor).toFixed(2));
  if (quantity > 100000) {
    feedback.textContent = 'Quantidade muito alta para este alimento.';
    return;
  }
  feedback.textContent = '';
  const existing = recipeDraft.items.find((item) => String(item.food_id) === String(food.id));
  if (existing) existing.quantity += quantity;
  else recipeDraft.items.push({ food_id: food.id, quantity, foods: food });
  recipeQuantityTouched = false;
  updateRecipeUnit(true);
  renderRecipeDraft();
}

async function handleRecipeSubmit(event) {
  event.preventDefault();
  const feedback = document.querySelector('#recipe-feedback');
  const button = document.querySelector('#recipe-submit');
  const name = document.querySelector('#recipe-name').value.trim();
  if (!name) {
    feedback.textContent = 'Dê um nome à receita.';
    return;
  }
  if (!recipeDraft.items.length) {
    feedback.textContent = 'Inclua pelo menos um alimento.';
    return;
  }
  button.disabled = true;
  feedback.textContent = '';
  try {
    await saveRecipe({
      id: recipeDraft.id,
      name,
      items: recipeDraft.items.map((item) => ({ food_id: item.food_id, quantity: item.quantity })),
    });
    closeDialog('recipe-dialog');
    showToast(recipeDraft.id ? 'Receita atualizada.' : 'Receita criada.');
    await loadRecipes();
  } catch (error) {
    feedback.textContent = error && error.code === '23505'
      ? 'Você já tem uma receita com esse nome.'
      : 'Não foi possível salvar a receita. Tente novamente.';
  } finally {
    button.disabled = false;
  }
}

async function removeRecipe(recipe) {
  if (!window.confirm(`Excluir a receita “${recipe.name}”?`)) return;
  try {
    await deleteRecipe(recipe.id);
    showToast('Receita excluída.');
    await loadRecipes();
  } catch (error) {
    showToast('Não foi possível excluir a receita.', 'error');
  }
}

async function loadRecipes() {
  renderRecipes(await getRecipes());
}

/* ---------------------------------------------------------
   Refeições e resumo do dia
   --------------------------------------------------------- */

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
    description.textContent = items.length ? items.map((meal) => `${meal.foods.name} (${formatQuantity(meal.quantity, meal.foods)})`).join(', ') : 'Adicione sua próxima refeição';
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
      const deleteButton = createIconButton('i-trash', 'more-button', 'Excluir refeição', async () => {
        try { await deleteMeal(items[0].id); showToast('Refeição removida.'); await refreshDashboard(); } catch (error) { showToast('Não foi possível remover a refeição.', 'error'); }
      });
      deleteButton.dataset.deleteMeal = String(items[0].id);
      card.append(total, deleteButton);
    } else {
      const addButton = createIconButton('i-plus', 'add-small', `Adicionar ${label}`, () => showToast('A seleção de alimento será aberta na próxima atualização.'));
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

/* ---------------------------------------------------------
   Ligações de eventos
   --------------------------------------------------------- */

applyTheme(getStoredTheme());

document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
document.querySelectorAll('[data-action="add-meal"]').forEach((button) => button.addEventListener('click', () => { showView('alimentos'); document.querySelector('#food-search').focus(); }));
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));
document.querySelector('[data-action="new-food"]').addEventListener('click', () => openFoodDialog());
document.querySelector('[data-action="new-recipe"]').addEventListener('click', () => openRecipeDialog());
document.querySelector('[data-action="theme"]').addEventListener('click', toggleTheme);
document.querySelector('[data-action="profile"]').addEventListener('click', () => showView('perfil'));
document.querySelector('[data-action="logout"]').addEventListener('click', signOut);
document.querySelector('#food-form').addEventListener('submit', handleFoodSubmit);
document.querySelector('#recipe-form').addEventListener('submit', handleRecipeSubmit);
document.querySelector('#recipe-add-item').addEventListener('click', addRecipeItem);
document.querySelector('#recipe-food-search').addEventListener('input', fillRecipeFoodSelect);
// Enter dentro do formulário submeteria a receita: na busca ele não faz nada,
// e no campo de quantidade ele inclui o ingrediente, que é o esperado ali.
document.querySelector('#recipe-food-search').addEventListener('keydown', (event) => { if (event.key === 'Enter') event.preventDefault(); });
document.querySelector('#recipe-quantity').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addRecipeItem(); } });
document.querySelector('#recipe-quantity').addEventListener('input', () => { recipeQuantityTouched = true; });
document.querySelector('#recipe-food').addEventListener('change', () => updateRecipeUnit(true));
document.querySelector('#recipe-unit').addEventListener('change', applyRecipeQuantityDefault);
document.querySelector('#food-unit').addEventListener('change', handleFoodUnitChange);
document.querySelector('#food-serving').addEventListener('input', updateFoodBaseLabels);
document.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
document.querySelector('#auth-switch').addEventListener('click', () => openAuthModal(authMode === 'login' ? 'register' : 'login'));
document.querySelector('#forgot-password').addEventListener('click', () => openAuthModal('forgot'));
document.querySelector('#auth-password').addEventListener('input', (event) => updatePasswordRules(event.target.value));
document.querySelector('#food-search').addEventListener('input', async (event) => { try { renderFoods(await searchFoods(event.target.value)); } catch (error) { showToast('Não foi possível carregar os alimentos.', 'error'); } });
document.querySelector('#profile-form').addEventListener('submit', (event) => { event.preventDefault(); showToast('Perfil salvo nesta versão local.'); });
window.addEventListener('scroll', () => { document.querySelector('.topbar').classList.toggle('is-stuck', window.scrollY > 8); }, { passive: true });
