// Acompanhamento de peso: uma pesagem por dia em weight_logs, privada de cada conta.
// profiles.weight continua sendo o peso usado no cálculo das metas; aqui fica o histórico.

// Janelas do gráfico, em dias. null = todo o histórico.
const WEIGHT_RANGES = { '30': 30, '90': 90, all: null };

async function getWeightLogs(sinceKey = null) {
  if (!hasSupabase()) return [];
  let query = supabaseClient.from('weight_logs').select('id, date, weight_kg').order('date');
  if (sinceKey) query = query.gte('date', sinceKey);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((log) => ({ ...log, weight_kg: Number(log.weight_kg) }));
}

// Registrar de novo no mesmo dia substitui o valor anterior (índice único por usuário e data).
async function saveWeightLog(dateKey, weightKg) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('weight_logs')
    .upsert({ user_id: user.id, date: dateKey, weight_kg: weightKg }, { onConflict: 'user_id,date' })
    .select('id, date, weight_kg')
    .single();
  if (error) throw error;
  return data;
}

async function deleteWeightLog(logId) {
  const { error } = await supabaseClient.from('weight_logs').delete().eq('id', logId);
  if (error) throw error;
}

async function saveTargetWeight(weightKg) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ target_weight: weightKg, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Quanto já foi percorrido do peso inicial até o peso-meta, de 0 a 100.
// Funciona para perder e para ganhar peso; passar da meta conta como 100.
function weightProgress(startKg, currentKg, targetKg) {
  const distancia = targetKg - startKg;
  if (!distancia) return currentKg === targetKg ? 100 : 0;
  const feito = (currentKg - startKg) / distancia;
  return Math.round(Math.min(1, Math.max(0, feito)) * 100);
}
