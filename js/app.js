function updateDate() {
  const now = new Date();
  document.querySelector('#day-number').textContent = now.getDate();
  document.querySelector('#month-label').textContent = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
  document.querySelector('#today-label').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

async function initializeApp() {
  if (window.location.hash.includes('type=recovery')) {
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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=15').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => initializeApp().catch((error) => {
  document.querySelector('#auth-feedback').textContent = 'Não foi possível carregar o aplicativo. Tente novamente.';
}));
