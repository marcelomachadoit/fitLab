const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
const THEME_KEY = 'fitlab-theme';
const FOOD_PAGE_SIZE = 60;

let foodCatalog = [];
let editingFoodId = null;
let recipeDraft = { id: null, items: [] };
let recipeQuantityTouched = false;
let mealSlots = [];
let slotDraft = [];
let recipeList = [];
let entryMode = 'food';
let entryQuantityTouched = false;
let nutritionProfile = null;
let goalStep = 0;
let goalDraft = {};
let goalsMandatory = false;

const GOAL_STEPS = 6;
// Usadas enquanto o usuario nao respondeu ao questionario.
const DEFAULT_GOALS = { calories: 2400, protein: 170, carbohydrates: 250, fat: 70 };

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

// Helpers compartilhados pelos dois seletores de alimento (receita e registro de consumo).
function matchingFoods(term) {
  const needle = normalizeText(String(term || '').trim());
  return needle ? foodCatalog.filter((food) => normalizeText(food.name).includes(needle)) : foodCatalog;
}

function populateFoodSelect(select, matches) {
  const previous = select.value;
  select.replaceChildren();
  matches.forEach((food) => {
    const option = document.createElement('option');
    option.value = String(food.id);
    option.textContent = food.user_id ? `${food.name} (meu)` : food.name;
    select.append(option);
  });
  if (previous && matches.some((food) => String(food.id) === previous)) select.value = previous;
}

function describeMatches(counter, matches, term) {
  if (!matches.length) counter.textContent = '(nenhum resultado)';
  else if (!term) counter.textContent = `(${matches.length})`;
  else counter.textContent = matches.length === 1 ? '(1 resultado)' : `(${matches.length} resultados)`;
}

function populateUnitSelect(select, food) {
  const previous = select.value;
  const options = recipeUnitOptions(food);
  select.replaceChildren();
  options.forEach((option) => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  });
  if (options.some((option) => option.value === previous)) select.value = previous;
  return options;
}

function defaultQuantityFor(food, option) {
  return !option || option.factor !== 1 || baseUnitOf(food) === 'un' ? '1' : '100';
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
  recipeList = await getRecipes();
  renderRecipes(recipeList);
}

/* ---------------------------------------------------------
   Metas nutricionais
   --------------------------------------------------------- */

function currentGoals() {
  if (!isProfileComplete(nutritionProfile)) return DEFAULT_GOALS;
  return {
    calories: Number(nutritionProfile.target_calories),
    protein: Number(nutritionProfile.protein_g),
    carbohydrates: Number(nutritionProfile.carbs_g),
    fat: Number(nutritionProfile.fat_g),
  };
}

async function loadNutritionProfile() {
  nutritionProfile = await getNutritionProfile();
  applyProfileToInterface();
  return nutritionProfile;
}

// O nome salvo em profiles tem prioridade sobre o dos metadados do Auth.
function applyProfileToInterface() {
  if (nutritionProfile && nutritionProfile.name) {
    const initials = getInitials(nutritionProfile.name);
    document.querySelector('#user-name').textContent = nutritionProfile.name;
    document.querySelector('#profile-name').textContent = nutritionProfile.name;
    document.querySelector('#profile-name-input').value = nutritionProfile.name;
    document.querySelector('#profile-avatar').textContent = initials;
    document.querySelector('[data-action="profile"]').textContent = initials;
  }
  renderProfileGoals();
}

function appendGoalMacros(target, protein, carbs, fat) {
  [['Proteína', protein, 'protein'], ['Carboidratos', carbs, 'carbs'], ['Gorduras', fat, 'fats']].forEach(([label, value, kind]) => {
    const tile = document.createElement('div');
    tile.className = `goal-macro ${kind}`;
    const name = document.createElement('span');
    name.textContent = label;
    const amount = document.createElement('strong');
    amount.textContent = `${formatNumber(value)} g`;
    tile.append(name, amount);
    target.append(tile);
  });
}

