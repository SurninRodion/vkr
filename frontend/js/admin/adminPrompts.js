import { showToast } from '../ui.js';

const ADMIN_API_BASE = '/api/admin';

const CATEGORY_SLUGS = ['learning', 'coding', 'style', 'other'];

const CATEGORY_LABELS = {
  learning: 'Обучение',
  coding: 'Код',
  style: 'Тон и стиль',
  other: 'Прочее'
};

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatCategoryCell(raw) {
  const v = (raw || '').trim();
  if (CATEGORY_LABELS[v]) return CATEGORY_LABELS[v];
  return v || '—';
}

function getPromptFormPanel() {
  return document.getElementById('admin-prompt-form-panel');
}

function showPromptFormPanel() {
  const el = getPromptFormPanel();
  if (el) el.hidden = false;
}

function hidePromptFormPanel() {
  const el = getPromptFormPanel();
  if (el) el.hidden = true;
}

function setCategorySelect(value) {
  const sel = document.getElementById('prompt-category');
  if (!sel) return;
  sel.querySelector('option[data-legacy]')?.remove();
  const v = (value || '').trim();
  if (CATEGORY_SLUGS.includes(v)) {
    sel.value = v;
    return;
  }
  if (v) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    opt.dataset.legacy = '1';
    sel.appendChild(opt);
    sel.value = v;
  } else {
    sel.value = 'other';
  }
}

async function loadPrompts() {
  const body = document.getElementById('admin-prompts-body');
  if (!body) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/prompts`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const prompts = await res.json();

    body.innerHTML = '';
    if (!prompts.length) {
      const tr = document.createElement('tr');
      tr.className = 'admin-tasks-empty-row';
      tr.innerHTML = `<td colspan="3" class="admin-tasks-empty-cell">Пока нет сохранённых промптов. Нажмите «Новый промпт» или импортируйте JSON.</td>`;
      body.appendChild(tr);
    } else {
      prompts.forEach((prompt) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td class="admin-task-title-cell">
          <span class="admin-task-title">${escapeHtml(prompt.title)}</span>
        </td>
        <td>
          <span class="admin-badge-type">${escapeHtml(formatCategoryCell(prompt.category))}</span>
        </td>
        <td class="admin-task-actions-cell">
          <button type="button" class="btn btn-outline btn-sm" data-action="edit-prompt" data-id="${escapeHtml(prompt.id)}">Редактировать</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete-prompt" data-id="${escapeHtml(prompt.id)}">Удалить</button>
        </td>
      `;
        body.appendChild(tr);
      });
    }

    if (!body.dataset.promptsDelegateBound) {
      body.dataset.promptsDelegateBound = '1';
      body.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');

        const latestRes = await fetch(`${ADMIN_API_BASE}/prompts`, {
          headers: getAdminHeaders()
        });
        if (!latestRes.ok) {
          showToast('Не удалось загрузить список промптов.', 'error');
          return;
        }
        const latestPrompts = await latestRes.json();
        const prompt = latestPrompts.find((p) => p.id === id);
        if (!prompt) return;

        if (action === 'edit-prompt') {
          fillPromptForm(prompt);
        } else if (action === 'delete-prompt') {
          if (!confirm('Удалить промпт?')) return;
          await deletePrompt(id);
          await loadPrompts();
        }
      });
    }
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить промпты.', 'error');
  }
}

