import { apiGetTasks, apiGetCompletedTaskIds } from './api.js';
import { getAuthState } from './auth.js';
import { showToast } from './ui.js';

const difficultyLabels = {
  easy: { text: 'Базовый', className: 'tag tag-green' },
  medium: { text: 'Средний', className: 'tag tag-yellow' },
  hard: { text: 'Продвинутый', className: 'tag tag-red' },
};

function renderTasks(tasks, completedTaskIds = []) {
  const container = document.getElementById('tasks-list');
  if (!container) return;

  container.innerHTML = '';
  if (!tasks.length) {
    container.innerHTML = `<p class="muted">Пока нет заданий для выбранного уровня сложности.</p>`;
    return;
  }

  tasks.forEach((task) => {
    const completed = completedTaskIds.includes(task.id);
    const diffMeta = difficultyLabels[task.difficulty] || difficultyLabels.medium;
    const card = document.createElement('article');
    card.className = 'card' + (completed ? ' task-card--completed' : '');
    card.innerHTML = `
      <h3 class="card-title">${task.title}</h3>
      <p class="card-description">${task.description}</p>
      <div class="task-card-meta">
        <div class="task-meta">
          <span class="${diffMeta.className}">${diffMeta.text}</span>
          <span class="task-points">+${task.points} очков</span>
          ${completed ? '<span class="tag tag-done">Выполнено</span>' : ''}
        </div>
        <button class="btn ${completed ? 'btn-ghost' : 'btn-primary'}" data-task-id="${task.id}" data-completed="${completed}">
          ${completed ? 'Посмотреть результат' : 'Начать'}
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('button[data-task-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-task-id');
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      const { isAuthenticated } = getAuthState();

      if (!isAuthenticated) {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('backdrop--visible');
        return;
      }

      const completed = e.currentTarget.getAttribute('data-completed') === 'true';
      if (completed) {
        showToast('Открываем результат задания...', 'info');
      } else {
        showToast(`Задание «${task.title}» начато. Открываем лабораторию...`, 'success');
      }
      const url = new URL(window.location.origin + '/lab.html');
      url.searchParams.set('taskId', task.id);
      window.location.href = url.toString();
    });
  });
}

function initFilters(allTasks, completedTaskIds = []) {
  const filterButtons = document.querySelectorAll('[data-filter]');
  if (!filterButtons.length) return;

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selected = btn.getAttribute('data-filter');
      filterButtons.forEach((b) => b.classList.remove('chip--active'));
      btn.classList.add('chip--active');

      if (selected === 'all') {
        renderTasks(allTasks, completedTaskIds);
      } else {
        const filtered = allTasks.filter((t) => t.difficulty === selected);
        renderTasks(filtered, completedTaskIds);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('tasks-list');
  if (!container) return;

  const { isAuthenticated } = getAuthState();

  try {
    const [tasks, completedTaskIds] = await Promise.all([
      apiGetTasks(),
      isAuthenticated ? apiGetCompletedTaskIds().catch(() => []) : Promise.resolve([])
    ]);
    renderTasks(tasks, completedTaskIds);
    initFilters(tasks, completedTaskIds);
  } catch (e) {
    console.error(e);
    container.innerHTML =
      '<p class="muted">Не удалось загрузить задания. Обновите страницу позже.</p>';
  }
});