// Traduz o erro do banco em instrução. O código bruto vai junto quando não é um caso
// conhecido: um "tente novamente" genérico esconde justamente o que precisa ser corrigido.
function describeDatabaseError(error) {
  if (!error) return 'Erro desconhecido.';
  const code = error.code || '';
  if (code === 'PGRST204' || code === '42703') {
    return 'O banco ainda não tem as colunas do questionário. Rode o supabase.sql atualizado no SQL Editor do Supabase.';
  }
  if (code === '42501') {
    return 'Sem permissão para gravar o perfil. Rode os grants do supabase.sql no SQL Editor.';
  }
  if (code === '23514') {
    return 'Algum valor ficou fora dos limites aceitos pelo banco. Revise os dados informados.';
  }
  if (code === '23505') {
    return 'Já existe um registro com esses dados.';
  }
  if (code === '42P01') {
    return 'A tabela não existe neste projeto do Supabase. Rode o supabase.sql no SQL Editor.';
  }
  const message = error.message || error.details || 'sem detalhes';
  return code ? `${message} (código ${code})` : message;
}

function renderGoalWarnings(selector, warnings) {
  const container = document.querySelector(selector);
  container.replaceChildren();
  warnings.forEach((text) => {
    const box = document.createElement('p');
    box.className = 'warning-box';
    box.setAttribute('role', 'alert');
    box.append(createIcon('i-alert'), document.createTextNode(text));
    container.append(box);
  });
}

function renderProfileGoals() {
  const target = document.querySelector('#profile-target-calories');
  const tdee = document.querySelector('#profile-tdee');
  const macros = document.querySelector('#profile-goal-macros');
  const details = document.querySelector('#profile-goal-details');
  macros.replaceChildren();
  if (!isProfileComplete(nutritionProfile)) {
    target.textContent = '—';
    tdee.textContent = 'Gasto calórico estimado: —';
    details.textContent = 'Responda ao questionário para calcular suas metas.';
    renderGoalWarnings('#profile-goal-warnings', []);
    return;
  }
  target.textContent = `${formatNumber(nutritionProfile.target_calories)} kcal`;
  tdee.textContent = `Gasto calórico estimado: ${formatNumber(nutritionProfile.tdee)} kcal`;
  appendGoalMacros(macros, nutritionProfile.protein_g, nutritionProfile.carbs_g, nutritionProfile.fat_g);
  details.textContent = `${GOALS[nutritionProfile.goal].label} · ${ACTIVITY_LEVELS[nutritionProfile.activity_level].label} · ${formatNumber(nutritionProfile.weight)} kg, ${formatNumber(nutritionProfile.height)} cm, ${nutritionProfile.age} anos`;
  // Os sinalizadores não são gravados: recalcula a partir das respostas para saber se
  // algum limite de segurança entrou em ação neste perfil.
  renderGoalWarnings('#profile-goal-warnings', describeGoalWarnings(calculateNutritionGoals(profileAnswers(nutritionProfile))));
}

/* Questionário em etapas ------------------------------------------------ */

function openGoalsDialog(mandatory = false) {
  goalsMandatory = mandatory;
  goalDraft = {
    weight: nutritionProfile && nutritionProfile.weight ? Number(nutritionProfile.weight) : null,
    height: nutritionProfile && nutritionProfile.height ? Number(nutritionProfile.height) : null,
    age: nutritionProfile && nutritionProfile.age ? Number(nutritionProfile.age) : null,
    sex: nutritionProfile ? nutritionProfile.sex : null,
    activity_level: nutritionProfile ? nutritionProfile.activity_level : null,
    goal: nutritionProfile ? nutritionProfile.goal : null,
  };
  document.querySelector('#goal-weight').value = goalDraft.weight || '';
  document.querySelector('#goal-height').value = goalDraft.height || '';
  document.querySelector('#goal-age').value = goalDraft.age || '';
  document.querySelector('#goals-close').hidden = mandatory;
  document.querySelector('#goals-dialog-title').textContent = isProfileComplete(nutritionProfile)
    ? 'Atualizar suas metas'
    : 'Vamos calcular suas metas';
  renderGoalOptions();
  showGoalStep(0);
  openDialog('goals-dialog');
}

