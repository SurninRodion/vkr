import { apiGetLeaderboard } from './api.js';
import { initAuthGate } from './ui.js';

function applyRankClass(index) {
  if (index === 0) return 'rank-pill rank-1';
  if (index === 1) return 'rank-pill rank-2';
  if (index === 2) return 'rank-pill rank-3';
  return 'rank-pill';
}

function renderLeaderboard(rows) {
  const table = document.getElementById('leaderboard-table') || document.getElementById('home-leaderboard');
  if (!table) return;

  table.innerHTML = '';

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="${applyRankClass(index)}">${index + 1}</span></td>
      <td>${row.name}</td>
      <td>${row.points}</td>
    `;
    table.appendChild(tr);
  });
}

async function loadLeaderboard() {
  try {
    const data = await apiGetLeaderboard();
    renderLeaderboard(data);
  } catch (e) {
    console.error(e);
    const table =
      document.getElementById('leaderboard-table') ||
      document.getElementById('home-leaderboard');
    if (table) {
      table.innerHTML = '<tr><td colspan="3" class="muted">Не удалось загрузить рейтинг.</td></tr>';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const table = document.getElementById('leaderboard-table');
  const homeTable = document.getElementById('home-leaderboard');

  if (table) {
    if (!initAuthGate()) return;
    loadLeaderboard();
    const buttons = document.querySelectorAll('[data-period]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('chip--active'));
        btn.classList.add('chip--active');
        loadLeaderboard();
      });
    });
  } else if (homeTable) {
    loadLeaderboard();
  }
});

