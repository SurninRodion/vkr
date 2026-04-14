import { showToast } from '../ui.js';

const ADMIN_API_BASE = '/api/admin';

const KNOWN_TASK_TYPES = new Set(['improvement', 'lesson', 'optimization', 'generic', 'generated']);

let allTasksCache = [];

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
    
  }

  return headers;
}

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function labelDifficulty(d) {
  const m = { easy: 'Лёгкая', medium: 'Средняя', hard: 'Сложная' };
  return m[d] || d;
}

function labelType(t) {
  const raw = String(t ?? '')
    .toLowerCase()
    .trim();
  const m = {
    improvement: 'Улучшение промпта',
    lesson: 'Урок / план',
    optimization: 'Оптимизация',
    generic: 'Общее',
    generated: 'Сгенерированное',
  };
  if (m[raw]) return m[raw];
  if (!raw) return '—';
  return `Другой (${String(t)})`;
}

function clearDynamicTaskTypes() {
  const sel = document.getElementById('task-type');
  if (!sel) return;
  sel.querySelectorAll('option[data-dynamic]').forEach((o) => o.remove());
}

function ensureTaskTypeOption(type) {
  const sel = document.getElementById('task-type');
  if (!sel || !type) return;
  if (!KNOWN_TASK_TYPES.has(type)) {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = `${type} (другой)`;
    opt.setAttribute('data-dynamic', '1');
    sel.appendChild(opt);
  }
  sel.value = type;
}

function parsePointsBound(v) {
  if (v === '' || v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function buildTypeFilterOptions(tasks) {
  const sel = document.getElementById('filter-type');
  if (!sel) return;
  const prev = sel.value;
  const unique = [...new Set(tasks.map((t) => t.type).filter((x) => x != null && String(x).trim() !== ''))].sort(
    (a, b) => String(a).localeCompare(String(b), 'ru')
  );
  sel.innerHTML = '<option value="">Все типы</option>';
  unique.forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = labelType(type);
    sel.appendChild(opt);
  });
  const has = [...sel.options].some((o) => o.value === prev);
  if (has) sel.value = prev;
}

function getFilteredTasks() {
  let list = allTasksCache.slice();
  const fDiff = document.getElementById('filter-difficulty')?.value || '';
  const fType = document.getElementById('filter-type')?.value || '';
  const minV = parsePointsBound(document.getElementById('filter-points-min')?.value);
  const maxV = parsePointsBound(document.getElementById('filter-points-max')?.value);

  if (fDiff) list = list.filter((t) => t.difficulty === fDiff);
  if (fType) list = list.filter((t) => String(t.type) === fType);
  if (!Number.isNaN(minV)) list = list.filter((t) => Number(t.points) >= minV);
  if (!Number.isNaN(maxV)) list = list.filter((t) => Number(t.points) <= maxV);
  return list;
}

function renderTaskRows(tasks) {
  const body = document.getElementById('admin-tasks-body');
  if (!body) return;

  body.innerHTML = '';

  if (!tasks.length && !allTasksCache.length) {
    const tr = document.createElement('tr');
    tr.className = 'admin-tasks-empty-row';
    tr.innerHTML = `<td colspan="5" class="admin-tasks-empty-cell">Нет заданий. Создайте задание или импортируйте JSON.</td>`;
    body.appendChild(tr);
    return;
  }

  if (!tasks.length && allTasksCache.length) {
    const tr = document.createElement('tr');
    tr.className = 'admin-tasks-empty-row';
    tr.innerHTML = `<td colspan="5" class="admin-tasks-empty-cell">Нет заданий по выбранным фильтрам. Измените условия или нажмите «Сбросить фильтры».</td>`;
    body.appendChild(tr);
    return;
  }

  tasks.forEach((task) => {
    const tr = document.createElement('tr');
    const diffClass = ['easy', 'medium', 'hard'].includes(task.difficulty)
      ? `admin-badge-diff admin-badge-diff--${task.difficulty}`
      : 'admin-badge-diff admin-badge-diff--unknown';
    tr.innerHTML = `
        <td class="admin-task-title-cell">
          <span class="admin-task-title">${escapeHtml(task.title)}</span>
        </td>
        <td>
          <span class="${diffClass}">${escapeHtml(labelDifficulty(task.difficulty))}</span>
        </td>
        <td class="admin-task-points-cell">
          <span class="admin-task-points">${escapeHtml(String(task.points ?? '—'))}</span>
        </td>
        <td>
          <span class="admin-badge-type">${escapeHtml(labelType(task.type))}</span>
        </td>
        <td class="admin-task-actions-cell">
          <button type="button" class="btn btn-outline btn-sm" data-action="edit-task" data-id="${task.id}">Редактировать</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete-task" data-id="${task.id}">Удалить</button>
        </td>
      `;
    body.appendChild(tr);
  });
}