function renderGoalOptions() {
  buildOptionGrid('#goal-sex-options', Object.entries(SEX_OPTIONS).map(([value, label]) => ({ value, label })), 'sex');
  buildOptionGrid('#goal-activity-options', Object.entries(ACTIVITY_LEVELS).map(([value, config]) => ({ value, label: config.label, hint: config.hint })), 'activity_level');
  buildOptionGrid('#goal-objective-options', Object.entries(GOALS).map(([value, config]) => ({ value, label: config.label, hint: config.hint })), 'goal');
}

// As opções saem das constantes de goals.js: rótulos e valores não se repetem no HTML.
function buildOptionGrid(selector, options, field) {
  const container = document.querySelector(selector);
  container.replaceChildren();
  options.forEach((option) => {
    const card = document.createElement('button');
    card.className = `option-card${goalDraft[field] === option.value ? ' selected' : ''}`;
    card.type = 'button';
    card.dataset.value = option.value;
    card.setAttribute('aria-pressed', String(goalDraft[field] === option.value));
    const label = document.createElement('strong');
    label.textContent = option.label;
    card.append(label);
    if (option.hint) {
      const hint = document.createElement('span');
      hint.textContent = option.hint;
      card.append(hint);
    }
    card.addEventListener('click', () => {
      goalDraft[field] = option.value;
      container.querySelectorAll('.option-card').forEach((item) => {
        const active = item.dataset.value === option.value;
        item.classList.toggle('selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
      document.querySelector('#goals-feedback').textContent = '';
    });
    container.append(card);
  });
}

function showGoalStep(step) {
  goalStep = step;
  const isSummary = step === GOAL_STEPS;
  document.querySelectorAll('.goal-step').forEach((section) => { section.hidden = Number(section.dataset.step) !== step; });
  const label = document.querySelector('#goals-step-label');
  label.hidden = isSummary;
  label.textContent = `Etapa ${step + 1} de ${GOAL_STEPS}`;
  document.querySelector('#goals-progress').style.width = `${((isSummary ? GOAL_STEPS : step + 1) / GOAL_STEPS) * 100}%`;
  document.querySelector('#goals-back').hidden = step === 0 || isSummary;
  document.querySelector('#goals-next').textContent = isSummary ? 'Começar' : step === GOAL_STEPS - 1 ? 'Calcular metas' : 'Continuar';
  document.querySelector('#goals-feedback').textContent = '';
  const input = document.querySelector(`.goal-step[data-step="${step}"] input`);
  if (input) input.focus();
}

// Guarda o que foi digitado antes de sair da etapa, para o botão Voltar não perder nada.
function captureGoalStep(step) {
  if (step === 0) goalDraft.weight = Number(document.querySelector('#goal-weight').value);
  if (step === 1) goalDraft.height = Number(document.querySelector('#goal-height').value);
  if (step === 2) goalDraft.age = Number(document.querySelector('#goal-age').value);
}

function validateGoalStep(step) {
  if (step === 0) return validateProfileNumber(goalDraft.weight, PROFILE_LIMITS.weight) ? null : `Informe um peso entre ${PROFILE_LIMITS.weight.min} e ${PROFILE_LIMITS.weight.max} kg.`;
  if (step === 1) return validateProfileNumber(goalDraft.height, PROFILE_LIMITS.height) ? null : `Informe uma altura entre ${PROFILE_LIMITS.height.min} e ${PROFILE_LIMITS.height.max} cm.`;
  if (step === 2) return validateProfileNumber(goalDraft.age, PROFILE_LIMITS.age) && Number.isInteger(goalDraft.age) ? null : `Informe uma idade inteira entre ${PROFILE_LIMITS.age.min} e ${PROFILE_LIMITS.age.max} anos.`;
  if (step === 3) return SEX_OPTIONS[goalDraft.sex] ? null : 'Escolha uma opção para continuar.';
  if (step === 4) return ACTIVITY_LEVELS[goalDraft.activity_level] ? null : 'Escolha seu nível de atividade física.';
  if (step === 5) return GOALS[goalDraft.goal] ? null : 'Escolha seu objetivo.';
  return null;
}

function renderGoalsSummary(goals) {
  document.querySelector('#summary-tdee').textContent = `${formatNumber(goals.tdee)} kcal`;
  document.querySelector('#summary-target').textContent = `${formatNumber(goals.target_calories)} kcal`;
  document.querySelector('#summary-goal-label').textContent = `Meta para ${(GOALS[goalDraft.goal] || GOALS.maintenance).label.toLowerCase()}`;
  const macros = document.querySelector('#summary-macros');
  macros.replaceChildren();
  appendGoalMacros(macros, goals.protein_g, goals.carbs_g, goals.fat_g);
  renderGoalWarnings('#summary-warnings', describeGoalWarnings(goals));
}

async function handleGoalsSubmit(event) {
  event.preventDefault();
  const feedback = document.querySelector('#goals-feedback');
  if (goalStep === GOAL_STEPS) {
    closeDialog('goals-dialog');
    showView('inicio');
    return;
  }
  captureGoalStep(goalStep);
  const stepError = validateGoalStep(goalStep);
  if (stepError) {
    feedback.textContent = stepError;
    return;
  }
  if (goalStep < GOAL_STEPS - 1) {
    showGoalStep(goalStep + 1);
    return;
  }
  // Revalida o conjunto inteiro antes de gravar, nao so a ultima etapa.
  const invalid = validateNutritionAnswers(goalDraft);
  if (invalid) {
    feedback.textContent = invalid;
    return;
  }
  const button = document.querySelector('#goals-next');
  button.disabled = true;
  try {
    const goals = calculateNutritionGoals(goalDraft);
    nutritionProfile = await saveNutritionProfile(goalDraft, goals, document.querySelector('#profile-name-input').value.trim());
    renderGoalsSummary(goals);
    applyProfileToInterface();
    await refreshDashboard();
    showGoalStep(GOAL_STEPS);
  } catch (error) {
    feedback.textContent = `Não foi possível salvar suas metas. ${describeDatabaseError(error)}`;
  } finally {
    button.disabled = false;
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const name = document.querySelector('#profile-name-input').value.trim();
  if (!name) {
    showToast('Informe seu nome.', 'error');
    return;
  }
  try {
    nutritionProfile = await saveProfileName(name);
    applyProfileToInterface();
    showToast('Perfil atualizado.');
  } catch (error) {
    showToast(`Não foi possível salvar o perfil. ${describeDatabaseError(error)}`, 'error');
  }
}

/* ---------------------------------------------------------
   Refeições e resumo do dia
   --------------------------------------------------------- */

function renderMeals(meals, slots) {
  const list = document.querySelector('#meal-list');
  list.replaceChildren();
  if (!slots.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Você ainda não tem refeições. Use "Personalizar refeições" para criar as suas.';
    list.append(emptyState);
    return;
  }
  const tons = ['breakfast', 'lunch', 'snack', 'dinner'];
  slots.forEach((slot, index) => {
    const items = meals.filter((meal) => String(meal.slot_id) === String(slot.id));
    const calories = items.reduce((sum, meal) => sum + (meal.foods ? calculateNutrition(meal.foods, meal.quantity).calories : 0), 0);

    const card = document.createElement('article');
    card.className = `meal-card${items.length ? '' : ' empty-meal'}`;

    const header = document.createElement('div');
    header.className = 'meal-header';
    const icon = document.createElement('div');
    icon.className = `meal-icon ${tons[index % tons.length]}`;
    icon.append(createIcon(`i-${slot.icon || 'utensils'}`));
    const info = document.createElement('div');
    info.className = 'meal-info';
    const heading = document.createElement('h3');
    heading.textContent = slot.name;
    const description = document.createElement('p');
    description.textContent = items.length
      ? `${items.length} ${items.length === 1 ? 'item' : 'itens'} · ${formatNumber(calories)} kcal`
      : 'Nada registrado ainda';
    info.append(heading, description);
    header.append(icon, info, createIconButton('i-plus', 'add-small', `Registrar em ${slot.name}`, () => openEntryDialog(slot.id)));
    card.append(header);

    if (items.length) {
      const entries = document.createElement('ul');
      entries.className = 'meal-items';
      items.forEach((meal) => {
        const row = document.createElement('li');
        const detail = document.createElement('div');
        detail.className = 'ingredient-info';
        const name = document.createElement('strong');
        name.textContent = meal.foods ? meal.foods.name : 'Alimento removido';
        const amount = document.createElement('small');
        const nutrition = meal.foods ? calculateNutrition(meal.foods, meal.quantity) : { calories: 0 };
        amount.textContent = `${formatQuantity(meal.quantity, meal.foods)} · ${formatNumber(nutrition.calories)} kcal`;
        detail.append(name, amount);
        row.append(detail, createIconButton('i-trash', 'ghost-button danger', `Remover ${name.textContent}`, async () => {
          try {
            await deleteMeal(meal.id);
            showToast('Registro removido.');
            await refreshDashboard();
          } catch (error) {
            showToast(`Não foi possível remover. ${describeDatabaseError(error)}`, 'error');
          }
        }));
        entries.append(row);
      });
      card.append(entries);
    }

    list.append(card);
  });
}

/* Personalizar refeições ------------------------------------------------ */

async function loadMealSlots() {
  let slots = await getMealSlots();
  // Conta nova começa com as quatro refeições usuais, que o usuário renomeia depois.
  if (!slots.length) slots = await createDefaultMealSlots();
  mealSlots = slots;
  return slots;
}

function openSlotsDialog() {
  slotDraft = mealSlots.map((slot) => ({ id: slot.id, name: slot.name, icon: slot.icon }));
  if (!slotDraft.length) slotDraft = DEFAULT_MEAL_SLOTS.map((slot) => ({ name: slot.name, icon: slot.icon }));
  document.querySelector('#slots-feedback').textContent = '';
  renderSlotDraft();
  openDialog('slots-dialog');
}

function renderSlotDraft() {
  const list = document.querySelector('#slot-list');
  list.replaceChildren();
  slotDraft.forEach((slot, index) => {
    const row = document.createElement('li');
    row.className = 'slot-row';
    row.dataset.index = String(index);

    const handle = document.createElement('button');
    handle.className = 'slot-drag';
    handle.type = 'button';
    handle.setAttribute('aria-label', `Mover ${slot.name || 'refeição'}. Use as setas para cima e para baixo.`);
    handle.title = 'Arraste para reordenar';
    handle.append(createIcon('i-grip'));
    attachSlotDrag(handle, row);
    // Sem ponteiro (teclado, leitor de tela) as setas fazem o mesmo trabalho.
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      moveSlotDraft(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
    });

    // O ícone gira pela lista aceita pelo banco a cada clique: escolha visual sem outro menu.
    const iconButton = createIconButton(`i-${slot.icon}`, 'slot-icon', `Trocar ícone de ${slot.name || 'refeição'}`, () => {
      const atual = MEAL_SLOT_ICONS.indexOf(slot.icon);
      slot.icon = MEAL_SLOT_ICONS[(atual + 1) % MEAL_SLOT_ICONS.length];
      renderSlotDraft();
    });

    const field = document.createElement('span');
    field.className = 'field-control';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 60;
    input.value = slot.name;
    input.placeholder = 'Nome da refeição';
    input.setAttribute('aria-label', `Nome da refeição ${index + 1}`);
    input.addEventListener('input', () => { slot.name = input.value; });
    field.append(input);

    row.append(handle, iconButton, field, createIconButton('i-trash', 'ghost-button danger', `Remover ${slot.name || 'refeição'}`, () => {
      const aviso = slot.id
        ? `Remover "${slot.name}"? Os alimentos já registrados nela serão apagados junto.`
        : `Remover "${slot.name || 'esta refeição'}"?`;
      if (!window.confirm(aviso)) return;
      slotDraft.splice(index, 1);
      renderSlotDraft();
    }));
    list.append(row);
  });
}

function moveSlotDraft(from, to) {
  if (to < 0 || to >= slotDraft.length) return;
  const [item] = slotDraft.splice(from, 1);
  slotDraft.splice(to, 0, item);
  renderSlotDraft();
  // Devolve o foco ao punho que acabou de se mover, para continuar navegando pelo teclado.
  const handles = document.querySelectorAll('#slot-list .slot-drag');
  if (handles[to]) handles[to].focus();
}

// Arrastar com pointer events cobre mouse e toque; a linha é movida no próprio DOM durante
// o gesto (nada de re-renderizar no meio, que destruiria o elemento sob o dedo) e a ordem
// só volta para o rascunho quando o gesto termina.
function attachSlotDrag(handle, row) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button) return;
    event.preventDefault();
    const list = row.parentElement;
    row.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);

    // Procura o destino pela posição absoluta do ponteiro, e não passo a passo:
    // um arrasto rápido chega de uma vez ao lugar certo em vez de subir uma linha por evento.
    const onMove = (moveEvent) => {
      const y = moveEvent.clientY;
      const alvo = [...list.children].find((sibling) => {
        if (sibling === row) return false;
        const rect = sibling.getBoundingClientRect();
        return y < rect.top + (rect.height / 2);
      });
      if (alvo) {
        if (alvo !== row.nextElementSibling) list.insertBefore(row, alvo);
      } else if (list.lastElementChild !== row) {
        list.append(row);
      }
    };

    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      row.classList.remove('dragging');
      const ordem = [...list.children].map((item) => Number(item.dataset.index));
      slotDraft = ordem.map((posicao) => slotDraft[posicao]);
      renderSlotDraft();
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  });
}

