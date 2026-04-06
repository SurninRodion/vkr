import { getAuthState, logout } from './auth.js';
import { apiResendVerification, rateLimitEmailMessage } from './api.js';
import { showToast } from './toast.js';

export { showToast };

function ensureMobileNavbarScaffold() {
  const navbarInner = document.querySelector('.navbar-inner');
  const navbarMenu = document.querySelector('.navbar-menu');
  const navbarRight = document.getElementById('navbar-right');

  if (!navbarInner || !navbarMenu || !navbarRight) return null;

  if (document.querySelector('.navbar-burger')) {
    // Уже инициализировано
    const mobile = document.getElementById('navbar-mobile');
    return { mobilePanel: mobile };
  }

  const burger = document.createElement('button');
  burger.type = 'button';
  burger.className = 'navbar-burger';
  burger.setAttribute('aria-label', 'Открыть меню');
  burger.setAttribute('aria-expanded', 'false');
  burger.innerHTML = '<span></span><span></span><span></span>';

  navbarInner.insertBefore(burger, navbarRight);

  const mobilePanel = document.createElement('div');
  mobilePanel.id = 'navbar-mobile';
  mobilePanel.className = 'navbar-mobile';
  mobilePanel.innerHTML = `
    <div class="navbar-mobile-panel">
      <button class="navbar-mobile-close" type="button" aria-label="Закрыть меню">
        <span></span><span></span>
      </button>
      <nav class="navbar-mobile-menu"></nav>
      <div class="navbar-mobile-auth"></div>
    </div>
  `;

  document.body.appendChild(mobilePanel);

  const mobileMenu = mobilePanel.querySelector('.navbar-mobile-menu');
  if (mobileMenu) {
    navbarMenu.querySelectorAll('.nav-link').forEach((link) => {
      const a = document.createElement('a');
      a.href = link.getAttribute('href') || '#';
      a.className = 'nav-link';
      if (link.classList.contains('nav-link--active')) {
        a.classList.add('nav-link--active');
      }
      a.textContent = link.textContent || '';
      mobileMenu.appendChild(a);
    });
  }

  const closeMobile = () => {
    mobilePanel.classList.remove('navbar-mobile--open');
    burger.classList.remove('navbar-burger--open');
    burger.setAttribute('aria-expanded', 'false');
  };

  burger.addEventListener('click', () => {
    const isOpen = mobilePanel.classList.toggle('navbar-mobile--open');
    burger.classList.toggle('navbar-burger--open', isOpen);
    burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  const mobileClose = mobilePanel.querySelector('.navbar-mobile-close');
  if (mobileClose) {
    mobileClose.addEventListener('click', () => {
      closeMobile();
    });
  }

  mobilePanel.addEventListener('click', (e) => {
    const target = e.target;
    if (target === mobilePanel) {
      closeMobile();
      return;
    }
    if (target.closest('a') || target.closest('button')) {
      closeMobile();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) {
      closeMobile();
    }
  });

  return { mobilePanel };
}

const NAVBAR_GUEST_HTML = `
      <button class="btn btn-ghost" data-action="open-login">Профиль</button>
      <button class="btn btn-primary" data-action="open-login">Войти</button>
    `;

export function initNavbar() {
  const navbarRight = document.getElementById('navbar-right');
  if (!navbarRight) return;

  let guestWrap = navbarRight.querySelector('.navbar-auth-guest');
  let userWrap = navbarRight.querySelector('.navbar-auth-user');
  if (!guestWrap || !userWrap) {
    navbarRight.innerHTML = `
      <div class="navbar-auth-guest">${NAVBAR_GUEST_HTML}</div>
      <div class="navbar-auth-user"></div>
    `;
    guestWrap = navbarRight.querySelector('.navbar-auth-guest');
    userWrap = navbarRight.querySelector('.navbar-auth-user');
  }

  try {
    document.documentElement.setAttribute(
      'data-auth',
      getAuthState().isAuthenticated ? '1' : '0'
    );
  } catch (_) {}

  const scaffold = ensureMobileNavbarScaffold();
  const mobilePanel = scaffold?.mobilePanel || document.getElementById('navbar-mobile');
  const mobileAuth = mobilePanel?.querySelector('.navbar-mobile-auth');

  const { isAuthenticated, user } = getAuthState();

  if (!isAuthenticated) {
    if (guestWrap && !guestWrap.querySelector('[data-action="open-login"]')) {
      guestWrap.innerHTML = NAVBAR_GUEST_HTML;
    }

    if (userWrap) {
      userWrap.innerHTML = '';
    }

    if (mobileAuth) {
      mobileAuth.innerHTML = NAVBAR_GUEST_HTML;
    }
  } else {
    const initials = user?.name
      ? user.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
      : 'PL';
    const isAdmin = user?.role === 'admin';
    const adminItemHtml = isAdmin
      ? `
          <div class="user-menu-item" data-menu="admin">
            Администрирование
            <span>Панель администратора</span>
          </div>
        `
      : '';

    if (userWrap && !userWrap.querySelector('.user-menu')) {
      userWrap.innerHTML = `
      <div class="user-menu">
        <button type="button" class="btn btn-outline user-menu-toggle" id="user-menu-toggle">
          <span class="user-avatar">${initials}</span>
          <span>Личный кабинет</span>
        </button>
        <div class="user-menu-dropdown" id="user-menu-dropdown">
          <div class="user-menu-item" data-menu="profile">
            Профиль
            <span>Статистика</span>
          </div>
          ${adminItemHtml}
          <div class="user-menu-item" data-menu="settings">
            Настройки
            <span>Скоро</span>
          </div>
          <div class="user-menu-item" data-menu="logout">
            Выйти
          </div>
        </div>
      </div>
    `;
    }

    if (mobileAuth) {
      mobileAuth.innerHTML = `
        <button class="btn btn-outline" data-mobile-menu="profile">Профиль</button>
        ${isAdmin ? '<button class="btn btn-outline" data-mobile-menu="admin">Администрирование</button>' : ''}
        <button class="btn btn-ghost" data-mobile-menu="logout">Выйти</button>
      `;

      mobileAuth.onclick = (e) => {
        const target = e.target.closest('[data-mobile-menu]');
        if (!target) return;
        const action = target.getAttribute('data-mobile-menu');
        if (action === 'profile') {
          window.location.href = '/profile';
        } else if (action === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (action === 'logout') {
          logout();
        }
      };
    }

    const toggle = document.getElementById('user-menu-toggle');
    const dropdown = document.getElementById('user-menu-dropdown');
    if (toggle && dropdown && !toggle.dataset.menuBound) {
      toggle.dataset.menuBound = '1';
      toggle.addEventListener('click', () => {
        dropdown.classList.toggle('user-menu-dropdown--open');
      });

      document.addEventListener('click', (e) => {
        if (!dropdown.classList.contains('user-menu-dropdown--open')) return;
        if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
          dropdown.classList.remove('user-menu-dropdown--open');
        }
      });

      dropdown.addEventListener('click', (e) => {
        const target = e.target.closest('.user-menu-item');
        if (!target) return;
        const action = target.getAttribute('data-menu');
        if (action === 'profile') {
          window.location.href = '/profile';
        } else if (action === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (action === 'logout') {
          dropdown.classList.remove('user-menu-dropdown--open');
          logout();
        } else if (action === 'settings') {
          showToast('Раздел «Настройки» появится позже.', 'success');
        }
      });
    }
  }

  document.querySelectorAll('[data-action="open-login"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.href = '/login';
    });
  });
}

