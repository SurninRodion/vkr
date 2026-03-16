import { apiLogin, apiRegister } from './api.js';
import { showToast } from './ui.js';

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
}

export async function login(email, password) {
  const submitBtn = document.getElementById('login-submit');
  if (submitBtn) submitBtn.classList.add('disabled');

  try {
    const data = await apiLogin(email, password);
    setAuthState({ isAuthenticated: true, user: data.user, token: data.token });
    showToast('Добро пожаловать обратно 👋', 'success');
    window.location.href = './index.html';
  } catch (e) {
    console.error(e);
    showToast('Не удалось войти. Попробуйте ещё раз.', 'error');
  } finally {
    if (submitBtn) submitBtn.classList.remove('disabled');
  }
}

export async function register(payload) {
  const submitBtn = document.getElementById('register-submit');
  if (submitBtn) submitBtn.classList.add('disabled');

  try {
    const data = await apiRegister(payload);
    setAuthState({ isAuthenticated: true, user: data.user, token: data.token });
    showToast('Аккаунт создан. Добро пожаловать!', 'success');
    window.location.href = './index.html';
  } catch (e) {
    console.error(e);
    showToast('Не удалось зарегистрироваться. Попробуйте ещё раз.', 'error');
  } finally {
    if (submitBtn) submitBtn.classList.remove('disabled');
  }
}

// Attach form handlers when on auth pages
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

