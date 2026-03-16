import { initNavbar, initGuestProtectedButtons } from './ui.js';
import { apiGetProgress } from './api.js';

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

  if (document.getElementById('progress-courses-bar')) {
    initHomeProgress();
  }
});

