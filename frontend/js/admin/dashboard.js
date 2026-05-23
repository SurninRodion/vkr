import { initNavbar, showToast } from '../ui.js';
import { apiGetProfile } from '../api.js';

const ADMIN_API_BASE = '/api/admin';

// Chart.js global configuration
Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';

function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const raw = localStorage.getItem('promptlearn_auth');
    if (!raw) return headers;
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      headers.Authorization = `Bearer ${parsed.token}`;
    }
  } catch {
    // ignore
  }

  return headers;
}

async function ensureAdminAccess() {
  try {
    const profile = await apiGetProfile();
    if (!profile || profile.role !== 'admin') {
      showToast('Доступ разрешён только администраторам.', 'error');
      window.location.href = '/';
      return false;
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast('Не удалось проверить права доступа.', 'error');
    window.location.href = '/login';
    return false;
  }
}

// Store chart instances for cleanup
const chartInstances = {};

function destroyChart(chartId) {
  if (chartInstances[chartId]) {
    chartInstances[chartId].destroy();
    delete chartInstances[chartId];
  }
}

async function loadDashboardStats() {
  const statsRoot = document.getElementById('admin-stats');
  if (!statsRoot) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/stats`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();

    // Update stat cards
    const map = {
      'stat-total-users': data.totalUsers,
      'stat-total-tasks': data.totalTasks,
      'stat-total-prompts': data.totalPrompts,
      'stat-active-users': data.activeUsers
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        animateValue(el, 0, value, 800);
      }
    });

    // Update trend indicators
    updateTrendIndicators(data);

    // Render charts
    renderUserTrendChart(data.userTrend);
    renderTaskStatsChart(data.taskStats);
    renderDifficultyChart(data.difficultyDist);
    renderCategoryChart(data.categoryDist);
    renderCourseChart(data.courseStats);

  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить статистику.', 'error');
  }
}

function animateValue(element, start, end, duration) {
  const startTime = performance.now();
  const diff = end - start;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * easeProgress);
    element.textContent = current.toLocaleString('ru-RU');

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function updateTrendIndicators(data) {
  // User registration trend
  const userTrendEl = document.getElementById('stat-users-trend');
  if (userTrendEl && data.userTrend && data.userTrend.length > 0) {
    const recentUsers = data.userTrend.reduce((sum, d) => sum + d.count, 0);
    if (recentUsers > 0) {
      userTrendEl.className = 'stat-card-trend stat-card-trend--up';
      userTrendEl.innerHTML = `<span>↑ +${recentUsers} за 7 дней</span>`;
    }
  }

  // Active users percentage
  const activeTrendEl = document.getElementById('stat-active-trend');
  if (activeTrendEl && data.totalUsers > 0) {
    const percentage = Math.round((data.activeUsers / data.totalUsers) * 100);
    activeTrendEl.innerHTML = `<span>${percentage}% от всех</span>`;
  }
}

function renderUserTrendChart(userTrend) {
  const ctx = document.getElementById('userTrendChart');
  if (!ctx) return;

  destroyChart('userTrendChart');

  const labels = userTrend.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  });
  const values = userTrend.map(d => d.count);

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.3)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');

  chartInstances.userTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Новых пользователей',
        data: values,
        borderColor: '#4f46e5',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#4f46e5',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (context) => `${context.parsed.y} пользователей`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            padding: 8
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      }
    }
  });
}

function renderTaskStatsChart(taskStats) {
  const ctx = document.getElementById('taskStatsChart');
  if (!ctx) return;

  destroyChart('taskStatsChart');

  const completed = taskStats.completed || 0;
  const inProgress = taskStats.inProgress || 0;
  const total = completed + inProgress;

  if (total === 0) {
    showNoData(ctx, 'Нет данных по заданиям');
    return;
  }

  chartInstances.taskStatsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Выполнено', 'В процессе'],
      datasets: [{
        data: [completed, inProgress],
        backgroundColor: [
          'rgba(22, 163, 74, 0.85)',
          'rgba(59, 130, 246, 0.85)'
        ],
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderDifficultyChart(difficultyDist) {
  const ctx = document.getElementById('difficultyChart');
  if (!ctx) return;

  destroyChart('difficultyChart');

  const difficultyLabels = {
    'easy': 'Лёгкие',
    'medium': 'Средние',
    'hard': 'Сложные'
  };

  const colors = {
    'easy': { bg: 'rgba(22, 163, 74, 0.85)', border: '#16a34a' },
    'medium': { bg: 'rgba(234, 179, 8, 0.85)', border: '#eab308' },
    'hard': { bg: 'rgba(220, 38, 38, 0.85)', border: '#dc2626' }
  };

  const labels = [];
  const data = [];
  const bgColors = [];
  const borderColors = [];

  difficultyDist.forEach(d => {
    labels.push(difficultyLabels[d.difficulty] || d.difficulty);
    data.push(d.count);
    const color = colors[d.difficulty] || { bg: 'rgba(107, 114, 128, 0.85)', border: '#6b7280' };
    bgColors.push(color.bg);
    borderColors.push(color.border);
  });

  if (data.length === 0 || data.every(v => v === 0)) {
    showNoData(ctx, 'Нет данных о сложности');
    return;
  }

  chartInstances.difficultyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Количество заданий',
        data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          padding: 12,
          cornerRadius: 8,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            padding: 8
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      }
    }
  });
}

function renderCategoryChart(categoryDist) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  destroyChart('categoryChart');

  const categoryLabels = {
    'learning': 'Обучение',
    'coding': 'Код',
    'style': 'Тон и стиль',
    'other': 'Другое'
  };

  const labels = categoryDist.map(d => categoryLabels[d.category] || d.category);
  const data = categoryDist.map(d => d.count);

  if (data.length === 0 || data.every(v => v === 0)) {
    showNoData(ctx, 'Нет данных о категориях');
    return;
  }

  chartInstances.categoryChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(79, 70, 229, 0.85)',
          'rgba(22, 163, 74, 0.85)',
          'rgba(234, 179, 8, 0.85)',
          'rgba(124, 58, 237, 0.85)',
          'rgba(59, 130, 246, 0.85)'
        ],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderCourseChart(courseStats) {
  const ctx = document.getElementById('courseChart');
  if (!ctx) return;

  destroyChart('courseChart');

  const labels = courseStats.map(c => c.title || 'Без названия').slice(0, 5);
  const data = courseStats.map(c => c.enrollments || 0).slice(0, 5);

  if (data.length === 0 || data.every(v => v === 0)) {
    showNoData(ctx, 'Нет данных о курсах');
    return;
  }

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.85)');
  gradient.addColorStop(1, 'rgba(124, 58, 237, 0.85)');

  chartInstances.courseChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Записей на курс',
        data,
        backgroundColor: [
          'rgba(59, 130, 246, 0.85)',
          'rgba(79, 70, 229, 0.85)',
          'rgba(124, 58, 237, 0.85)',
          'rgba(168, 85, 247, 0.85)',
          'rgba(234, 179, 8, 0.85)'
        ],
        borderColor: [
          '#3b82f6',
          '#4f46e5',
          '#7c3aed',
          '#a855f7',
          '#eab308'
        ],
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f9fafb',
          bodyColor: '#f9fafb',
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (context) => `${context.parsed.x} записей`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            padding: 8
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false
          },
          border: {
            display: false
          }
        },
        y: {
          grid: {
            display: false
          },
          border: {
            display: false
          }
        }
      }
    }
  });
}

function showNoData(canvas, message) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);

  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, rect.width / 2, rect.height / 2);
}

async function loadSettings() {
  const toggle = document.getElementById('toggle-email-verification');
  if (!toggle) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/settings`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const settings = await res.json();
    toggle.checked = settings.email_verification_required === 'true';
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function updateSetting(key, value) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify({ value: String(value) })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'failed');
    }
    showToast('Настройка сохранена', 'success');
  } catch (e) {
    console.error('Failed to update setting:', e);
    showToast('Не удалось сохранить настройку', 'error');
    // Revert toggle
    const toggle = document.getElementById('toggle-email-verification');
    if (toggle) toggle.checked = !toggle.checked;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const ok = await ensureAdminAccess();
  if (!ok) return;

  if (document.getElementById('admin-stats')) {
    loadDashboardStats();
  }

  // Settings
  await loadSettings();

  const toggle = document.getElementById('toggle-email-verification');
  if (toggle) {
    toggle.addEventListener('change', () => {
      updateSetting('email_verification_required', toggle.checked);
    });
  }
});
