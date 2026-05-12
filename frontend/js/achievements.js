import {
  apiGetAchievements,
  apiGetLeaderboardEnhanced,
  apiGetProfileProgress,
} from './api.js';
import { getAuthState } from './auth.js';
import { showToast } from './ui.js';
import {
  CATEGORY_LABEL_RU,
  achievementTitleSansIcon,
  escapeHtml,
  formatPlayersShareLine,
  rarityChipClass,
  rarityLabelRu,
} from './achievementHelpers.js';
import { leagueBadgeClass } from './leagueHelpers.js';

function rankingRankCell(rank) {
  if (rank === 1)
    return '<td class="ranking-cell-rank ranking-cell-rank--top ranking-cell-rank--1"><span class="ranking-medal">🥇</span></td>';
  if (rank === 2)
    return '<td class="ranking-cell-rank ranking-cell-rank--top ranking-cell-rank--2"><span class="ranking-medal">🥈</span></td>';
  if (rank === 3)
    return '<td class="ranking-cell-rank ranking-cell-rank--top ranking-cell-rank--3"><span class="ranking-medal">🥉</span></td>';
  return `<td class="ranking-cell-rank"><span class="ranking-place-num">${escapeHtml(String(rank))}</span></td>`;
}

function renderUnifiedTableRow(row) {
  const ach = (row.spotlightAchievements || []).slice(0, 3);
  const achHtml = ach.length
    ? ach
        .map(
          (a) =>
            `<span class="ranking-badge-emoji" title="${escapeHtml(a.title)}">${escapeHtml(a.icon || '🏅')}</span>`
        )
        .join('')
    : '<span class="muted">—</span>';
  const topCls = row.rank <= 3 ? ` ranking-row--top ranking-row--p${row.rank}` : '';

  return `
    <tr class="ranking-row${topCls}">
      ${rankingRankCell(row.rank)}
      <td class="ranking-cell-name">${escapeHtml(row.name || 'Участник')}</td>
      <td class="ranking-cell-league"><span class="${leagueBadgeClass(row.league?.slug)}">${escapeHtml(
        row.league?.icon || ''
      )}\u00A0${escapeHtml(row.league?.title || '')}</span></td>
      <td class="ranking-cell-level">${escapeHtml(String(row.level ?? 1))}</td>
      <td class="ranking-cell-points"><strong>${escapeHtml(String(row.points ?? 0))}</strong></td>
      <td class="ranking-cell-spot">${achHtml}</td>
    </tr>
  `;
}

function renderRareShowcase(items, totalUsers) {
  const tu = Number(totalUsers) || 0;
  if (!items || !items.length) {
    return '<p class="muted">Здесь появятся особенно редкие награды по мере активности платформы.</p>';
  }
  return items
    .map((it) => {
      const elig = Math.max(1, Number(it.eligibleUsersTotal ?? tu ?? 1) || 1);
      const pctLine = formatPlayersShareLine(it.unlockCount ?? 0, elig);
      const title = escapeHtml(it.title || '');
      const desc = escapeHtml(it.description || '');
      return `
        <article class="rare-strip-card glass-card">
          <div class="rare-strip-meta-row">
            <span class="${rarityChipClass(it.rarity)}">${escapeHtml(rarityLabelRu(it.rarity))}</span>
          </div>
          <h3 class="rare-strip-title">${title}</h3>
          <p class="rare-strip-share muted">На платформе: <strong class="rare-strip-share-strong">${escapeHtml(pctLine)}</strong></p>
          <p class="rare-strip-desc muted">${desc}</p>
        </article>
      `;
    })
    .join('');
}

