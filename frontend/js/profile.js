import {
  apiGetProfile,
  apiUpdateProfile,
  apiGetMyCourses,
  apiResendVerification,
  apiVerifyEmail,
  rateLimitEmailMessage,
} from './api.js';
import { getAuthState } from './auth.js';
import { pluralRu } from './pluralize.js';
import { showToast } from './ui.js';
const AUTH_STORAGE_KEY = 'promptlearn_auth';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function getUrlParams() {
  try {
    const url = new URL(window.location.href);
    return {
      verifyToken: url.searchParams.get('verifyToken') || '',
      needsEmailVerify: url.searchParams.get('needsEmailVerify') === '1',
    };
  } catch {
    return { verifyToken: '', needsEmailVerify: false };
  }
}

function updateStoredEmailVerified(value) {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    if (!parsed.user || typeof parsed.user !== 'object') return;
    parsed.user.emailVerified = Boolean(value);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new CustomEvent('auth:change', { detail: parsed }));
  } catch {
    // ignore
  }
}

function ensureEmailVerifyModal() {
  let modal = document.getElementById('email-verify-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'backdrop';
  modal.id = 'email-verify-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal">
      <h3 class="modal-title" id="email-verify-title">Подтверждение email</h3>
      <p class="modal-body" id="email-verify-body">
        Мы отправили письмо с ссылкой для подтверждения. Откройте почту (и «Спам») и перейдите по ссылке.
      </p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" data-email-verify-close>Закрыть</button>
        <button class="btn btn-primary" type="button" data-email-verify-resend>Отправить письмо ещё раз</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('backdrop--visible');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  document.body.appendChild(modal);
  return modal;
}

function openEmailVerifyModal({ title, body, showResend = true } = {}) {
  const modal = ensureEmailVerifyModal();
  const titleEl = modal.querySelector('#email-verify-title');
  const bodyEl = modal.querySelector('#email-verify-body');
  const resendBtn = modal.querySelector('[data-email-verify-resend]');

  if (titleEl && title) titleEl.textContent = title;
  if (bodyEl && body) bodyEl.textContent = body;
  if (resendBtn) resendBtn.style.display = showResend ? '' : 'none';

  const closeBtn = modal.querySelector('[data-email-verify-close]');
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('backdrop--visible');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  if (resendBtn && !resendBtn.dataset.bound) {
    resendBtn.dataset.bound = '1';
    resendBtn.addEventListener('click', async () => {
      resendBtn.classList.add('disabled');
      try {
        await apiResendVerification();
        showToast('Письмо отправлено. Проверьте почту (и «Спам»).', 'success');
      } catch (err) {
        console.error(err);
        const rl = rateLimitEmailMessage(err);
        showToast(rl || 'Не удалось отправить письмо. Попробуйте позже.', 'error');
      } finally {
        resendBtn.classList.remove('disabled');
      }
    });
  }

  modal.classList.add('backdrop--visible');
  modal.setAttribute('aria-hidden', 'false');
  return modal;
}

function renderProfile(root, profile, myCourses = []) {
  const isVerified = Boolean(profile.emailVerified);
  const verificationHtml = isVerified
    ? `
      <div class="stat-row">
        <span class="stat-label">Email</span>
        <span class="stat-value">Подтверждён</span>
      </div>
    `
    : `
      <div class="stat-row">
        <span class="stat-label">Email</span>
        <span class="stat-value">
          <span style="display:inline-flex; gap: 10px; align-items: center;">
            <span>Не подтверждён</span>
            <button class="btn btn-outline btn-sm" type="button" id="resend-verification-btn">Отправить письмо ещё раз</button>
          </span>
        </span>
      </div>
      <div class="muted" style="margin-top: 8px; font-size: 13px;">
        Подтверждение email нужно, чтобы пользоваться практикой и анализом промптов.
      </div>
    `;

  const myCoursesHtml =
    myCourses.length > 0
      ? `
    <div class="profile-my-courses">
      <h2 class="section-title">Мои курсы</h2>
      <div class="my-courses-list">
        ${myCourses
          .map(
            (c) => `
          <a href="/course?id=${encodeURIComponent(c.courseId)}" class="my-course-card">
            <div class="my-course-card-title">${escapeHtml(c.title)}</div>
            <div class="my-course-card-meta">
              <span class="my-course-progress">Прогресс: ${c.progressPercent}%</span>
              <span class="my-course-lessons">${c.completedLessons}/${c.totalLessons} ${pluralRu(c.totalLessons, ['урок', 'урока', 'уроков'])}</span>
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
      <p class="muted">Вы пока не записаны ни на один курс. <a href="/courses">Выбрать курс</a></p>
    </div>
  `;

  root.innerHTML = `
    <div class="profile-main">
      <div class="profile-header">
        <div class="profile-avatar">
          ${escapeHtml(
            profile.name
              .split(' ')
              .map((p) => p[0])
              .join('')
              .slice(0, 2)
          )}
        </div>
        <div>
          <div class="profile-name">${escapeHtml(profile.name)}</div>
          <div class="profile-email">${escapeHtml(profile.email)}</div>
        </div>
      </div>
      <div class="stat-row">
        <span class="stat-label">Решённые задания</span>
        <span class="stat-value">${profile.solvedTasks}</span>
      </div>
      ${verificationHtml}
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
      <div class="profile-level-card" aria-label="Уровень на платформе">
        <div class="profile-level-card-bg" aria-hidden="true"></div>
        <div class="profile-level-card-inner">
          <span class="profile-level-icon" aria-hidden="true">🏆</span>
          <div class="profile-level-copy">
            <span class="profile-level-label">Ваш уровень</span>
            <span class="profile-level-name">${escapeHtml(profile.level)}</span>
          </div>
        </div>
      </div>

      <section class="profile-side-section">
        <h2 class="profile-side-heading">Настройки профиля</h2>
        <p class="profile-side-lead">Имя видно в рейтинге. Email изменить нельзя.</p>
        <form id="profile-form" class="profile-form">
          <div class="profile-form-field">
            <label class="form-label" for="profile-name">Имя и фамилия</label>
            <input
              id="profile-name"
              name="name"
              class="form-input"
              type="text"
              value="${escapeHtml(profile.name)}"
              autocomplete="name"
            />
          </div>
          <div class="profile-form-field">
            <label class="form-label" for="profile-email-readonly">Email</label>
            <input
              id="profile-email-readonly"
              class="form-input form-input--disabled"
              type="email"
              value="${escapeHtml(profile.email)}"
              disabled
              readonly
            />
          </div>
          <button class="btn btn-primary profile-form-submit" type="submit" id="profile-save-btn">
            Сохранить изменения
          </button>
        </form>
      </section>

      <section class="profile-side-section profile-side-section--achievements">
        <h2 class="profile-side-heading">Достижения</h2>
        ${
          profile.achievements && profile.achievements.length > 0
            ? `<ul class="profile-achievements-list">
          ${profile.achievements.map((a) => `<li class="profile-achievement-item"><span class="profile-achievement-check" aria-hidden="true">✓</span><span>${escapeHtml(a)}</span></li>`).join('')}
        </ul>`
            : `<p class="profile-achievements-empty muted">Пока нет открытых достижений — решайте задания и проходите курсы.</p>`
        }
      </section>
    </aside>
  `;

  const form = root.querySelector('#profile-form');
  const saveBtn = root.querySelector('#profile-save-btn');
  const resendBtn = root.querySelector('#resend-verification-btn');

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

  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      resendBtn.classList.add('disabled');
      try {
        await apiResendVerification();
        showToast('Письмо отправлено. Проверьте почту (и «Спам»).', 'success');
      } catch (err) {
        console.error(err);
        const rl = rateLimitEmailMessage(err);
        showToast(rl || 'Не удалось отправить письмо. Попробуйте позже.', 'error');
      } finally {
        resendBtn.classList.remove('disabled');
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
    const { verifyToken, needsEmailVerify } = getUrlParams();

    if (needsEmailVerify) {
      openEmailVerifyModal();
    }

    if (verifyToken) {
      openEmailVerifyModal({
        title: 'Подтверждаем email…',
        body: 'Пожалуйста, подождите пару секунд.',
        showResend: false,
      });

      try {
        await apiVerifyEmail(verifyToken);
        updateStoredEmailVerified(true);
        openEmailVerifyModal({
          title: 'Email подтверждён',
          body: 'Готово. Теперь доступны практика и анализ промптов.',
          showResend: false,
        });
        showToast('Email подтверждён.', 'success');
      } catch (err) {
        console.error(err);
        openEmailVerifyModal({
          title: 'Не удалось подтвердить email',
          body: 'Возможно, ссылка устарела. Нажмите «Отправить письмо ещё раз» и попробуйте снова.',
          showResend: true,
        });
      }

      // очистим query-параметры, чтобы при обновлении страницы не повторять запрос
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('verifyToken');
        url.searchParams.delete('needsEmailVerify');
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }

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

