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
    
  }

  return headers;
}

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function formatLastSeen(iso) {
  if (iso == null || String(iso).trim() === '') return '—';
  const s = String(iso).trim();
  const asDate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(asDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function bindUsersTableOnce(body) {
  if (body.dataset.usersDelegateBound) return;
  body.dataset.usersDelegateBound = '1';

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
    if (!id) return;
    if (!confirm('Удалить пользователя?')) return;
    await deleteUser(id);
    await loadUsers();
  });
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
    bindUsersTableOnce(body);

    if (!users.length) {
      const tr = document.createElement('tr');
      tr.className = 'admin-tasks-empty-row';
      tr.innerHTML = `<td colspan="8" class="admin-tasks-empty-cell">Пока нет пользователей.</td>`;
      body.appendChild(tr);
      return;
    }

    users.forEach((user, index) => {
      const num = index + 1;
      const tr = document.createElement('tr');
      const role = user.role === 'admin' ? 'admin' : 'user';
      const email = user.email || '';
      tr.innerHTML = `
        <td class="admin-task-points-cell admin-users-col-num">
          <span class="admin-task-points">${num}</span>
        </td>
        <td class="admin-task-title-cell admin-users-name-cell">
          <span class="admin-users-name-text" title="${escapeHtml(user.name)}">${escapeHtml(user.name)}</span>
        </td>
        <td class="admin-users-email-cell admin-users-col-email" title="${escapeHtml(email)}"><span class="admin-users-email-text">${escapeHtml(email)}</span></td>
        <td class="admin-task-points-cell admin-users-col-stat">
          <span class="admin-task-points">${escapeHtml(String(user.points ?? 0))}</span>
        </td>
        <td class="admin-task-points-cell admin-users-col-stat">
          <span class="admin-task-points">${escapeHtml(String(user.level ?? 1))}</span>
        </td>
        <td class="admin-users-role-cell">
          <select data-action="change-role" data-id="${escapeHtml(user.id)}" class="form-input admin-users-role-select" aria-label="Роль пользователя">
            <option value="user" ${role === 'user' ? 'selected' : ''}>Пользователь</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Админ</option>
          </select>
        </td>
        <td class="admin-users-last-seen-cell">${escapeHtml(formatLastSeen(user.last_seen_at))}</td>
        <td class="admin-task-actions-cell admin-users-actions-cell">
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete-user" data-id="${escapeHtml(user.id)}">Удалить</button>
        </td>
      `;
      body.appendChild(tr);
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
    await loadUsers();
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
