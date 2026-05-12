/** Соответствует backend/utils/leagues.js (минимальные баллы для окраски UI). */

export function leagueBadgeClass(slug) {
  const s = String(slug || '').toLowerCase();
  const map = {
    bronze: 'league-chip league-chip--bronze',
    silver: 'league-chip league-chip--silver',
    gold: 'league-chip league-chip--gold',
    platinum: 'league-chip league-chip--platinum',
    master: 'league-chip league-chip--master',
  };
  return map[s] || 'league-chip league-chip--bronze';
}

export function leagueLabelFromSlug(slug) {
  const map = {
    bronze: 'Бронза',
    silver: 'Серебро',
    gold: 'Золото',
    platinum: 'Платина',
    master: 'Мастер',
  };
  return map[String(slug || '').toLowerCase()] || 'Бронза';
}
