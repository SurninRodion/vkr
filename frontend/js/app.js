import { initNavbar, initGuestProtectedButtons } from './ui.js';
import { getAuthState } from './auth.js';
import { apiGetProfileProgress } from './api.js';
import { initSessionManager } from './session.js';

function firstNameFromUser(user) {
  const raw = (user?.name || '').trim();
  if (!raw) return null;
  return raw.split(/\s+/)[0];
}

function initHomeHero() {
  const titleEl = document.getElementById('hero-welcome-title');
  if (!titleEl) return;

  const { isAuthenticated, user } = getAuthState();
  if (!isAuthenticated) return;

  const first = firstNameFromUser(user);
  titleEl.textContent = first ? `С возвращением, ${first}!` : 'С возвращением!';
}

function initHomeProgress() {
  const barCourses = document.getElementById('progress-courses-bar');
  const labelCourses = document.getElementById('progress-courses-label');
  const barTasks = document.getElementById('progress-tasks-bar');
  const labelTasks = document.getElementById('progress-tasks-label');

  if (!barCourses || !labelCourses || !barTasks || !labelTasks) return;

  const courseGoal = 5;
  const taskGoal = 10;
  const { isAuthenticated } = getAuthState();
  if (!isAuthenticated) {
    labelCourses.textContent = '—';
    labelTasks.textContent = '—';
    barCourses.style.transform = 'scaleX(0)';
    barTasks.style.transform = 'scaleX(0)';
    return;
  }

  apiGetProfileProgress()
    .then((data) => {
      const doneCourses = Number(data?.totals?.completedCoursesCount ?? 0);
      const doneTasks = Number(data?.totals?.tasksCompleted ?? data?.solvedTasks ?? 0);
      const courses = Math.round(Math.min(100, (doneCourses / courseGoal) * 100));
      const tasks = Math.round(Math.min(100, (doneTasks / taskGoal) * 100));

      requestAnimationFrame(() => {
        barCourses.style.transform = `scaleX(${courses / 100})`;
        barTasks.style.transform = `scaleX(${tasks / 100})`;
      });

      labelCourses.textContent = `${courses}%`;
      labelTasks.textContent = `${tasks}%`;
    })
    .catch(() => {
      labelCourses.textContent = '—';
      labelTasks.textContent = '—';
      barCourses.style.transform = 'scaleX(0)';
      barTasks.style.transform = 'scaleX(0)';
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initGuestProtectedButtons();
  initHomeHero();
  initSessionManager();

  if (document.getElementById('progress-courses-bar')) {
    initHomeProgress();
  }
});

window.addEventListener('auth:change', () => {
  if (document.getElementById('hero-guest')) {
    initHomeHero();
  }
  if (document.getElementById('progress-courses-bar')) {
    initHomeProgress();
  }
});
