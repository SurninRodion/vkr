import { apiForgotPassword, apiLogin, apiRegister, apiResetPassword, rateLimitEmailMessage } from './api.js';
import { showToast } from './toast.js';

const STORAGE_KEY = 'promptlearn_auth';

export function getAuthState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isAuthenticated: false, user: null, token: null };
    return JSON.parse(raw);
  } catch {
    return { isAuthenticated: false, user: null, token: null };
  }
}

function setAuthState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  try {
    document.documentElement.setAttribute('data-auth', next.isAuthenticated ? '1' : '0');
  } catch (_) {}
  const event = new CustomEvent('auth:change', { detail: next });
  window.dispatchEvent(event);
}

export function isAuthenticated() {
  return getAuthState().isAuthenticated;
}

export function getCurrentUser() {
  return getAuthState().user;
}

export function logout() {
  setAuthState({ isAuthenticated: false, user: null, token: null });
  showToast('Вы вышли из аккаунта.', 'success');
  window.location.href = '/';
}

export async function login(email, password) {
  const submitBtn = document.getElementById('login-submit');
  if (submitBtn) submitBtn.classList.add('disabled');

  try {
    const data = await apiLogin(email, password);
    setAuthState({ isAuthenticated: true, user: data.user, token: data.token });
    showToast('Добро пожаловать обратно 👋', 'success');
    window.location.href = '/';
  } catch (e) {
    console.error(e);
    showToast('Не удалось войти. Попробуйте ещё раз.', 'error');
  } finally {
    if (submitBtn) submitBtn.classList.remove('disabled');
  }
}

function getUrlParam(name) {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name) || '';
  } catch {
    return '';
  }
}

function openBackdrop(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  el.classList.add('backdrop--visible');
  el.setAttribute('aria-hidden', 'false');
  return el;
}

function closeBackdrop(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('backdrop--visible');
  el.setAttribute('aria-hidden', 'true');
}

export async function register(payload) {
  const submitBtn = document.getElementById('register-submit');
  if (submitBtn) submitBtn.classList.add('disabled');

  try {
    const data = await apiRegister(payload);
    setAuthState({ isAuthenticated: true, user: data.user, token: data.token });
    showToast('Аккаунт создан. Добро пожаловать!', 'success');
    window.location.href = '/profile?needsEmailVerify=1';
  } catch (e) {
    console.error(e);
    showToast('Не удалось зарегистрироваться. Попробуйте ещё раз.', 'error');
  } finally {
    if (submitBtn) submitBtn.classList.remove('disabled');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const email = formData.get('email');
      const password = formData.get('password');
      login(email, password);
    });
  }

  const forgotBtn = document.getElementById('forgot-password-btn');
  const forgotModal = document.getElementById('forgot-password-modal');
  const forgotForm = document.getElementById('forgot-password-form');
  const forgotSubmit = document.getElementById('forgot-submit');
  const forgotClose = forgotModal?.querySelector('[data-forgot-close]');

  if (forgotBtn && forgotModal) {
    forgotBtn.addEventListener('click', () => openBackdrop('forgot-password-modal'));
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) closeBackdrop('forgot-password-modal');
    });
  }
  forgotClose?.addEventListener('click', () => closeBackdrop('forgot-password-modal'));

  if (forgotForm && forgotSubmit) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(forgotForm);
      const email = (formData.get('email') || '').toString().trim();
      if (!email) return;

      forgotSubmit.classList.add('disabled');
      try {
        await apiForgotPassword(email);
        showToast('Если email зарегистрирован, мы отправили письмо со ссылкой.', 'success');
        closeBackdrop('forgot-password-modal');
      } catch (err) {
        console.error(err);
        const rl = rateLimitEmailMessage(err);
        showToast(rl || 'Не удалось отправить письмо. Попробуйте позже.', 'error');
      } finally {
        forgotSubmit.classList.remove('disabled');
      }
    });
  }

  const resetToken = getUrlParam('resetToken');
  const resetModal = document.getElementById('reset-password-modal');
  const resetForm = document.getElementById('reset-password-form');
  const resetSubmit = document.getElementById('reset-submit');
  const resetClose = resetModal?.querySelector('[data-reset-close]');

  resetClose?.addEventListener('click', () => closeBackdrop('reset-password-modal'));
  resetModal?.addEventListener('click', (e) => {
    if (e.target === resetModal) closeBackdrop('reset-password-modal');
  });

  if (resetToken && resetModal) {
    openBackdrop('reset-password-modal');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('resetToken');
      window.history.replaceState({}, '', url.toString());
    } catch {
      
    }
  }

  if (resetForm && resetSubmit) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passwordInput = document.getElementById('reset-password');
      const newPassword = (passwordInput?.value || '').toString();
      if (!resetToken) {
        showToast('Ссылка сброса пароля недействительна. Запросите восстановление заново.', 'error');
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        showToast('Пароль должен быть не короче 6 символов.', 'error');
        return;
      }

      resetSubmit.classList.add('disabled');
      try {
        await apiResetPassword(resetToken, newPassword);
        showToast('Пароль обновлён. Теперь вы можете войти.', 'success');
        closeBackdrop('reset-password-modal');
      } catch (err) {
        console.error(err);
        showToast('Не удалось сбросить пароль. Запросите восстановление ещё раз.', 'error');
      } finally {
        resetSubmit.classList.remove('disabled');
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(registerForm);
      register({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      });
    });
  }
});
