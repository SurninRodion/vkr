const { getLeaderboard } = require('../models/userModel');
const { getTopAchievementsForUsers } = require('../models/achievementModel');
const { getUserLeague } = require('../utils/leagues');

async function getTopUsers(req, res) {
  try {
    console.log('[LeaderboardController] GET /api/leaderboard');
    const users = await getLeaderboard(10);
    return res.json(users);
  } catch (err) {
    console.error('[LeaderboardController] Error getting leaderboard:', err.message);
    return res.status(500).json({ message: 'Ошибка получения рейтинга' });
  }
}

async function getEnhancedLeaderboard(req, res) {
  try {
    console.log('[LeaderboardController] GET /api/leaderboard/enhanced');
    let limit = Number.parseInt(String(req.query.limit || ''), 10);
    if (!Number.isFinite(limit) || limit < 10) limit = 25;
    if (limit > 100) limit = 100;

    const users = await getLeaderboard(limit);
    const ids = (users || []).map((u) => u.id);
    let badges = {};
    try {
      badges = await getTopAchievementsForUsers(ids, 3);
    } catch (e) {
      console.error('[LeaderboardController] Spotlight achievements:', e.message);
      badges = {};
    }

    const payload = users.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      name: u.name,
      email: u.email,
      points: u.points,
      level: Number(u.level ?? 1),
      league: getUserLeague(Number(u.points ?? 0)),
      spotlightAchievements: badges[u.id] || [],
    }));

    return res.json({ leaderboard: payload, showing: payload.length });
  } catch (err) {
    console.error('[LeaderboardController] Enhanced error:', err.message);
    return res.status(500).json({ message: 'Ошибка расширенного рейтинга' });
  }
}

module.exports = {
  getTopUsers,
  getEnhancedLeaderboard,
};
