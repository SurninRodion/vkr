/**
 * Лиги по суммарным очкам (геймификация).
 * Диапазоны: [min, nextMin) кроме последней лиги — без верхней границы.
 */
const LEAGUES = [
  {
    slug: 'bronze',
    title: 'Бронза',
    icon: '🥉',
    minPoints: 0,
    color: '#b45309',
    gradient: 'linear-gradient(135deg, #cd7f32 0%, #8b5a2b 100%)',
  },
  {
    slug: 'silver',
    title: 'Серебро',
    icon: '🥈',
    minPoints: 500,
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
  },
  {
    slug: 'gold',
    title: 'Золото',
    icon: '🥇',
    minPoints: 1500,
    color: '#ca8a04',
    gradient: 'linear-gradient(135deg, #facc15 0%, #b45309 100%)',
  },
  {
    slug: 'platinum',
    title: 'Платина',
    icon: '💎',
    minPoints: 3000,
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg, #7dd3fc 0%, #6366f1 100%)',
  },
  {
    slug: 'master',
    title: 'Мастер',
    icon: '👑',
    minPoints: 6000,
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #c084fc 0%, #7c3aed 45%, #4c1d95 100%)',
  },
];

function clampPoints(points) {
  const n = Number(points);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * @param {number} points
 * @returns {{
 *   slug: string,
 *   title: string,
 *   icon: string,
 *   minPoints: number,
 *   color: string,
 *   gradient: string,
 *   nextLeague: { slug: string, title: string, minPoints: number, icon: string } | null,
 *   progressToNext: { current: number, required: number, percent: number, pointsRemaining: number } | null
 * }}
 */
function getUserLeague(points) {
  const p = clampPoints(points);
  let idx = 0;
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (p >= LEAGUES[i].minPoints) {
      idx = i;
      break;
    }
  }
  const current = LEAGUES[idx];
  const next = idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null;

  let progressToNext = null;
  if (next) {
    const span = next.minPoints - current.minPoints;
    const delta = p - current.minPoints;
    const pointsRemaining = Math.max(0, next.minPoints - p);
    const percent = span > 0 ? Math.min(100, Math.round((delta / span) * 100)) : 0;
    progressToNext = {
      current: delta,
      required: span,
      percent,
      pointsRemaining,
    };
  }

  return {
    slug: current.slug,
    title: current.title,
    icon: current.icon,
    minPoints: current.minPoints,
    color: current.color,
    gradient: current.gradient,
    nextLeague: next
      ? {
          slug: next.slug,
          title: next.title,
          minPoints: next.minPoints,
          icon: next.icon,
        }
      : null,
    progressToNext,
  };
}

module.exports = {
  LEAGUES,
  getUserLeague,
};
