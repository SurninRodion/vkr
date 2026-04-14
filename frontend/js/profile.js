import {
  apiGetProfile,
  apiUpdateProfile,
  apiGetMyCourses,
  apiGetMyCertificates,
  apiGetMyCertificateHtml,
  apiDownloadMyCertificatePdf,
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

  const certificates = profile.certificates || [];
  const certsHtml =
    certificates.length > 0
      ? `
    <div class="profile-my-courses" style="margin-top: 18px;">
      <h2 class="section-title">Мои сертификаты</h2>
      <div class="my-courses-list">
        ${certificates
          .map(
            (c) => `
          <button type="button" class="my-course-card my-course-card--button" data-cert-open="${escapeHtml(c.id)}">
            <div class="my-course-card-title">${escapeHtml(c.courseTitle || 'Курс')}</div>
            <div class="my-course-card-meta">
              <span class="my-course-progress">Серийный №: ${escapeHtml(c.serial || '')}</span>
              <span class="my-course-lessons">Выдан: ${escapeHtml(c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('ru-RU') : '')}</span>
            </div>
          </button>
        `
          )
          .join('')}
      </div>
    </div>
  `
      : `
    <div class="profile-my-courses" style="margin-top: 18px;">
      <h2 class="section-title">Мои сертификаты</h2>
      <p class="muted">Пока нет сертификатов — пройдите курс до конца, и сертификат появится здесь.</p>
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
      ${certsHtml}
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

  ensureCertificateModal();
  root.querySelectorAll('[data-cert-open]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-cert-open');
      if (!id) return;
      openCertificateModal(id);
    });
  });

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

function injectViewerScale(htmlString) {
  const html = String(htmlString || '');
  if (!html) return html;
  const injectedStyle = `
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; }
      body { display:flex; align-items:center; justify-content:center; background:#ffffff; }
      .page { transform-origin: top left; box-shadow: 0 20px 70px rgba(15, 23, 42, 0.18); }
    </style>
  `.trim();
  const injectedScript = `
    <script>
      (function () {
        function fit() {
          var page = document.querySelector('.page');
          if (!page) return;
          page.style.transform = '';
          var pr = page.getBoundingClientRect();
          var vw = window.innerWidth;
          var vh = window.innerHeight;
          if (!pr.width || !pr.height) return;
          var s = Math.min(vw / pr.width, vh / pr.height);
          if (!isFinite(s) || s <= 0) s = 1;
          page.style.transform = 'scale(' + s.toFixed(4) + ')';
        }
        window.addEventListener('resize', fit);
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(fit).catch(fit);
        }
        setTimeout(fit, 0);
      })();
    </script>
  `.trim();
  if (html.includes('</head>')) {
    return html.replace('</head>', injectedStyle + '\n</head>').replace('</body>', injectedScript + '\n</body>');
  }
  return html + '\n' + injectedStyle + '\n' + injectedScript;
}

function ensureCertificateModal() {
  let modal = document.getElementById('certificate-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'backdrop';
  modal.id = 'certificate-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal modal--certificate" role="dialog" aria-modal="true" aria-labelledby="certificate-modal-title">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <h3 class="modal-title" id="certificate-modal-title">Сертификат</h3>
        <div style="display:flex; gap: 8px; align-items:center;">
          <button type="button" class="btn btn-primary btn-sm" id="certificate-modal-download" disabled>Скачать PDF</button>
          <button type="button" class="btn btn-ghost btn-sm" data-cert-close>Закрыть</button>
        </div>
      </div>
      <div class="modal-body">
        <iframe id="certificate-modal-frame" title="Сертификат" style="width:100%;flex:1;border:0;border-radius:12px;background:#ffffff;"></iframe>
        <p class="muted" id="certificate-modal-status" style="margin:10px 4px 0;">Загрузка…</p>
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-cert-close]')) {
      modal.classList.remove('backdrop--visible');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  document.body.appendChild(modal);
  return modal;
}

function buildPdfSourceFromCertificateHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(htmlString || ''), 'text/html');
  const title = doc.title || 'certificate';
  const styleText = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.textContent || '')
    .join('\n');
  const bodyHtml = doc.body ? doc.body.innerHTML : '';

  const host = document.createElement('div');
  host.id = 'cert-pdf-host-profile';
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '297mm';
  host.style.height = '210mm';
  host.style.background = '#ffffff';
  host.style.overflow = 'hidden';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '9999';

  const style = document.createElement('style');
  style.textContent = styleText || '';
  const content = document.createElement('div');
  content.innerHTML = bodyHtml;

  host.appendChild(style);
  host.appendChild(content);
  return { host, title };
}

async function openCertificateModal(certId) {
  const modal = ensureCertificateModal();
  const frame = modal.querySelector('#certificate-modal-frame');
  const status = modal.querySelector('#certificate-modal-status');
  const btnDownload = modal.querySelector('#certificate-modal-download');
  if (!frame || !status) return;
  status.style.display = '';
  status.textContent = 'Загрузка…';
  frame.srcdoc = '';
  if (btnDownload) btnDownload.disabled = true;
  modal.classList.add('backdrop--visible');
  modal.setAttribute('aria-hidden', 'false');
  try {
    const html = await apiGetMyCertificateHtml(certId);
    frame.srcdoc = injectViewerScale(html);
    status.style.display = 'none';

    if (btnDownload) {
      btnDownload.disabled = false;
      btnDownload.onclick = async () => {
        try {
          btnDownload.disabled = true;
          btnDownload.textContent = 'Готовим PDF…';
          const { blob, filename } = await apiDownloadMyCertificatePdf(certId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
          showToast(e?.message || 'Не удалось скачать PDF.', 'error');
        } finally {
          btnDownload.disabled = false;
          btnDownload.textContent = 'Скачать PDF';
        }
      };
    }
  } catch (e) {
    status.textContent = e?.message || 'Не удалось загрузить сертификат.';
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

      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('verifyToken');
        url.searchParams.delete('needsEmailVerify');
        window.history.replaceState({}, '', url.toString());
      } catch {
        
      }
    }

    const [profile, myCoursesRes, certsRes] = await Promise.all([
      apiGetProfile(),
      apiGetMyCourses(),
      apiGetMyCertificates().catch(() => ({ certificates: [] })),
    ]);
    const myCourses = myCoursesRes.enrollments || [];
    renderProfile(root, { ...profile, certificates: certsRes.certificates || [] }, myCourses);
  } catch (e) {
    console.error(e);
    root.innerHTML =
      '<p class="muted">Не удалось загрузить профиль. Попробуйте обновить страницу позже.</p>';
  }
});
