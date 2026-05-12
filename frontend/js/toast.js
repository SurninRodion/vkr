export function showToast(message, type = 'success', { durationMs } = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const ttl =
    typeof durationMs === 'number' && durationMs > 0
      ? durationMs
      : type === 'achievement'
        ? 5600
        : 3500;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" aria-label="Закрыть уведомление">×</button>
  `;
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('toast--visible');
  });

  const remove = () => {
    if (!el.parentNode) return;
    el.classList.remove('toast--visible');
    setTimeout(() => {
      el.parentNode.removeChild(el);
    }, 220);
  };

  el.querySelector('.toast-close')?.addEventListener('click', remove);

  setTimeout(remove, ttl);
}