function renderAchievementTile(a, totalUsersFallback) {
  const locked = !a.unlocked;
  const hidden = a.hidden;
  const stateClass = locked ? 'ach-card--locked' : 'ach-card--unlocked';
  const eligible = Number(a.eligibleUsersTotal ?? totalUsersFallback ?? 0);
  const shareLine = formatPlayersShareLine(a.unlockCount ?? 0, eligible);
  const titlePlain = escapeHtml(achievementTitleSansIcon(a.title, a.icon));
  const iconChar = escapeHtml(a.icon || '🏅');
  const prog = a.progress;
  let progressBar = '';
  if (locked && !hidden && prog && typeof prog.progressPercent === 'number') {
    progressBar = `
      <div class="ach-card-progress">
        <div class="ach-card-progress-label">
          <span>Прогресс</span>
          <span>${escapeHtml(String(prog.current))} / ${escapeHtml(String(prog.required))}</span>
        </div>
        <div class="progress-bar-track ach-card-progress-track">
          <div class="progress-bar-fill" style="transform: scaleX(${Math.max(0, Math.min(1, prog.progressPercent / 100))})"></div>
        </div>
      </div>
    `;
  }
  const hint = a.hint && locked && !hidden ? `<p class="ach-card-hint">${escapeHtml(a.hint)}</p>` : '';

  return `
    <article class="ach-card glass-card ${stateClass}" data-achievement-key="${escapeHtml(a.key)}">
      <div class="ach-card-inner">
        <div class="ach-card-symbol" aria-hidden="true">${iconChar}</div>
        <h3 class="ach-card-title">${titlePlain}</h3>
        <div class="ach-card-tags">
          <span class="${rarityChipClass(a.rarity)}">${escapeHtml(rarityLabelRu(a.rarity))}</span>
        </div>
        <p class="ach-card-share muted">${escapeHtml(shareLine)}</p>
        <p class="ach-card-desc muted">${escapeHtml(a.description)}</p>
        ${hint}
        ${
          locked
            ? `<p class="ach-card-status ach-card-status--todo">Не получено</p>`
            : `<p class="ach-card-status ach-card-status--ok">Получено · +${escapeHtml(String(a.pointsReward ?? 0))} очков</p>`
        }
      </div>
      ${progressBar}
    </article>
  `;
}

function groupByCategory(list) {
  const order = ['learning', 'practice', 'activity', 'prompting'];
  const map = new Map();
  list.forEach((item) => {
    const cat = item.category || 'learning';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  });
  return order
    .filter((k) => map.has(k))
    .map((k) => ({
      key: k,
      label: CATEGORY_LABEL_RU[k] || k,
      items: map.get(k),
    }))
    .concat(
      [...map.keys()]
        .filter((k) => !order.includes(k))
        .map((k) => ({
          key: k,
          label: CATEGORY_LABEL_RU[k] || k,
          items: map.get(k),
        }))
    );
}

