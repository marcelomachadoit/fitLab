// Metas nutricionais estimadas: Mifflin-St Jeor -> TDEE -> meta calórica -> macros.
// Toda a metodologia está nestas constantes; nenhum destes números aparece solto no resto
// do código. São estimativas populacionais: o gasto real varia de pessoa para pessoa.

// Multiplicadores de atividade usuais para TDEE a partir da Mifflin-St Jeor.
const ACTIVITY_LEVELS = {
  sedentary: { factor: 1.2, label: 'Sedentário', hint: 'Pouco ou nenhum exercício.' },
  light: { factor: 1.375, label: 'Pouco ativo', hint: 'Exercícios leves 1 a 3 dias por semana.' },
  moderate: { factor: 1.55, label: 'Moderadamente ativo', hint: 'Exercícios moderados 3 a 5 dias por semana.' },
  active: { factor: 1.725, label: 'Muito ativo', hint: 'Exercícios intensos 6 a 7 dias por semana.' },
  very_active: { factor: 1.9, label: 'Extremamente ativo', hint: 'Treino muito intenso ou trabalho físico pesado.' },
};

// Ajuste calórico e proteína por kg de peso corporal, por objetivo.
// Déficit e superávit ficam em faixas moderadas de propósito; a proteína sobe no déficit,
// onde preservar massa magra importa mais, dentro do intervalo usual de 1,6 a 2,2 g/kg.
const GOALS = {
  loss_moderate: { calorieFactor: 0.80, proteinPerKg: 2.2, label: 'Perder gordura', hint: 'Déficit moderado, cerca de 20% do gasto.' },
  loss_light: { calorieFactor: 0.90, proteinPerKg: 2.0, label: 'Perder gordura devagar', hint: 'Déficit leve, cerca de 10% do gasto.' },
  maintenance: { calorieFactor: 1.00, proteinPerKg: 1.8, label: 'Manter o peso', hint: 'Consumo igual ao gasto estimado.' },
  gain_light: { calorieFactor: 1.05, proteinPerKg: 1.8, label: 'Ganhar massa devagar', hint: 'Superávit leve, cerca de 5% do gasto.' },
  gain_moderate: { calorieFactor: 1.10, proteinPerKg: 2.0, label: 'Ganhar massa muscular', hint: 'Superávit moderado, cerca de 10% do gasto.' },
};

const SEX_OPTIONS = { male: 'Masculino', female: 'Feminino' };

const FAT_GRAMS_PER_KG = 0.9;        // dentro da faixa usual de 0,8 a 1,0 g/kg
const MIN_TARGET_CALORIES = 1200;    // piso de segurança para déficits agressivos
const MIN_CARB_SHARE = 0.05;         // carboidrato nunca fica zerado
const CALORIES_PER_GRAM = { protein: 4, carbohydrates: 4, fat: 9 };

const PROFILE_LIMITS = {
  weight: { min: 30, max: 300 },
  height: { min: 100, max: 250 },
  age: { min: 13, max: 100 },
};

/* ---------------------------------------------------------
   Cálculo
   --------------------------------------------------------- */

// Mifflin-St Jeor, em kcal/dia.
function calculateBMR(weight, height, age, sex) {
  const base = (10 * weight) + (6.25 * height) - (5 * age);
  return sex === 'female' ? base - 161 : base + 5;
}

function calculateTDEE(bmr, activityLevel) {
  const level = ACTIVITY_LEVELS[activityLevel] || ACTIVITY_LEVELS.sedentary;
  return bmr * level.factor;
}

function calculateTargetCalories(tdee, goal) {
  const config = GOALS[goal] || GOALS.maintenance;
  return Math.max(MIN_TARGET_CALORIES, Math.round(tdee * config.calorieFactor));
}

// Proteína e gordura saem do peso corporal; o carboidrato fica com as calorias restantes.
// Se proteína e gordura sozinhas passarem da meta (acontece em déficit grande com peso alto),
// as duas são reduzidas proporcionalmente para sobrar espaço mínimo de carboidrato — assim a
// soma dos macros nunca contradiz a meta calórica mostrada ao usuário.
function calculateMacros(targetCalories, weight, goal) {
  const config = GOALS[goal] || GOALS.maintenance;
  let proteinGrams = weight * config.proteinPerKg;
  let fatGrams = weight * FAT_GRAMS_PER_KG;

  const budget = targetCalories * (1 - MIN_CARB_SHARE);
  const used = (proteinGrams * CALORIES_PER_GRAM.protein) + (fatGrams * CALORIES_PER_GRAM.fat);
  let adjusted = false;
  if (used > budget) {
    const scale = budget / used;
    proteinGrams *= scale;
    fatGrams *= scale;
    adjusted = true;
  }

  const remaining = targetCalories - (proteinGrams * CALORIES_PER_GRAM.protein) - (fatGrams * CALORIES_PER_GRAM.fat);
  return {
    protein_g: Math.round(proteinGrams),
    fat_g: Math.round(fatGrams),
    carbs_g: Math.round(Math.max(0, remaining) / CALORIES_PER_GRAM.carbohydrates),
    macros_adjusted: adjusted,
  };
}

