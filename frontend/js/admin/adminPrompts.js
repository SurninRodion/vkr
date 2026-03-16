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
    prompts.forEach((prompt) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prompt.title}</td>
        <td>${prompt.category || ''}</td>
        <td>
          <button class="btn btn-ghost" data-action="edit-prompt" data-id="${prompt.id}">
            Редактировать
          </button>
          <button class="btn btn-ghost" data-action="delete-prompt" data-id="${prompt.id}">
            Удалить
          </button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');

      const latestRes = await fetch(`${ADMIN_API_BASE}/prompts`, {
        headers: getAdminHeaders()
      });
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
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить промпты.', 'error');
  }
}

function fillPromptForm(prompt) {
  const titleEl = document.getElementById('prompt-title');
  const categoryEl = document.getElementById('prompt-category');
  const descriptionEl = document.getElementById('prompt-description');
  const exampleEl = document.getElementById('prompt-example');
  const analysisEl = document.getElementById('prompt-analysis');
  const modeEl = document.getElementById('prompt-form-mode');

  if (
    !titleEl ||
    !categoryEl ||
    !descriptionEl ||
    !exampleEl ||
    !analysisEl ||
    !modeEl
  )
    return;

  titleEl.value = prompt.title || '';
  categoryEl.value = prompt.category || '';
  descriptionEl.value = prompt.description || '';
  exampleEl.value = prompt.example || '';
  analysisEl.value = prompt.analysis || '';
  modeEl.textContent = 'Режим: редактирование';
  modeEl.dataset.editId = prompt.id;
}

function resetPromptForm() {
  const form = document.getElementById('prompt-form');
  const modeEl = document.getElementById('prompt-form-mode');
  if (form) form.reset();
  if (modeEl) {
    modeEl.textContent = 'Режим: создание';
    delete modeEl.dataset.editId;
  }
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

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-prompts-body')) return;

  loadPrompts();

  const form = document.getElementById('prompt-form');
  const resetBtn = document.getElementById('prompt-reset');
  if (form) form.addEventListener('submit', savePrompt);
  if (resetBtn) resetBtn.addEventListener('click', resetPromptForm);
});

