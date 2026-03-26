import { apiGetCourses, apiGetMyCourses, apiEnrollCourse } from './api.js';
import { getAuthState } from './auth.js';
import { showToast, initAuthGate } from './ui.js';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('courses-grid');
  const loadingEl = document.getElementById('courses-loading');
  if (!grid) return;

  if (!initAuthGate()) return;

  try {
    const { isAuthenticated: token } = getAuthState();
    const [courses, myCoursesRes] = await Promise.all([
      apiGetCourses(),
      token ? apiGetMyCourses().catch(() => ({ enrollments: [] })) : Promise.resolve({ enrollments: [] }),
    ]);
    const enrolledIds = new Set((myCoursesRes.enrollments || []).map((e) => e.courseId));

    if (loadingEl) loadingEl.remove();

    if (!courses || !courses.length) {
      grid.innerHTML = '<p class="muted">Пока нет доступных курсов.</p>';
      return;
    }

    const tagByIndex = (i) => (i === 0 ? 'tag-green' : 'tag-yellow');
    const labelByIndex = (i) => (i === 0 ? 'Новичкам' : 'Средний');

    grid.innerHTML = courses
      .map(
        (c, i) => {
          const lessonsCount = c.lessonsCount != null ? c.lessonsCount : 0;
          const isEnrolled = enrolledIds.has(c.id);
          const mainBtn = isEnrolled
            ? `<a href="/course?id=${encodeURIComponent(c.id)}" class="btn btn-primary">Открыть программу</a>`
            : token
              ? `<span class="course-card-actions"><a href="/course?id=${encodeURIComponent(c.id)}" class="btn btn-outline">Программа</a><button type="button" class="btn btn-primary" data-enroll="${encodeURIComponent(c.id)}">Записаться на курс</button></span>`
              : `<button type="button" class="btn btn-outline" data-action="guest-only">Открыть программу</button>`;
          return `
          <article class="card" data-course-id="${escapeHtml(c.id)}">
            <h3 class="card-title">${escapeHtml(c.title)}</h3>
            <p class="card-description">${escapeHtml(c.description || '')}</p>
            <div class="task-card-meta">
              <div class="task-meta">
                <span class="tag ${tagByIndex(i)}">${labelByIndex(i)}</span>
                <span class="task-points">${lessonsCount} модулей</span>
              </div>
              ${mainBtn}
            </div>
          </article>
        `;
        }
      )
      .join('');

    grid.querySelectorAll('[data-enroll]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const courseId = btn.getAttribute('data-enroll');
        if (!courseId) return;
        btn.disabled = true;
        try {
          await apiEnrollCourse(courseId);
          showToast('Вы записаны на курс.', 'success');
          btn.replaceWith(
            Object.assign(document.createElement('a'), {
              href: `/course?id=${encodeURIComponent(courseId)}`,
              className: 'btn btn-primary',
              textContent: 'Открыть программу',
            })
          );
        } catch (e) {
          showToast(e.message || 'Не удалось записаться на курс.', 'error');
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    console.error(e);
    if (loadingEl) loadingEl.textContent = 'Не удалось загрузить курсы. Обновите страницу.';
    else grid.innerHTML = '<p class="muted">Не удалось загрузить курсы. Обновите страницу.</p>';
  }
});
