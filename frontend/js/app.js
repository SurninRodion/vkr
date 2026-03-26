import { initNavbar, initGuestProtectedButtons } from './ui.js';
import { getAuthState } from './auth.js';
import { apiGetProgress } from './api.js';

function firstNameFromUser(user) {
  const raw = (user?.name || '').trim();
  if (!raw) return null;
  return raw.split(/\s+/)[0];
}

function initHomeHero() {
  const guest = document.getElementById('hero-guest');
  const dashboard = document.getElementById('hero-dashboard');
  const titleEl = document.getElementById('hero-welcome-title');
  if (!guest || !dashboard) return;

  const { isAuthenticated, user } = getAuthState();

  if (isAuthenticated) {
    guest.hidden = true;
    dashboard.hidden = false;
    if (titleEl) {
      const first = firstNameFromUser(user);
      titleEl.textContent = first ? `С возвращением, ${first}!` : 'С возвращением!';
    }
  } else {
    guest.hidden = false;
    dashboard.hidden = true;
  }
}

function initHomeProgress() {
  const barCourses = document.getElementById('progress-courses-bar');
  const labelCourses = document.getElementById('progress-courses-label');
  const barTasks = document.getElementById('progress-tasks-bar');
  const labelTasks = document.getElementById('progress-tasks-label');

  if (!barCourses || !labelCourses || !barTasks || !labelTasks) return;

  apiGetProgress().then((data) => {
    const courses = Math.max(0, Math.min(100, data.coursesCompleted));
    const tasks = Math.max(0, Math.min(100, data.tasksCompleted));

    requestAnimationFrame(() => {
      barCourses.style.transform = `scaleX(${courses / 100})`;
      barTasks.style.transform = `scaleX(${tasks / 100})`;
    });

    labelCourses.textContent = `${courses}%`;
    labelTasks.textContent = `${tasks}%`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initGuestProtectedButtons();
  initHomeHero();

  if (document.getElementById('progress-courses-bar')) {
    initHomeProgress();
  }
});

window.addEventListener('auth:change', () => {
  if (document.getElementById('hero-guest')) {
    initHomeHero();
  }
});