function fillPromptForm(prompt) {
  const titleEl = document.getElementById('prompt-title');
  const descriptionEl = document.getElementById('prompt-description');
  const exampleEl = document.getElementById('prompt-example');
  const analysisEl = document.getElementById('prompt-analysis');
  const modeEl = document.getElementById('prompt-form-mode');

  if (!titleEl || !descriptionEl || !exampleEl || !analysisEl || !modeEl) return;

  titleEl.value = prompt.title || '';
  setCategorySelect(prompt.category);
  descriptionEl.value = prompt.description || '';
  exampleEl.value = prompt.example || '';
  analysisEl.value = prompt.analysis || '';
  modeEl.textContent = 'Режим: редактирование';
  modeEl.dataset.editId = prompt.id;

  showPromptFormPanel();
  getPromptFormPanel()?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetPromptFormFields() {
  const form = document.getElementById('prompt-form');
  const modeEl = document.getElementById('prompt-form-mode');
  const sel = document.getElementById('prompt-category');
  sel?.querySelector('option[data-legacy]')?.remove();
  if (form) form.reset();
  if (sel) sel.value = 'learning';
  if (modeEl) {
    modeEl.textContent = 'Режим: создание';
    delete modeEl.dataset.editId;
  }
}

function resetPromptForm() {
  resetPromptFormFields();
  hidePromptFormPanel();
}

async function savePrompt(e) {
  e.preventDefault();

  const titleEl = document.getElementById('prompt-title');
  const categoryEl = document.getElementById('prompt-category');
  const descriptionEl = document.getElementById('prompt-description');
  const exampleEl = document.getElementById('prompt-example');
  const analysisEl = document.getElementById('prompt-analysis');
  const modeEl = document.getElementById('prompt-form-mode');
  const submitBtn = document.getElementById('prompt-submit');

  if (
    !titleEl ||
    !categoryEl ||
    !descriptionEl ||
    !exampleEl ||
    !analysisEl ||
    !modeEl ||
    !submitBtn
  )
    return;

  const payload = {
    title: titleEl.value,
    category: categoryEl.value,
    description: descriptionEl.value,
    example: exampleEl.value,
    analysis: analysisEl.value
  };

  submitBtn.classList.add('disabled');

  try {
    const editId = modeEl.dataset.editId;
    const method = editId ? 'PUT' : 'POST';
    const url = editId
      ? `${ADMIN_API_BASE}/prompts/${encodeURIComponent(editId)}`
      : `${ADMIN_API_BASE}/prompts`;

    const res = await fetch(url, {
      method,
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('failed');

    showToast('Промпт сохранён.', 'success');
    resetPromptForm();
    await loadPrompts();
  } catch (e) {
    console.error(e);
    showToast('Не удалось сохранить промпт.', 'error');
  } finally {
    submitBtn.classList.remove('disabled');
  }
}

async function deletePrompt(id) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/prompts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (!res.ok && res.status !== 204) throw new Error('failed');
    showToast('Промпт удалён.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось удалить промпт.', 'error');
  }
}

async function handleImportPromptsJson(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const prompts = Array.isArray(data.prompts) ? data.prompts : [];
    if (!prompts.length) {
      showToast('В файле нет промптов (нужен массив prompts).', 'error');
      return;
    }

    const res = await fetch(`${ADMIN_API_BASE}/import/prompts`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ prompts })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(payload.message || 'Ошибка импорта JSON.', 'error');
      return;
    }
    const n = typeof payload.imported === 'number' ? payload.imported : prompts.length;
    showToast(`Импортировано промптов: ${n}.`, 'success');
    await loadPrompts();
  } catch (e) {
    console.error(e);
    showToast('Ошибка импорта JSON.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-prompts-body')) return;

  loadPrompts();

  const form = document.getElementById('prompt-form');
  const resetBtn = document.getElementById('prompt-reset');
  const importBtn = document.getElementById('btn-import-prompts-json');
  const importInput = document.getElementById('import-prompts-file-input');

  if (form) form.addEventListener('submit', savePrompt);
  if (resetBtn) resetBtn.addEventListener('click', resetPromptForm);

  const newBtn = document.getElementById('btn-new-prompt');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      resetPromptFormFields();
      showPromptFormPanel();
      document.getElementById('prompt-title')?.focus();
      getPromptFormPanel()?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleImportPromptsJson(file);
      importInput.value = '';
    });
  }
});
