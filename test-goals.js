const fs = require('fs');

// Testes das metas nutricionais. Rode com: node test-goals.js
// Carrega goals.js num escopo isolado, sem DOM nem Supabase, sem dependencia externa.
const src = fs.readFileSync(require('path').join(__dirname, 'js/goals.js'), 'utf8');
const sandbox = {};
// goals.js usa t() e appLocale() do módulo de idiomas; aqui basta o português, que é a chave.
const i18nMinimo = `
  function appLocale() { return 'pt-BR'; }
  function t(texto, ...valores) { return texto.replace(/\\{(\\d+)\\}/g, (marca, i) => (valores[i] ?? marca)); }
`;
new Function('exports', `${i18nMinimo}${src}
  exports.calculateBMR = calculateBMR;
  exports.calculateTDEE = calculateTDEE;
  exports.calculateTargetCalories = calculateTargetCalories;
  exports.calculateMacros = calculateMacros;
  exports.calculateNutritionGoals = calculateNutritionGoals;
  exports.validateNutritionAnswers = validateNutritionAnswers;
  exports.isProfileComplete = isProfileComplete;
  exports.describeGoalWarnings = describeGoalWarnings;
  exports.profileAnswers = profileAnswers;
  exports.ACTIVITY_LEVELS = ACTIVITY_LEVELS;
  exports.GOALS = GOALS;
  exports.FAT_GRAMS_PER_KG = FAT_GRAMS_PER_KG;
  exports.MIN_TARGET_CALORIES = MIN_TARGET_CALORIES;
`)(sandbox);

const {
  calculateBMR, calculateTDEE, calculateTargetCalories, calculateNutritionGoals,
  validateNutritionAnswers, isProfileComplete, describeGoalWarnings, profileAnswers,
  ACTIVITY_LEVELS, GOALS, FAT_GRAMS_PER_KG,
} = sandbox;

