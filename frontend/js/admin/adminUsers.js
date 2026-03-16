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

async function loadUsers() {
  const body = document.getElementById('admin-users-body');
  if (!body) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/users`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const users = await res.json();

    body.innerHTML = '';
    users.forEach((user) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.points}</td>
        <td>${user.level}</td>
        <td>
          <select data-action="change-role" data-id="${user.id}" class="form-input" style="width: 120px">
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
          </select>
        </td>
        <td>
          <button class="btn btn-ghost" data-action="delete-user" data-id="${user.id}">
            Удалить
          </button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.addEventListener('change', async (e) => {
      const select = e.target.closest('select[data-action="change-role"]');
      if (!select) return;
      const id = select.getAttribute('data-id');
      const role = select.value;
      await updateUserRole(id, role);
    });

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action="delete-user"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!confirm('Удалить пользователя?')) return;
      await deleteUser(id);
      await loadUsers();
    });
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить пользователей.', 'error');
  }
}

async function updateUserRole(id, role) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify({ role })
    });
    if (!res.ok) throw new Error('failed');
    showToast('Роль пользователя обновлена.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось обновить роль пользователя.', 'error');
  }
}

async function deleteUser(id) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (!res.ok && res.status !== 204) throw new Error('failed');
    showToast('Пользователь удалён.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось удалить пользователя.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-users-body')) return;
  loadUsers();
});

