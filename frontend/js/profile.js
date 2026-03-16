import { apiGetProfile, apiUpdateProfile, apiGetMyCourses } from './api.js';
import { getAuthState } from './auth.js';
import { showToast } from './ui.js';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderProfile(root, profile, myCourses = []) {
  const myCoursesHtml =
    myCourses.length > 0
      ? `
    <div class="profile-my-courses">
      <h2 class="section-title">Мои курсы</h2>
      <div class="my-courses-list">
        ${myCourses
          .map(
            (c) => `
          <a href="./course.html?id=${encodeURIComponent(c.courseId)}" class="my-course-card">
            <div class="my-course-card-title">${escapeHtml(c.title)}</div>
            <div class="my-course-card-meta">
              <span class="my-course-progress">Прогресс: ${c.progressPercent}%</span>
              <span class="my-course-lessons">${c.completedLessons}/${c.totalLessons} уроков</span>
            </div>
            <div class="progress-bar-track progress-bar-track--sm">
              <div class="progress-bar-fill" style="transform: scaleX(${c.progressPercent / 100})"></div>
            </div>
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  `
      : `
    <div class="profile-my-courses">
      <h2 class="section-title">Мои курсы</h2>
      <p class="muted">Вы пока не записаны ни на один курс. <a href="./courses.html">Выбрать курс</a></p>
    </div>
  `;

  root.innerHTML = `
    <div class="profile-main">
      <div class="profile-header">
        <div class="profile-avatar">
          ${profile.name
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <div class="profile-name">${profile.name}</div>
          <div class="profile-email">${profile.email}</div>
        </div>
      </div>
      <div class="stat-row">
        <span class="stat-label">Решённые задания</span>
        <span class="stat-value">${profile.solvedTasks}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Средняя оценка промптов</span>
        <span class="stat-value">${profile.avgPromptScore.toFixed(1)} / 5</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Очки</span>
        <span class="stat-value">${profile.points}</span>
      </div>
      ${myCoursesHtml}
    </div>
    <aside class="profile-side">
      <div class="level-pill">
        <span>🏆</span>
        <span>${profile.level}</span>
      </div>

      <form id="profile-form" class="profile-form">
        <div class="form-group">
          <label class="form-label" for="profile-name">Имя и фамилия</label>
          <input
            id="profile-name"
            name="name"
            class="input"
            type="text"
            value="${profile.name}"
            autocomplete="name"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input
            class="input"
            type="email"
            value="${profile.email}"
            disabled
          />
        </div>
        <button class="btn btn-primary" type="submit" id="profile-save-btn">
          Сохранить профиль
        </button>
      </form>

      <div style="margin-top: 16px; font-size: 13px">
        <div class="muted">Достижения</div>
        <ul style="margin: 6px 0 0; padding-left: 16px; font-size: 13px">
          ${profile.achievements.map((a) => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    </aside>
  `;

  const form = root.querySelector('#profile-form');
  const saveBtn = root.querySelector('#profile-save-btn');

  if (form && saveBtn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const name = (formData.get('name') || '').toString().trim();

      if (!name) {
        showToast('Заполните поле «Имя и фамилия».', 'error');
        return;
      }

      saveBtn.classList.add('disabled');
      try {
        const updated = await apiUpdateProfile({ name });
        const { enrollments } = await apiGetMyCourses();
        renderProfile(root, updated, enrollments);
        showToast('Профиль обновлён.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Не удалось сохранить профиль. Попробуйте ещё раз.', 'error');
      } finally {
        saveBtn.classList.remove('disabled');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('profile-root');
  if (!root) return;

  const { isAuthenticated } = getAuthState();
  const modal = document.getElementById('auth-modal');

  if (!isAuthenticated) {
    if (modal) modal.classList.add('backdrop--visible');
    return;
  }

  try {
    const [profile, myCoursesRes] = await Promise.all([
      apiGetProfile(),
      apiGetMyCourses(),
    ]);
    const myCourses = myCoursesRes.enrollments || [];
    renderProfile(root, profile, myCourses);
  } catch (e) {
    console.error(e);
    root.innerHTML =
      '<p class="muted">Не удалось загрузить профиль. Попробуйте обновить страницу позже.</p>';
  }
});

