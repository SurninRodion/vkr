import { showToast } from '../ui.js';

const ADMIN_API_BASE = '/api/admin';

function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const raw = localStorage.getItem('promptlearn_auth');
    if (!raw) return headers;
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      headers.Authorization = `Bearer ${parsed.token}`;
    }
  } catch {
    // ignore parse errors
  }

  return headers;
}

async function loadTasks() {
  const body = document.getElementById('admin-tasks-body');
  if (!body) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/tasks`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const tasks = await res.json();

    body.innerHTML = '';
    tasks.forEach((task) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${task.title}</td>
        <td>${task.difficulty}</td>
        <td>${task.points}</td>
        <td>${task.type}</td>
        <td>
          <button class="btn btn-ghost" data-action="edit-task" data-id="${task.id}">Редактировать</button>
          <button class="btn btn-ghost" data-action="delete-task" data-id="${task.id}">Удалить</button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');

      const latestRes = await fetch(`${ADMIN_API_BASE}/tasks`, {
        headers: getAdminHeaders()
      });
      const latestTasks = await latestRes.json();
      const task = latestTasks.find((t) => t.id === id);
      if (!task) return;

      if (action === 'edit-task') {
        fillTaskForm(task);
      } else if (action === 'delete-task') {
        if (!confirm('Удалить задание?')) return;
        await deleteTask(id);
        await loadTasks();
      }
    });
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить задания.', 'error');
  }
}

function fillTaskForm(task) {
  const titleEl = document.getElementById('task-title');
  const descEl = document.getElementById('task-description');
  const diffEl = document.getElementById('task-difficulty');
  const pointsEl = document.getElementById('task-points');
  const typeEl = document.getElementById('task-type');
  const modeEl = document.getElementById('task-form-mode');

  if (!titleEl || !descEl || !diffEl || !pointsEl || !typeEl || !modeEl) return;

  titleEl.value = task.title || '';
  descEl.value = task.description || '';
  diffEl.value = task.difficulty || 'medium';
  pointsEl.value = task.points || 0;
  typeEl.value = task.type || 'generic';
  modeEl.textContent = 'Режим: редактирование';
  modeEl.dataset.editId = task.id;
}

function resetTaskForm() {
  const form = document.getElementById('task-form');
  const modeEl = document.getElementById('task-form-mode');
  if (form) form.reset();
  const diffEl = document.getElementById('task-difficulty');
  if (diffEl) diffEl.value = 'medium';
  if (modeEl) {
    modeEl.textContent = 'Режим: создание';
    delete modeEl.dataset.editId;
  }
}

async function saveTask(e) {
  e.preventDefault();

  const titleEl = document.getElementById('task-title');
  const descEl = document.getElementById('task-description');
  const diffEl = document.getElementById('task-difficulty');
  const pointsEl = document.getElementById('task-points');
  const typeEl = document.getElementById('task-type');
  const modeEl = document.getElementById('task-form-mode');
  const submitBtn = document.getElementById('task-submit');

  if (!titleEl || !descEl || !diffEl || !pointsEl || !typeEl || !modeEl || !submitBtn) return;

  const payload = {
    title: titleEl.value,
    description: descEl.value,
    difficulty: diffEl.value,
    points: Number(pointsEl.value),
    type: typeEl.value
  };

  submitBtn.classList.add('disabled');

  try {
    const editId = modeEl.dataset.editId;
    const method = editId ? 'PUT' : 'POST';
    const url = editId
      ? `${ADMIN_API_BASE}/tasks/${encodeURIComponent(editId)}`
      : `${ADMIN_API_BASE}/tasks`;

    const res = await fetch(url, {
      method,
    headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('failed');

    showToast('Задание сохранено.', 'success');
    resetTaskForm();
    await loadTasks();
  } catch (e) {
    console.error(e);
    showToast('Не удалось сохранить задание.', 'error');
  } finally {
    submitBtn.classList.remove('disabled');
  }
}

async function deleteTask(id) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (!res.ok && res.status !== 204) throw new Error('failed');
    showToast('Задание удалено.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось удалить задание.', 'error');
  }
}

async function handleImportJson(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    if (!tasks.length) {
      showToast('В файле нет заданий.', 'error');
      return;
    }

    const res = await fetch(`${ADMIN_API_BASE}/import/tasks`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ tasks })
    });
    if (!res.ok) throw new Error('failed');
    showToast('Задания импортированы.', 'success');
    await loadTasks();
  } catch (e) {
    console.error(e);
    showToast('Ошибка импорта JSON.', 'error');
  }
}

async function generateTasksAI(e) {
  e.preventDefault();

  const topicEl = document.getElementById('ai-topic');
  const countEl = document.getElementById('ai-count');
  const diffEl = document.getElementById('ai-difficulty');
  const btn = document.getElementById('ai-generate-btn');
  const container = document.getElementById('ai-generated-tasks');

  if (!topicEl || !countEl || !diffEl || !btn || !container) return;

  btn.classList.add('disabled');
  container.innerHTML = '';

  try {
    const payload = {
      topic: topicEl.value,
      count: Number(countEl.value) || 3,
      difficulty: diffEl.value
    };

    const res = await fetch(`${ADMIN_API_BASE}/tasks/generate-ai`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const tasks = data.tasks || [];

    if (!tasks.length) {
      showToast('AI не вернул задания.', 'error');
      return;
    }

    container.innerHTML = '';
    tasks.forEach((task, index) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <h4 class="card-title">${task.title}</h4>
        <p class="card-description">${task.description}</p>
        <div class="task-card-meta">
          <div class="task-meta">
            <span class="tag tag-yellow">${task.difficulty}</span>
            <span class="task-points">+${task.points} очков</span>
          </div>
          <button class="btn btn-outline" data-index="${index}">В форму</button>
        </div>
      `;
      card.querySelector('button')?.addEventListener('click', () => {
        fillTaskForm(task);
      });
      container.appendChild(card);
    });

    showToast('Задания сгенерированы через AI.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось сгенерировать задания через AI.', 'error');
  } finally {
    btn.classList.remove('disabled');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-tasks-body')) return;

  loadTasks();

  const form = document.getElementById('task-form');
  const resetBtn = document.getElementById('task-reset');
  const importBtn = document.getElementById('btn-import-json');
  const importInput = document.getElementById('import-file-input');
  const aiForm = document.getElementById('ai-generate-form');

  if (form) form.addEventListener('submit', saveTask);
  if (resetBtn) resetBtn.addEventListener('click', resetTaskForm);

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleImportJson(file);
      importInput.value = '';
    });
  }

  if (aiForm) {
    aiForm.addEventListener('submit', generateTasksAI);
  }
});