// Обновлять навбар при смене состояния авторизации
window.addEventListener('auth:change', () => {
  initNavbar();
});

/** На страницах с `.auth-gate-wrap` — стеклянная заглушка для гостя; без обёртки — no-op, возвращает `true`. */
export function initAuthGate() {
  const wrap = document.querySelector('.auth-gate-wrap');
  if (!wrap) return true;
  const { isAuthenticated } = getAuthState();
  const overlay = wrap.querySelector('.auth-gate__overlay');
  if (!isAuthenticated) {
    overlay?.removeAttribute('hidden');
    wrap.classList.add('auth-gate-wrap--locked');
  }
  return isAuthenticated;
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
        Подтвердите email, чтобы получить доступ к этому разделу. Письмо могло попасть в «Спам».
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

export function openEmailVerifyModal({ title, body } = {}) {
  const modal = ensureEmailVerifyModal();
  const titleEl = modal.querySelector('#email-verify-title');
  const bodyEl = modal.querySelector('#email-verify-body');
  const resendBtn = modal.querySelector('[data-email-verify-resend]');
  const closeBtn = modal.querySelector('[data-email-verify-close]');

  if (titleEl && title) titleEl.textContent = title;
  if (bodyEl && body) bodyEl.textContent = body;

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

/**
 * Ограничение для залогиненных пользователей без подтверждённого email.
 * Используйте на страницах, которые должны быть доступны только после верификации.
 */
export function requireVerifiedEmailOrRedirect({
  toastMessage = 'Подтвердите email, чтобы открыть этот раздел.',
} = {}) {
  const { isAuthenticated, user } = getAuthState();
  if (!isAuthenticated) return true; // гость обрабатывается initAuthGate()
  if (user?.emailVerified) return true;

  openEmailVerifyModal({
    title: 'Подтвердите email',
    body: toastMessage + ' Мы можем отправить письмо ещё раз.',
  });
  return false;
}

export function initGuestProtectedButtons() {
  const modal = document.getElementById('auth-modal');
  const closeButtons = modal?.querySelectorAll('[data-modal-close]');

  function openModal() {
    if (!modal) return;
    modal.classList.add('backdrop--visible');
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('backdrop--visible');
  }

  closeButtons?.forEach((btn) => btn.addEventListener('click', closeModal));
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.querySelectorAll('[data-action="guest-task"], [data-action="guest-only"]').forEach(
    (btn) => {
      btn.addEventListener('click', (e) => {
        if (!getAuthState().isAuthenticated) {
          e.preventDefault();
          openModal();
        }
      });
    }
  );

  const heroStartBtn = document.getElementById('hero-start-btn');
  if (heroStartBtn) {
    heroStartBtn.addEventListener('click', (e) => {
      if (!getAuthState().isAuthenticated) {
        e.preventDefault();
        openModal();
      } else {
        window.location.href = '/practice';
      }
    });
  }
}

export function animateProgressBar(barEl, labelEl, value) {
  if (!barEl || !labelEl) return;
  const normalized = Math.max(0, Math.min(100, value));
  requestAnimationFrame(() => {
    barEl.style.transform = `scaleX(${normalized / 100})`;
  });
  labelEl.textContent = `${normalized}%`;
}

