import { showToast } from './ui.js';

export const CATEGORY_LABEL_RU = {
  learning: 'Обучение',
  practice: 'Практика',
  activity: 'Активность',
  prompting: 'Промпт‑инжиниринг',
};

export function rarityLabelRu(rarity) {
  const map = {
    common: 'Обычное',
    rare: 'Редкое',
    epic: 'Эпическое',
    legendary: 'Легендарное',
  };
  return map[String(rarity || '').toLowerCase()] || 'Обычное';
}

export function rarityChipClass(rarity) {
  const r = String(rarity || '').toLowerCase();
  return `rarity-chip rarity-chip--${r}`;
}

/** Убирает дубль: эмодзи из поля icon в начале title (для второй строки заголовка). */
export function achievementTitleSansIcon(title, icon) {
  const t = String(title || '').trim();
  const ic = String(icon || '').trim();
  if (ic && t.startsWith(ic)) {
    const rest = t.slice(ic.length).trim();
    return rest || t;
  }
  return t;
}

/**
 * Доля игроков: реальный процент (до до 4 знаков при очень малых) + «N из M» для доверия.
 */
export function formatPlayersShareLine(unlockCount, totalUsers) {
  const c = Math.max(0, Math.round(Number(unlockCount) || 0));
  const t = Math.max(0, Math.round(Number(totalUsers) || 0));
  if (t <= 0) return 'Нет данных о пользователях';
  const raw = (c / t) * 100;
  let pctStr;
  if (raw >= 10 || c === t) pctStr = raw.toFixed(1).replace('.', ',');
  else if (raw >= 1) pctStr = raw.toFixed(2).replace('.', ',');
  else if (raw > 0 || c > 0) pctStr = raw.toFixed(3).replace('.', ',');
  else pctStr = '0';
  return `${pctStr}% · ${c} из ${t}`;
}

export function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

/**
 * Последовательные тосты при разблокировке с анимацией очереди.
 * @param {Array<{ title?: string, icon?: string }>} list
 */
export function notifyAchievementsUnlocked(list) {
  if (!Array.isArray(list) || !list.length) return;
  list.forEach((a, i) => {
    const title = (a?.title || 'Новое достижение').trim();
    const icon = (a?.icon || '🏆').trim();
    window.setTimeout(() => {
      showToast(`${icon} Получено достижение: ${title}`, 'achievement');
    }, i * 420);
  });
}