function addSlotDraftRow() {
  slotDraft.push({ name: '', icon: MEAL_SLOT_ICONS[slotDraft.length % MEAL_SLOT_ICONS.length] });
  renderSlotDraft();
  const inputs = document.querySelectorAll('#slot-list input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

async function handleSlotsSubmit(event) {
  event.preventDefault();
  const feedback = document.querySelector('#slots-feedback');
  const button = document.querySelector('#slots-submit');
  const nomes = slotDraft.map((slot) => slot.name.trim());
  if (!slotDraft.length) {
    feedback.textContent = 'Mantenha pelo menos uma refeição.';
    return;
  }
  if (nomes.some((nome) => !nome)) {
    feedback.textContent = 'Dê um nome a todas as refeições.';
    return;
  }
  if (new Set(nomes.map((nome) => nome.toLowerCase())).size !== nomes.length) {
    feedback.textContent = 'Há nomes repetidos na lista.';
    return;
  }
  button.disabled = true;
  feedback.textContent = '';
  try {
    // Apaga primeiro: libera o nome para ser reaproveitado na mesma gravação.
    const mantidos = new Set(slotDraft.filter((slot) => slot.id).map((slot) => String(slot.id)));
    const removidos = mealSlots.filter((slot) => !mantidos.has(String(slot.id)));
    for (const slot of removidos) await deleteMealSlot(slot.id);
    for (const [index, slot] of slotDraft.entries()) {
      await saveMealSlot({ id: slot.id, name: slot.name.trim(), icon: slot.icon, position: index });
    }
    closeDialog('slots-dialog');
    showToast('Refeições atualizadas.');
    await refreshDashboard();
  } catch (error) {
    feedback.textContent = `Não foi possível salvar as refeições. ${describeDatabaseError(error)}`;
  } finally {
    button.disabled = false;
  }
}

/* Registrar consumo ----------------------------------------------------- */

function openEntryDialog(slotId = null) {
  if (!mealSlots.length) {
    showToast('Crie uma refeição antes em "Personalizar refeições".', 'error');
    return;
  }
  entryQuantityTouched = false;
  document.querySelector('#entry-food-search').value = '';
  document.querySelector('#entry-feedback').textContent = '';
  fillSlotSelect(slotId);
  fillEntryFoodSelect();
  fillEntryRecipeSelect();
  setEntryMode('food');
  openDialog('entry-dialog');
}

function setEntryMode(mode) {
  entryMode = mode;
  document.querySelectorAll('[data-entry-mode]').forEach((button) => {
    const ativo = button.dataset.entryMode === mode;
    button.classList.toggle('selected', ativo);
    button.setAttribute('aria-selected', String(ativo));
  });
  document.querySelector('#entry-food-mode').hidden = mode !== 'food';
  document.querySelector('#entry-recipe-mode').hidden = mode !== 'recipe';
  document.querySelector('#entry-submit').textContent = mode === 'recipe' ? 'Registrar receita' : 'Registrar';
  document.querySelector('#entry-feedback').textContent = '';
}

function fillSlotSelect(slotId) {
  const select = document.querySelector('#entry-slot');
  select.replaceChildren();
  mealSlots.forEach((slot) => {
    const option = document.createElement('option');
    option.value = String(slot.id);
    option.textContent = slot.name;
    select.append(option);
  });
  if (slotId && mealSlots.some((slot) => String(slot.id) === String(slotId))) select.value = String(slotId);
}

function selectedEntryFood() {
  return foodCatalog.find((food) => String(food.id) === document.querySelector('#entry-food').value);
}

function selectedEntryUnit() {
  const value = document.querySelector('#entry-unit').value;
  return recipeUnitOptions(selectedEntryFood()).find((option) => option.value === value);
}

function fillEntryFoodSelect() {
  const termo = document.querySelector('#entry-food-search').value;
  const matches = matchingFoods(termo);
  populateFoodSelect(document.querySelector('#entry-food'), matches);
  describeMatches(document.querySelector('#entry-food-count'), matches, normalizeText(termo.trim()));
  updateEntryUnit(true);
}

function updateEntryUnit(resetQuantity = false) {
  const food = selectedEntryFood();
  const options = populateUnitSelect(document.querySelector('#entry-unit'), food);
  if (resetQuantity && !entryQuantityTouched) {
    const atual = options.find((option) => option.value === document.querySelector('#entry-unit').value);
    document.querySelector('#entry-quantity').value = defaultQuantityFor(food, atual);
  }
  updateEntryPreview();
}

// Mostra o que será gravado antes de gravar.
function updateEntryPreview() {
  const preview = document.querySelector('#entry-preview');
  const food = selectedEntryFood();
  const option = selectedEntryUnit();
  const digitado = Number(document.querySelector('#entry-quantity').value);
  if (!food || !option || !Number.isFinite(digitado) || digitado <= 0) {
    preview.textContent = 'Selecione um alimento e uma quantidade válida.';
    return;
  }
  const quantidade = Number((digitado * option.factor).toFixed(2));
  const nutrition = calculateNutrition(food, quantidade);
  preview.textContent = `${formatQuantity(quantidade, food)} de ${food.name} = ${formatNumber(nutrition.calories)} kcal · P ${formatNumber(nutrition.protein)} g · C ${formatNumber(nutrition.carbohydrates)} g · G ${formatNumber(nutrition.fat)} g`;
}

function fillEntryRecipeSelect() {
  const select = document.querySelector('#entry-recipe');
  select.replaceChildren();
  recipeList.forEach((recipe) => {
    const option = document.createElement('option');
    option.value = String(recipe.id);
    option.textContent = recipe.name;
    select.append(option);
  });
  updateEntryRecipePreview();
}

function updateEntryRecipePreview() {
  const preview = document.querySelector('#entry-recipe-preview');
  const recipe = recipeList.find((item) => String(item.id) === document.querySelector('#entry-recipe').value);
  if (!recipe) {
    preview.textContent = 'Você ainda não tem receitas. Crie uma na aba Alimentos.';
    return;
  }
  const items = (recipe.recipe_items || []).filter((item) => item.foods);
  if (!items.length) {
    preview.textContent = 'Esta receita está sem ingredientes.';
    return;
  }
  const totals = calculateRecipeTotals(items);
  preview.textContent = `${items.length} ${items.length === 1 ? 'item' : 'itens'} · ${formatNumber(totals.calories)} kcal: ${items.map((item) => `${item.foods.name} ${formatQuantity(item.quantity, item.foods)}`).join(', ')}`;
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  const feedback = document.querySelector('#entry-feedback');
  const button = document.querySelector('#entry-submit');
  const slotId = document.querySelector('#entry-slot').value;
  if (!slotId) {
    feedback.textContent = 'Escolha em qual refeição registrar.';
    return;
  }
  button.disabled = true;
  feedback.textContent = '';
  try {
    if (entryMode === 'recipe') {
      const recipe = recipeList.find((item) => String(item.id) === document.querySelector('#entry-recipe').value);
      const items = recipe ? (recipe.recipe_items || []).filter((item) => item.foods) : [];
      if (!items.length) {
        feedback.textContent = 'Escolha uma receita que tenha ingredientes.';
        return;
      }
      await addRecipeMeals(items.map((item) => ({ food_id: item.food_id, quantity: Number(item.quantity) })), slotId);
      showToast(`${recipe.name} registrada.`);
    } else {
      const food = selectedEntryFood();
      const option = selectedEntryUnit();
      const digitado = Number(document.querySelector('#entry-quantity').value);
      if (!food || !option) {
        feedback.textContent = 'Escolha um alimento.';
        return;
      }
      if (!Number.isFinite(digitado) || digitado <= 0) {
        feedback.textContent = 'Informe uma quantidade maior que zero.';
        return;
      }
      const quantidade = Number((digitado * option.factor).toFixed(2));
      if (quantidade > 100000) {
        feedback.textContent = 'Quantidade muito alta para este alimento.';
        return;
      }
      await addMeal(food.id, quantidade, slotId);
      showToast(`${food.name} registrado.`);
    }
    closeDialog('entry-dialog');
    await refreshDashboard();
  } catch (error) {
    feedback.textContent = `Não foi possível registrar. ${describeDatabaseError(error)}`;
  } finally {
    button.disabled = false;
  }
}

function renderNutrition(meals, goals = currentGoals()) {
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
  const [meals, slots] = await Promise.all([getTodayMeals(), loadMealSlots()]);
  renderMeals(meals, slots);
  renderNutrition(meals);
}

/* ---------------------------------------------------------
   Ligações de eventos
   --------------------------------------------------------- */

applyTheme(getStoredTheme());

// iPhone/iPad: o Safari amplia a página ao focar um campo e, depois que o teclado fecha,
// não volta à escala original. maximum-scale=1 desliga só esse zoom automático — o iOS
// continua permitindo ampliar com dois dedos. Fica restrito ao iOS porque no Android a
// mesma regra bloquearia a pinça, que é um recurso de acessibilidade.
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

if (isIOS()) {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.content.includes('maximum-scale')) {
    viewport.content = `${viewport.content}, maximum-scale=1`;
  }
}

// Quando o teclado fecha, o iOS às vezes deixa a página deslocada para o lado.
// Ao sair de um campo sem entrar em outro, devolve a tela à posição horizontal original.
document.addEventListener('focusout', () => {
  window.setTimeout(() => {
    const ativo = document.activeElement;
    if (ativo && ativo.matches('input, select, textarea')) return;
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
  }, 120);
});

document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
document.querySelector('[data-action="edit-slots"]').addEventListener('click', openSlotsDialog);
document.querySelector('[data-action="log-meal"]').addEventListener('click', () => openEntryDialog());
document.querySelector('#slot-add').addEventListener('click', addSlotDraftRow);
document.querySelector('#slots-form').addEventListener('submit', handleSlotsSubmit);
document.querySelector('#entry-form').addEventListener('submit', handleEntrySubmit);
document.querySelectorAll('[data-entry-mode]').forEach((button) => button.addEventListener('click', () => setEntryMode(button.dataset.entryMode)));
document.querySelector('#entry-food-search').addEventListener('input', fillEntryFoodSelect);
document.querySelector('#entry-food-search').addEventListener('keydown', (event) => { if (event.key === 'Enter') event.preventDefault(); });
document.querySelector('#entry-food').addEventListener('change', () => updateEntryUnit(true));
document.querySelector('#entry-unit').addEventListener('change', updateEntryPreview);
document.querySelector('#entry-quantity').addEventListener('input', () => { entryQuantityTouched = true; updateEntryPreview(); });
document.querySelector('#entry-recipe').addEventListener('change', updateEntryRecipePreview);
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
document.querySelector('#profile-form').addEventListener('submit', handleProfileSubmit);
document.querySelector('[data-action="edit-goals"]').addEventListener('click', () => openGoalsDialog(false));
document.querySelector('#goals-form').addEventListener('submit', handleGoalsSubmit);
document.querySelector('#goals-back').addEventListener('click', () => { captureGoalStep(goalStep); if (goalStep > 0) showGoalStep(goalStep - 1); });
// Enquanto o perfil nao estiver completo, Esc nao fecha o questionario.
document.querySelector('#goals-dialog').addEventListener('cancel', (event) => { if (goalsMandatory) event.preventDefault(); });
window.addEventListener('scroll', () => { document.querySelector('.topbar').classList.toggle('is-stuck', window.scrollY > 8); }, { passive: true });
