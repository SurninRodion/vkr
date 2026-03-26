/** Отдельный модуль без зависимостей от auth/ui — избегает циклического импорта auth ↔ ui. */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" aria-label="Закрыть уведомление">×</button>
  `;
  container.appendChild(el);

  const remove = () => {
    if (!el.parentNode) return;
    el.parentNode.removeChild(el);
  };

  el.querySelector('.toast-close')?.addEventListener('click', remove);

  setTimeout(remove, 3500);
}