// Orquestra os passos acima. Além dos números, sinaliza quando um limite de segurança
// precisou entrar em ação — é o que a interface usa para avisar sobre casos extremos.
function calculateNutritionGoals(answers) {
  const config = GOALS[answers.goal] || GOALS.maintenance;
  const bmr = calculateBMR(answers.weight, answers.height, answers.age, answers.sex);
  const tdee = calculateTDEE(bmr, answers.activity_level);
  const rawTarget = Math.round(tdee * config.calorieFactor);
  const targetCalories = calculateTargetCalories(tdee, answers.goal);
  const macros = calculateMacros(targetCalories, answers.weight, answers.goal);
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target_calories: targetCalories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    floor_applied: targetCalories > rawTarget,
    macros_adjusted: macros.macros_adjusted,
  };
}

// Avisos para situações em que a estimativa deixa de fazer sentido sozinha.
// Não são erros: o cálculo continua válido, mas o caso pede avaliação individual.
function describeGoalWarnings(goals) {
  const avisos = [];
  if (goals.floor_applied) {
    avisos.push(`A meta parou no piso de ${MIN_TARGET_CALORIES.toLocaleString('pt-BR')} kcal, acima do seu gasto estimado de ${goals.tdee.toLocaleString('pt-BR')} kcal. Reduzir calorias a partir de um gasto tão baixo não é seguro por conta própria: procure um nutricionista ou médico antes de seguir com esse objetivo.`);
  }
  if (goals.macros_adjusted) {
    avisos.push('A proteína e a gordura precisaram ser reduzidas para caber na meta calórica, o que indica uma combinação exigente de peso e déficit. A distribuição adequada para o seu caso deve ser definida por um profissional.');
  }
  return avisos;
}

// Reconstrói as respostas a partir da linha salva em profiles, já como números.
function profileAnswers(profile) {
  return {
    weight: Number(profile.weight),
    height: Number(profile.height),
    age: Number(profile.age),
    sex: profile.sex,
    activity_level: profile.activity_level,
    goal: profile.goal,
  };
}

/* ---------------------------------------------------------
   Validação
   --------------------------------------------------------- */

function validateProfileNumber(value, limits) {
  return Number.isFinite(value) && value >= limits.min && value <= limits.max;
}

// Devolve a mensagem do primeiro problema encontrado, ou null quando está tudo válido.
function validateNutritionAnswers(answers) {
  if (!validateProfileNumber(answers.weight, PROFILE_LIMITS.weight)) {
    return `Informe um peso entre ${PROFILE_LIMITS.weight.min} e ${PROFILE_LIMITS.weight.max} kg.`;
  }
  if (!validateProfileNumber(answers.height, PROFILE_LIMITS.height)) {
    return `Informe uma altura entre ${PROFILE_LIMITS.height.min} e ${PROFILE_LIMITS.height.max} cm.`;
  }
  if (!validateProfileNumber(answers.age, PROFILE_LIMITS.age) || !Number.isInteger(answers.age)) {
    return `Informe uma idade inteira entre ${PROFILE_LIMITS.age.min} e ${PROFILE_LIMITS.age.max} anos.`;
  }
  if (!SEX_OPTIONS[answers.sex]) return 'Escolha uma opção de sexo.';
  if (!ACTIVITY_LEVELS[answers.activity_level]) return 'Escolha seu nível de atividade física.';
  if (!GOALS[answers.goal]) return 'Escolha seu objetivo.';
  return null;
}

function isProfileComplete(profile) {
  if (!profile) return false;
  return Boolean(profile.weight && profile.height && profile.age && profile.sex
    && profile.activity_level && profile.goal && profile.target_calories);
}

/* ---------------------------------------------------------
   Persistência — sempre na linha do próprio usuário
   --------------------------------------------------------- */

async function getNutritionProfile() {
  if (!hasSupabase()) return null;
  // A RLS de profiles já limita a consulta à linha do usuário autenticado.
  const { data, error } = await supabaseClient.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

async function saveNutritionProfile(answers, goals, fallbackName = '') {
  const user = await getCurrentUser();
  if (!user) return null;
  const payload = {
    id: user.id,
    name: fallbackName || user.user_metadata?.name || user.email.split('@')[0],
    weight: answers.weight,
    height: answers.height,
    age: answers.age,
    sex: answers.sex,
    activity_level: answers.activity_level,
    goal: answers.goal,
    bmr: goals.bmr,
    tdee: goals.tdee,
    target_calories: goals.target_calories,
    protein_g: goals.protein_g,
    carbs_g: goals.carbs_g,
    fat_g: goals.fat_g,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseClient.from('profiles').upsert(payload, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return data;
}

async function saveProfileName(name) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .upsert({ id: user.id, name, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
