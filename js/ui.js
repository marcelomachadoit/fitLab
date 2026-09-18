function showView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.target === viewName));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showToast(message) {
  const toast = document.querySelector('.toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}
document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.target)));
document.querySelectorAll('[data-action="add-meal"]').forEach((button) => button.addEventListener('click', () => showToast('O formulário de refeições entra na próxima etapa.')));
document.querySelectorAll('.food-item').forEach((button) => button.addEventListener('click', () => showToast('Alimento selecionado. Em breve você poderá informar a quantidade.')));