async function bootstrapGamificationRanking() {
  const topMount = document.getElementById('gamification-leader-mount');
  const selfMount = document.getElementById('gamification-self-mount');
  const rareMount = document.getElementById('gamification-rare-mount');
  const catalogMount = document.getElementById('gamification-catalog-mount');
  if (!topMount || !selfMount || !rareMount || !catalogMount) return;

  const { isAuthenticated } = getAuthState();

  try {
    const [lb, ach] = await Promise.all([apiGetLeaderboardEnhanced(25), apiGetAchievements()]);

    const rows = lb.leaderboard || [];
    const tu = Number(ach.totalUsers ?? 0);

    topMount.innerHTML = `
      <div class="ranking-table-wrap glass-card ranking-board">
        ${
          rows.length
            ? `<table class="ranking-table ranking-table--full">
          <thead>
            <tr>
              <th class="ranking-th-rank">#</th>
              <th>Участник</th>
              <th>Лига</th>
              <th>Уровень</th>
              <th>Очки</th>
              <th>Сильные достижения</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderUnifiedTableRow).join('')}
          </tbody>
        </table>`
            : `<p class="ranking-board-empty muted">Пока никого в таблице — станьте первым: выполняйте задания и набирайте очки.</p>`
        }
      </div>
    `;

    rareMount.innerHTML = `
      <div class="section-head">
        <h2 class="section-title">Редкие достижения</h2>
        <p class="section-lead muted">Подборка по высокой редкости и низкой доле владельцев среди аккаунтов платформы.</p>
      </div>
      <div class="rare-strip">${renderRareShowcase(ach.rareShowcase || [], tu)}</div>
    `;

    const groups = groupByCategory(ach.achievements || []);
    catalogMount.innerHTML = `
      <div class="section-head">
        <h2 class="section-title">Каталог достижений</h2>
        <p class="section-lead muted">
          Доля указана как фактический процент учётных записей в базе: <strong>${escapeHtml(String(ach.totalUsers ?? '—'))}</strong>
          пользователей в расчёте.
        </p>
      </div>
      ${groups
        .map(
          (g) => `
        <section class="ach-catalog-section" data-cat="${escapeHtml(g.key)}">
          <h3 class="ach-catalog-heading">${escapeHtml(g.label)}</h3>
          <div class="ach-grid">${g.items.map((it) => renderAchievementTile(it, tu)).join('')}</div>
        </section>
      `
        )
        .join('')}
    `;

    if (!isAuthenticated) {
      selfMount.innerHTML = `
        <div class="glass-card gamification-self gamification-self--guest">
          <h2 class="section-title">Мой прогресс</h2>
          <p class="muted">Войдите, чтобы видеть лигу, подсказки и цели без лишней легенды общего топа.</p>
          <div class="gamification-self-actions">
            <a class="btn btn-primary" href="/login">Войти</a>
            <a class="btn btn-outline" href="/register">Регистрация</a>
          </div>
        </div>
      `;
      return;
    }

    const progress = await apiGetProfileProgress();
    const league = progress.league || {};
    const next = league.nextLeague;
    const bar = league.progressToNext;
    const leagueBar =
      next && bar
        ? `
      <div class="league-next">
        <div class="league-next-label">
          <span>До лиги «${escapeHtml(next.title)}»</span>
          <span class="muted">${escapeHtml(String(bar.pointsRemaining))} очков</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="transform: scaleX(${Math.max(0, Math.min(1, (bar.percent ?? 0) / 100))})"></div>
        </div>
      </div>
    `
        : `<p class="muted">Вы на высшей лиге — сохраняйте темп!</p>`;

    const nearestRaw = (progress.nearestAchievements || []).filter(
      (n) =>
        !n.hidden &&
        !n.unlocked &&
        n.progress &&
        Number.isFinite(Number(n.progress.progressPercent)) &&
        Number(n.progress.progressPercent) < 99
    );

    const nearestHtml = nearestRaw.length
      ? `<ul class="nearest-list">${nearestRaw
          .slice(0, 5)
          .map((n) => {
            const p = n.progress;
            const line =
              n.hint ||
              (p
                ? `Прогресс: ${p.current}/${p.required} (${escapeHtml(String(p.progressPercent))}%)`
                : '');
            return `
            <li class="nearest-item">
              <span class="nearest-icon" aria-hidden="true">${escapeHtml(n.icon || '🎯')}</span>
              <div class="nearest-main">
                <div class="nearest-title">${escapeHtml(achievementTitleSansIcon(n.title, n.icon))}</div>
                <div class="muted nearest-hint">${line}</div>
              </div>
              ${
                p
                  ? `<div class="nearest-bar"><div style="transform:scaleX(${Math.max(0.06, Math.min(1, p.progressPercent / 100))})" class="progress-bar-fill progress-bar-fill--inline"></div></div>`
                  : ''
              }
            </li>`;
          })
          .join('')}</ul>`
      : `<p class="muted">Целей «совсем рядом» пока немного — заходите после практики и курсов: список обновится.</p>`;

    selfMount.innerHTML = `
      <div class="glass-card gamification-self">
        <div class="gamification-self-top">
          <div>
            <p class="eyebrow muted">Лига</p>
            <h2 class="gamification-self-title">
              ${escapeHtml(league.icon || '⚔️')}\u00A0${escapeHtml(league.title || '')}
            </h2>
            <p class="muted">${escapeHtml(String(progress.points ?? 0))} очков · ур.\u00A0${escapeHtml(
              String(progress.levelNumeric ?? '')
            )}</p>
          </div>
          <span class="${leagueBadgeClass(league.slug)} league-pill-big">${escapeHtml(league.icon || '')}\u00A0${escapeHtml(
            league.title || ''
          )}</span>
        </div>
        ${leagueBar}
        <div class="nearest-block">
          <h3 class="nearest-heading">Ближайшие (ещё не получены)</h3>
          ${nearestHtml}
        </div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Не удалось загрузить страницу геймификации.', 'error');
    topMount.innerHTML = `<p class="muted">Ошибка загрузки рейтинга.</p>`;
    rareMount.innerHTML = '';
    catalogMount.innerHTML = '';
    selfMount.innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('gamification-leader-mount')) {
    bootstrapGamificationRanking();
  }
});
