import { initNavbar, showToast } from '../ui.js';
import { apiGetProfile } from '../api.js';

const ADMIN_API_BASE = '/api/admin';

let adminCoursesCache = [];

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

async function ensureAdminAccess() {
  try {
    const profile = await apiGetProfile();
    if (!profile || profile.role !== 'admin') {
      showToast('Доступ разрешён только администраторам.', 'error');
      window.location.href = '/';
      return false;
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast('Не удалось проверить права доступа.', 'error');
    window.location.href = '/login';
    return false;
  }
}

async function loadDashboardStats() {
  const statsRoot = document.getElementById('admin-stats');
  if (!statsRoot) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/stats`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();

    const map = {
      'stat-total-users': data.totalUsers,
      'stat-total-tasks': data.totalTasks,
      'stat-total-prompts': data.totalPrompts,
      'stat-active-users': data.activeUsers
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value ?? '0');
    });
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить статистику.', 'error');
  }
}

function openAdminCourseDescModal(course) {
  const backdrop = document.getElementById('admin-course-desc-modal');
  const titleEl = document.getElementById('admin-course-desc-modal-title');
  const bodyEl = document.getElementById('admin-course-desc-modal-body');
  if (!backdrop || !titleEl || !bodyEl) return;
  titleEl.textContent = course.title || 'Курс';
  const desc = (course.description || '').trim();
  bodyEl.textContent = desc || 'Описание не задано.';
  backdrop.classList.add('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeAdminCourseDescModal() {
  const backdrop = document.getElementById('admin-course-desc-modal');
  if (!backdrop) return;
  backdrop.classList.remove('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'true');
}

async function loadCourses() {
  const body = document.getElementById('admin-courses-body');
  try {
    const res = await fetch(`${ADMIN_API_BASE}/courses`, { headers: getAdminHeaders() });
    if (!res.ok) throw new Error('failed');
    const courses = await res.json();
    adminCoursesCache = courses;

    if (body) {
      body.innerHTML = '';
      if (!courses.length) {
        const tr = document.createElement('tr');
        tr.className = 'admin-tasks-empty-row';
        tr.innerHTML = `<td colspan="4" class="admin-tasks-empty-cell">Пока нет курсов. Нажмите «Новый курс» или откройте конструктор курса в меню.</td>`;
        body.appendChild(tr);
      } else {
        courses.forEach((course) => {
          const tr = document.createElement('tr');
          const lessonsCount = Array.isArray(course.lessons) ? course.lessons.length : 0;
          const hasDesc = !!(course.description && String(course.description).trim());
          const descCell = hasDesc
            ? `<button type="button" class="btn btn-outline btn-sm" data-action="show-course-desc" data-id="${escapeHtml(course.id)}">Полное описание</button>`
            : '<span class="admin-badge-muted">Нет описания</span>';
          tr.innerHTML = `
          <td class="admin-task-title-cell">
            <span class="admin-task-title">${escapeHtml(course.title)}</span>
          </td>
          <td class="admin-task-points-cell">
            <span class="admin-task-points">${lessonsCount}</span>
          </td>
          <td>${descCell}</td>
          <td class="admin-task-actions-cell">
            <a href="/admin/course-builder?id=${encodeURIComponent(course.id)}" class="btn btn-outline btn-sm">Конструктор</a>
            <button type="button" class="btn btn-ghost btn-sm" data-action="delete-course" data-id="${escapeHtml(course.id)}">Удалить</button>
          </td>
        `;
          body.appendChild(tr);
        });
      }

      if (!body.dataset.coursesDelegateBound) {
        body.dataset.coursesDelegateBound = '1';
        body.addEventListener('click', async (e) => {
          const descBtn = e.target.closest('[data-action="show-course-desc"]');
          if (descBtn) {
            const id = descBtn.getAttribute('data-id');
            const course = adminCoursesCache.find((c) => c.id === id);
            if (course) openAdminCourseDescModal(course);
            return;
          }

          const btn = e.target.closest('button[data-action]');
          if (!btn) return;
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          if (!id || !action) return;

          if (action === 'delete-course') {
            if (!confirm('Удалить курс и все его уроки?')) return;
            await deleteCourse(id);
            await loadCourses();
          }
        });
      }
    }
    return courses;
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить курсы.', 'error');
    return [];
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function deleteCourse(id) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (!res.ok && res.status !== 204) {
      throw new Error('failed');
    }
    showToast('Курс удалён.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось удалить курс.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const ok = await ensureAdminAccess();
  if (!ok) return;

  if (document.getElementById('admin-stats')) {
    loadDashboardStats();
  }

  if (document.getElementById('admin-courses-body')) {
    loadCourses();

    const descModal = document.getElementById('admin-course-desc-modal');
    descModal?.addEventListener('click', (e) => {
      if (e.target === descModal || e.target.closest('[data-admin-course-desc-close]')) {
        closeAdminCourseDescModal();
      }
    });

    document.getElementById('btn-new-course')?.addEventListener('click', () => {
      window.location.href = '/admin/course-builder';
    });
  }
});