let falhas = 0;
function checa(nome, real, esperado, tolerancia = 0) {
  const ok = Math.abs(real - esperado) <= tolerancia;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}: ${real} (esperado ${esperado}${tolerancia ? ' ±' + tolerancia : ''})`);
}
function afirma(nome, condicao, detalhe = '') {
  if (!condicao) falhas += 1;
  console.log(`${condicao ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' -> ' + detalhe : ''}`);
}

console.log('== BMR (Mifflin-St Jeor, conferido na mão) ==');
// Homem 75 kg, 175 cm, 24 anos: 750 + 1093,75 - 120 + 5
checa('homem 75 kg / 175 cm / 24 anos', calculateBMR(75, 175, 24, 'male'), 1728.75, 0.01);
// Mulher 60 kg, 165 cm, 24 anos: 600 + 1031,25 - 120 - 161
checa('mulher 60 kg / 165 cm / 24 anos', calculateBMR(60, 165, 24, 'female'), 1350.25, 0.01);

console.log('\n== TDEE por nível de atividade ==');
const bmrHomem = calculateBMR(75, 175, 24, 'male');
Object.entries(ACTIVITY_LEVELS).forEach(([nivel, config]) => {
  checa(`${nivel} (x${config.factor})`, calculateTDEE(bmrHomem, nivel), bmrHomem * config.factor, 0.01);
});

console.log('\n== Meta calórica por objetivo (homem moderadamente ativo) ==');
const tdeeHomem = calculateTDEE(bmrHomem, 'moderate');
console.log(`   TDEE de referência: ${Math.round(tdeeHomem)} kcal`);
Object.entries(GOALS).forEach(([objetivo, config]) => {
  checa(`${objetivo} (x${config.calorieFactor})`, calculateTargetCalories(tdeeHomem, objetivo), Math.round(tdeeHomem * config.calorieFactor));
});

console.log('\n== Casos completos ==');
const casos = [
  ['1. Homem 24a 75kg 175cm moderado, perder gordura', { weight: 75, height: 175, age: 24, sex: 'male', activity_level: 'moderate', goal: 'loss_moderate' }],
  ['2. Mulher 24a 60kg 165cm moderada, perder gordura', { weight: 60, height: 165, age: 24, sex: 'female', activity_level: 'moderate', goal: 'loss_moderate' }],
  ['3. Sedentário 40a 90kg 180cm, manutenção', { weight: 90, height: 180, age: 40, sex: 'male', activity_level: 'sedentary', goal: 'maintenance' }],
  ['4. Muito ativo 28a 70kg 172cm, ganhar massa', { weight: 70, height: 172, age: 28, sex: 'male', activity_level: 'active', goal: 'gain_moderate' }],
  ['5. Extremamente ativa 30a 65kg 170cm, manutenção', { weight: 65, height: 170, age: 30, sex: 'female', activity_level: 'very_active', goal: 'maintenance' }],
  ['6. Caso extremo: 150kg sedentário, déficit moderado', { weight: 150, height: 180, age: 50, sex: 'male', activity_level: 'sedentary', goal: 'loss_moderate' }],
  ['7. Caso extremo: 40kg 150cm 70a sedentária, déficit', { weight: 40, height: 150, age: 70, sex: 'female', activity_level: 'sedentary', goal: 'loss_moderate' }],
];

casos.forEach(([nome, resposta]) => {
  const metas = calculateNutritionGoals(resposta);
  const kcalMacros = (metas.protein_g * 4) + (metas.carbs_g * 4) + (metas.fat_g * 9);
  const desvio = Math.abs(kcalMacros - metas.target_calories);
  const proteinaPorKg = metas.protein_g / resposta.weight;
  console.log(`\n${nome}`);
  console.log(`   BMR ${metas.bmr} | TDEE ${metas.tdee} | meta ${metas.target_calories} kcal`);
  console.log(`   P ${metas.protein_g} g | C ${metas.carbs_g} g | G ${metas.fat_g} g  (macros somam ${Math.round(kcalMacros)} kcal)`);
  afirma('   meta respeita o piso de segurança', metas.target_calories >= sandbox.MIN_TARGET_CALORIES);
  afirma('   macros batem com a meta (±20 kcal de arredondamento)', desvio <= 20, `desvio ${Math.round(desvio)} kcal`);
  afirma('   nenhum macro negativo', metas.protein_g >= 0 && metas.carbs_g >= 0 && metas.fat_g >= 0);
  afirma('   carboidrato não zerado', metas.carbs_g > 0);
  afirma('   proteína entre 1,2 e 2,2 g/kg', proteinaPorKg >= 1.2 && proteinaPorKg <= 2.2 + 0.05, `${proteinaPorKg.toFixed(2)} g/kg`);
});

console.log('\n== Objetivo muda a meta na direção certa ==');
const base = { weight: 75, height: 175, age: 24, sex: 'male', activity_level: 'moderate' };
const perda = calculateNutritionGoals({ ...base, goal: 'loss_moderate' });
const manutencao = calculateNutritionGoals({ ...base, goal: 'maintenance' });
const ganho = calculateNutritionGoals({ ...base, goal: 'gain_moderate' });
afirma('déficit < manutenção < superávit', perda.target_calories < manutencao.target_calories && manutencao.target_calories < ganho.target_calories,
  `${perda.target_calories} < ${manutencao.target_calories} < ${ganho.target_calories}`);
afirma('manutenção é igual ao TDEE', manutencao.target_calories === manutencao.tdee);
afirma('TDEE é o mesmo nos três (o objetivo não altera o gasto)', perda.tdee === manutencao.tdee && manutencao.tdee === ganho.tdee);
afirma('déficit aumenta a proteína por kg', perda.protein_g > manutencao.protein_g);

console.log('\n== Alterar dados recalcula ==');
const antes = calculateNutritionGoals({ ...base, goal: 'maintenance' });
const depois = calculateNutritionGoals({ ...base, weight: 85, goal: 'maintenance' });
afirma('peso maior -> meta maior', depois.target_calories > antes.target_calories, `${antes.target_calories} -> ${depois.target_calories}`);
afirma('peso maior -> mais proteína', depois.protein_g > antes.protein_g, `${antes.protein_g} g -> ${depois.protein_g} g`);
afirma('gordura segue o peso (0,9 g/kg)', depois.fat_g === Math.round(85 * FAT_GRAMS_PER_KG), `${depois.fat_g} g`);

console.log('\n== Validação ==');
const validos = { weight: 75, height: 175, age: 24, sex: 'male', activity_level: 'moderate', goal: 'maintenance' };
afirma('conjunto válido passa', validateNutritionAnswers(validos) === null);
[
  ['peso vazio', { ...validos, weight: NaN }],
  ['peso zero', { ...validos, weight: 0 }],
  ['peso negativo', { ...validos, weight: -70 }],
  ['peso absurdo', { ...validos, weight: 900 }],
  ['altura absurda', { ...validos, height: 400 }],
  ['idade zero', { ...validos, age: 0 }],
  ['idade quebrada', { ...validos, age: 24.5 }],
  ['sexo ausente', { ...validos, sex: null }],
  ['sexo fora da lista', { ...validos, sex: 'outro' }],
  ['atividade ausente', { ...validos, activity_level: null }],
  ['objetivo inválido', { ...validos, goal: 'derreter' }],
].forEach(([nome, resposta]) => {
  const erro = validateNutritionAnswers(resposta);
  afirma(`rejeita ${nome}`, typeof erro === 'string' && erro.length > 0, erro || 'PASSOU INDEVIDAMENTE');
});

afirma('mensagem de validação traz os limites reais', validateNutritionAnswers({ ...validos, weight: 0 }) === 'Informe um peso entre 30 e 300 kg.', validateNutritionAnswers({ ...validos, weight: 0 }));

console.log('\n== Perfil completo x incompleto ==');
afirma('usuário sem perfil abre o questionário', isProfileComplete(null) === false);
afirma('perfil recém-criado pelo trigger (só nome) abre', isProfileComplete({ id: 'x', name: 'Ana' }) === false);
afirma('perfil sem metas calculadas abre', isProfileComplete({ ...validos, target_calories: null }) === false);
afirma('perfil completo não abre', isProfileComplete({ ...validos, target_calories: 2400 }) === true);

console.log('\n== Avisos de caso extremo ==');
const normal = calculateNutritionGoals({ weight: 75, height: 175, age: 24, sex: 'male', activity_level: 'moderate', goal: 'loss_moderate' });
afirma('caso comum não dispara aviso', describeGoalWarnings(normal).length === 0 && !normal.floor_applied && !normal.macros_adjusted);

const pisoAtingido = calculateNutritionGoals({ weight: 40, height: 150, age: 70, sex: 'female', activity_level: 'sedentary', goal: 'loss_moderate' });
afirma('piso de segurança sinalizado', pisoAtingido.floor_applied === true, `meta ${pisoAtingido.target_calories} > TDEE ${pisoAtingido.tdee}`);
afirma('aviso do piso manda procurar profissional', describeGoalWarnings(pisoAtingido).some((t) => /nutricionista ou médico/.test(t)));

const macrosAjustados = calculateNutritionGoals({ weight: 150, height: 180, age: 50, sex: 'male', activity_level: 'sedentary', goal: 'loss_moderate' });
afirma('ajuste de macros sinalizado', macrosAjustados.macros_adjusted === true);
afirma('aviso do ajuste cita profissional', describeGoalWarnings(macrosAjustados).some((t) => /profissional/.test(t)));

const extremo = calculateNutritionGoals({ weight: 30, height: 100, age: 100, sex: 'female', activity_level: 'sedentary', goal: 'loss_moderate' });
console.log(`   perfil no limite inferior aceito: TDEE ${extremo.tdee}, meta ${extremo.target_calories}, ${describeGoalWarnings(extremo).length} aviso(s)`);
afirma('perfil extremo gera ao menos um aviso', describeGoalWarnings(extremo).length >= 1);

const respostas = profileAnswers({ weight: '80.5', height: '180', age: '30', sex: 'male', activity_level: 'active', goal: 'gain_light' });
afirma('profileAnswers converte números vindos do banco', respostas.weight === 80.5 && respostas.height === 180 && respostas.age === 30);
afirma('profileAnswers não carrega sinalizadores para o banco', !('floor_applied' in respostas) && !('macros_adjusted' in respostas));
afirma('avisos recalculados do perfil salvo batem com os do cálculo',
  describeGoalWarnings(calculateNutritionGoals(profileAnswers({ weight: 40, height: 150, age: 70, sex: 'female', activity_level: 'sedentary', goal: 'loss_moderate' }))).length
  === describeGoalWarnings(pisoAtingido).length);

console.log(`\n${falhas ? falhas + ' FALHAS' : 'todos os testes passaram'}`);
process.exit(falhas ? 1 : 0);
