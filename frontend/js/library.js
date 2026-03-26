import { showToast, initAuthGate } from './ui.js';

const CATEGORY_META = {
  learning: { label: 'Обучение', filter: 'learning', icon: '🧠' },
  coding: { label: 'Код', filter: 'coding', icon: '💻' },
  style: { label: 'Тон и стиль', filter: 'style', icon: '🎯' },
  other: { label: 'Прочее', filter: 'other', icon: '📌' }
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeCategory(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (['learning', 'обучение'].includes(s)) return 'learning';
  if (['coding', 'код', 'code'].includes(s)) return 'coding';
  if (['style', 'тон', 'тон и стиль'].includes(s)) return 'style';
  return 'other';
}

function badgeLabel(slug) {
  return CATEGORY_META[slug]?.label || slug || 'Прочее';
}

function labUrlForPrompt(text) {
  const t = (text || '').trim();
  if (!t) return './lab.html';
  return `./lab.html?prompt=${encodeURIComponent(t)}`;
}

function renderCards(container, items, activeFilter) {
  container.innerHTML = '';
  const filtered =
    activeFilter === 'all'
      ? items
      : items.filter((p) => normalizeCategory(p.category) === activeFilter);

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'card-description';
    empty.style.gridColumn = '1 / -1';
    empty.textContent =
      activeFilter === 'all'
        ? 'В библиотеке пока нет шаблонов. Администратор может добавить их в разделе «Библиотека промптов» в админ-панели.'
        : 'Нет шаблонов в этой категории. Выберите «Все» или другую метку.';
    container.appendChild(empty);
    return;
  }

  filtered.forEach((p) => {
    const slug = normalizeCategory(p.category);
    const meta = CATEGORY_META[slug] || CATEGORY_META.other;
    const article = document.createElement('article');
    article.className = 'card';
    article.dataset.category = meta.filter;

    const shortDesc = (p.description || '').trim();
    const preview =
      shortDesc.length > 220 ? `${escapeHtml(shortDesc.slice(0, 220))}…` : escapeHtml(shortDesc);

    article.innerHTML = `
      <div class="card-header">
        <div class="card-icon" aria-hidden="true">${meta.icon}</div>
      </div>
      <h3 class="card-title">${escapeHtml(p.title)}</h3>
      <p class="card-description">${preview || 'Без краткого описания.'}</p>
      <div class="card-footer">
        <span class="badge-soft">${escapeHtml(badgeLabel(slug))}</span>
        <div class="library-card-actions">
          <button type="button" class="btn btn-outline" data-action="open-detail" data-id="${escapeHtml(p.id)}">
            Подробнее
          </button>
          <a class="btn btn-primary" data-action="to-lab" data-id="${escapeHtml(p.id)}" href="#">В лабораторию</a>
        </div>
      </div>
    `;
    container.appendChild(article);
  });

  container.querySelectorAll('[data-action="to-lab"]').forEach((link) => {
    const id = link.getAttribute('data-id');
    const item = items.find((x) => x.id === id);
    const text = (item?.example || item?.description || '').trim();
    link.setAttribute('href', labUrlForPrompt(text));
    if (!text) {
      link.classList.add('disabled');
      link.setAttribute('aria-disabled', 'true');
    }
  });
}

function openDetailModal(item) {
  const backdrop = document.getElementById('library-detail-modal');
  if (!backdrop) return;

  const titleEl = backdrop.querySelector('[data-library-detail-title]');
  const bodyEl = backdrop.querySelector('[data-library-detail-body]');
  const labLink = backdrop.querySelector('[data-library-detail-lab]');

  const slug = normalizeCategory(item.category);
  if (titleEl) titleEl.textContent = item.title || 'Шаблон';
  if (bodyEl) {
    const parts = [];
    parts.push(`<p class="library-detail-lead">${escapeHtml(badgeLabel(slug))}</p>`);
    if (item.description) {
      parts.push('<h4 class="library-detail-sub">Описание</h4>');
      parts.push(`<p class="library-detail-text">${escapeHtml(item.description)}</p>`);
    }
    if (item.example) {
      parts.push('<h4 class="library-detail-sub">Пример промпта</h4>');
      parts.push(`<pre class="library-detail-pre">${escapeHtml(item.example)}</pre>`);
    }
    if (item.analysis) {
      parts.push('<h4 class="library-detail-sub">Разбор</h4>');
      parts.push(`<p class="library-detail-text">${escapeHtml(item.analysis)}</p>`);
    }
    bodyEl.innerHTML = parts.join('');
  }
  if (labLink) {
    const text = (item.example || item.description || '').trim();
    labLink.setAttribute('href', labUrlForPrompt(text));
    labLink.classList.toggle('disabled', !text);
  }

  backdrop.classList.add('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeDetailModal() {
  const backdrop = document.getElementById('library-detail-modal');
  if (!backdrop) return;
  backdrop.classList.remove('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'true');
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('library-grid');
  if (!grid) return;

  if (!initAuthGate()) return;

  let items = [];
  let activeFilter = 'all';

  try {
    const res = await fetch('/api/library/prompts');
    if (!res.ok) throw new Error('bad status');
    items = await res.json();
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить библиотеку промптов.', 'error');
  }

  function applyFilter() {
    renderCards(grid, items, activeFilter);
  }

  applyFilter();

  document.querySelector('.page-header .filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-filter]');
    if (!chip) return;
    activeFilter = chip.getAttribute('data-filter') || 'all';
    document.querySelectorAll('.page-header .chip[data-filter]').forEach((c) => {
      c.classList.toggle('chip--active', c === chip);
    });
    applyFilter();
  });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="open-detail"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const item = items.find((x) => x.id === id);
    if (item) openDetailModal(item);
  });

  const detailBackdrop = document.getElementById('library-detail-modal');
  detailBackdrop?.addEventListener('click', (e) => {
    if (e.target === detailBackdrop || e.target.closest('[data-library-detail-close]')) {
      closeDetailModal();
    }
  });
});
