function updateDate() {
  const now = new Date();
  document.querySelector('#day-number').textContent = now.getDate();
  document.querySelector('#month-label').textContent = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  document.querySelector('#today-label').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

async function initializeApp() {
  const redirect = readAuthRedirect();
  // Link expirado ou recusado: explica em vez de cair na tela de login sem dizer nada.
  if (redirect.error) {
    openAuthModal('login');
    document.querySelector('#auth-feedback').textContent = translateRedirectError(redirect.error);
    clearAuthRedirect();
    return;
  }
  if (redirect.type === 'recovery') {
    openAuthModal('reset');
    return;
  }
  const user = await getCurrentUser();
  if (!user) {
    openAuthModal();
    return;
  }
  showAuthenticatedApp(user);
  updateDate();
  // O perfil vem primeiro: é dele que saem as metas usadas no resumo do dia.
  await loadNutritionProfile().catch(() => showToast('Não foi possível carregar seu perfil.', 'error'));
  // Cada carga falha por conta própria: um erro em uma seção não deixa o resto da tela vazio.
  await Promise.all([
    loadFoodCatalog().catch(() => showToast('Não foi possível carregar os alimentos.', 'error')),
    loadRecipes().catch(() => showToast('Não foi possível carregar suas receitas.', 'error')),
    refreshDashboard().catch(() => showToast('Não foi possível carregar suas refeições.', 'error')),
  ]);
  // Conta nova ou perfil incompleto: o questionário abre e não pode ser dispensado.
  if (!isProfileComplete(nutritionProfile)) openGoalsDialog(true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=23').catch(() => {});
}

// Avisa uma vez, depois que a tela já decidiu o que mostrar.
function reportFileProtocol() {
  if (!isFileProtocol()) return;
  document.querySelector('#auth-feedback').textContent = FILE_PROTOCOL_MESSAGE;
  showToast('Abra o app por um servidor local, não pelo arquivo.', 'error');
}

document.addEventListener('DOMContentLoaded', () => initializeApp()
  .then(reportFileProtocol)
  .catch(() => {
    document.querySelector('#auth-feedback').textContent = 'Não foi possível carregar o aplicativo. Tente novamente.';
  }));
