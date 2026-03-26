import { getAuthState, logout } from './auth.js';
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

export function initNavbar() {
  const navbarRight = document.getElementById('navbar-right');
  if (!navbarRight) return;

  const scaffold = ensureMobileNavbarScaffold();
  const mobilePanel = scaffold?.mobilePanel || document.getElementById('navbar-mobile');
  const mobileAuth = mobilePanel?.querySelector('.navbar-mobile-auth');

  const { isAuthenticated, user } = getAuthState();

  if (!isAuthenticated) {
    navbarRight.innerHTML = `
      <button class="btn btn-ghost" data-action="open-login">Профиль</button>
      <button class="btn btn-primary" data-action="open-login">Войти</button>
    `;

    if (mobileAuth) {
      mobileAuth.innerHTML = `
        <button class="btn btn-ghost" data-action="open-login">Профиль</button>
        <button class="btn btn-primary" data-action="open-login">Войти</button>
      `;
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

    navbarRight.innerHTML = `
      <div class="user-menu">
        <button class="btn btn-outline user-menu-toggle" id="user-menu-toggle">
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

    if (mobileAuth) {
      mobileAuth.innerHTML = `
        <button class="btn btn-outline" data-mobile-menu="profile">Профиль</button>
        ${isAdmin ? '<button class="btn btn-outline" data-mobile-menu="admin">Администрирование</button>' : ''}
        <button class="btn btn-ghost" data-mobile-menu="logout">Выйти</button>
      `;

      mobileAuth.addEventListener('click', (e) => {
        const target = e.target.closest('[data-mobile-menu]');
        if (!target) return;
        const action = target.getAttribute('data-mobile-menu');
        if (action === 'profile') {
          window.location.href = './profile.html';
        } else if (action === 'admin') {
          window.location.href = './admin/index.html';
        } else if (action === 'logout') {
          logout();
        }
      });
    }

    const toggle = document.getElementById('user-menu-toggle');
    const dropdown = document.getElementById('user-menu-dropdown');
    if (toggle && dropdown) {
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
          window.location.href = './profile.html';
        } else if (action === 'admin') {
          window.location.href = './admin/index.html';
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
      window.location.href = './login.html';
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
        window.location.href = './practice.html';
      }
    });
  }
}

export function enforceLabAccess(generateBtn, promptHintEl) {
  const { isAuthenticated } = getAuthState();
  if (!generateBtn || !promptHintEl) return;

  if (!isAuthenticated) {
    generateBtn.classList.add('disabled');
    promptHintEl.textContent = 'Гость: просмотр интерфейса лаборатории без отправки промптов.';

    generateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.add('backdrop--visible');
    });
  } else {
    promptHintEl.textContent = 'Формулируйте промпт и отправляйте его в лабораторию.';
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

