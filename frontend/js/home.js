import { apiGetTasks, apiGetCompletedTaskIds } from './api.js';
import { getAuthState } from './auth.js';

const difficultyLabels = {
  easy: { text: 'Базовый уровень', className: 'tag tag-green' },
  medium: { text: 'Средний уровень', className: 'tag tag-yellow' },
  hard: { text: 'Продвинутый', className: 'tag tag-red' }
};

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

async function loadHomePopularTasks() {
  const container = document.getElementById('home-popular-tasks');
  if (!container) return;

  container.innerHTML = '<p class="muted home-popular-tasks-placeholder">Загрузка заданий…</p>';

  try {
    const tasks = await apiGetTasks();
    const sorted = [...tasks].sort((a, b) => (b.points || 0) - (a.points || 0));
    const top = sorted.slice(0, 3);

    if (!top.length) {
      container.innerHTML =
        '<p class="muted">Пока нет заданий. Загляните в раздел «Практика» позже.</p>';
      return;
    }

    let completedIds = [];
    if (getAuthState().isAuthenticated) {
      try {
        completedIds = await apiGetCompletedTaskIds();
      } catch {
        completedIds = [];
      }
    }

    container.innerHTML = '';
    top.forEach((task) => {
      const done = completedIds.includes(task.id);
      const diff = difficultyLabels[task.difficulty] || difficultyLabels.medium;
      const a = document.createElement('a');
      a.href = `/lab?taskId=${encodeURIComponent(task.id)}`;
      a.className = 'card home-task-card' + (done ? ' task-card--completed' : '');
      a.setAttribute('aria-label', `${task.title}. Перейти к решению в лаборатории.`);
      a.innerHTML = `
        <h3 class="card-title">${escapeHtml(task.title)}</h3>
        <p class="card-description">${escapeHtml(task.description)}</p>
        <div class="task-card-meta">
          <div class="task-meta">
            <span class="${diff.className}">${escapeHtml(diff.text)}</span>
            <span class="task-points">+${escapeHtml(String(task.points))} очков</span>
            ${done ? '<span class="tag tag-done">Выполнено</span>' : ''}
          </div>
          <span class="btn btn-outline home-task-card-cta" aria-hidden="true">${done ? 'Открыть' : 'К решению'}</span>
        </div>
      `;
      container.appendChild(a);
    });
  } catch (e) {
    console.error(e);
    container.innerHTML =
      '<p class="muted">Не удалось загрузить задания. Обновите страницу позже.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('home-popular-tasks')) {
    loadHomePopularTasks();
  }
});

window.addEventListener('auth:change', () => {
  if (document.getElementById('home-popular-tasks')) {
    loadHomePopularTasks();
  }
});