function applyFiltersAndRender() {
  renderTaskRows(getFilteredTasks());
}

function resetTaskFilters() {
  const d = document.getElementById('filter-difficulty');
  const t = document.getElementById('filter-type');
  const a = document.getElementById('filter-points-min');
  const b = document.getElementById('filter-points-max');
  if (d) d.value = '';
  if (t) t.value = '';
  if (a) a.value = '';
  if (b) b.value = '';
  applyFiltersAndRender();
}

async function loadTasks() {
  const body = document.getElementById('admin-tasks-body');
  if (!body) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/tasks`, {
      headers: getAdminHeaders(),
    });
    if (!res.ok) throw new Error('failed');
    const tasks = await res.json();
    allTasksCache = tasks;
    buildTypeFilterOptions(tasks);
    applyFiltersAndRender();
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
  const modeEl = document.getElementById('task-form-mode');

  if (!titleEl || !descEl || !diffEl || !pointsEl || !modeEl) return;

  titleEl.value = task.title || '';
  descEl.value = task.description || '';
  diffEl.value = task.difficulty || 'medium';
  pointsEl.value = task.points || 0;

  clearDynamicTaskTypes();
  ensureTaskTypeOption(task.type || 'generic');

  modeEl.textContent = 'Режим: редактирование';
  modeEl.dataset.editId = task.id;

  document.getElementById('task-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getTaskFormPanel() {
  return document.getElementById('admin-task-form-panel');
}

function showTaskFormPanel() {
  const el = getTaskFormPanel();
  if (el) el.hidden = false;
}

function hideTaskFormPanel() {
  const el = getTaskFormPanel();
  if (el) el.hidden = true;
}

function resetTaskFormFields() {
  const form = document.getElementById('task-form');
  const modeEl = document.getElementById('task-form-mode');
  if (form) form.reset();
  const diffEl = document.getElementById('task-difficulty');
  if (diffEl) diffEl.value = 'medium';
  clearDynamicTaskTypes();
  const typeEl = document.getElementById('task-type');
  if (typeEl) typeEl.value = 'generic';
  if (modeEl) {
    modeEl.textContent = 'Режим: создание';
    delete modeEl.dataset.editId;
  }
}

function resetTaskForm() {
  resetTaskFormFields();
  hideTaskFormPanel();
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
    type: typeEl.value,
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
      body: JSON.stringify(payload),
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
      headers: getAdminHeaders(),
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
      body: JSON.stringify({ tasks }),
    });
    if (!res.ok) throw new Error('failed');
    showToast('Задания импортированы.', 'success');
    await loadTasks();
  } catch (e) {
    console.error(e);
    showToast('Ошибка импорта JSON.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-tasks-body')) return;

  const tbody = document.getElementById('admin-tasks-body');
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id) return;

    const latestRes = await fetch(`${ADMIN_API_BASE}/tasks`, {
      headers: getAdminHeaders(),
    });
    if (!latestRes.ok) return;
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

  loadTasks();

  const filterDiff = document.getElementById('filter-difficulty');
  const filterType = document.getElementById('filter-type');
  const filterMin = document.getElementById('filter-points-min');
  const filterMax = document.getElementById('filter-points-max');
  const filterReset = document.getElementById('filter-reset');
  const onFilterChange = () => applyFiltersAndRender();
  if (filterDiff) filterDiff.addEventListener('change', onFilterChange);
  if (filterType) filterType.addEventListener('change', onFilterChange);
  if (filterMin) filterMin.addEventListener('input', onFilterChange);
  if (filterMax) filterMax.addEventListener('input', onFilterChange);
  if (filterReset) filterReset.addEventListener('click', resetTaskFilters);

  const form = document.getElementById('task-form');
  const resetBtn = document.getElementById('task-reset');
  const importBtn = document.getElementById('btn-import-json');
  const importInput = document.getElementById('import-file-input');
  const createBtn = document.getElementById('btn-create-task');

  if (form) form.addEventListener('submit', saveTask);
  if (resetBtn) resetBtn.addEventListener('click', resetTaskForm);
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      resetTaskFormFields();
      showTaskFormPanel();
      document.getElementById('task-title')?.focus();
      getTaskFormPanel()?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleImportJson(file);
      importInput.value = '';
    });
  }
});
