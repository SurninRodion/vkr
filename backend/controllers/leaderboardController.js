const { getLeaderboard } = require('../models/userModel');

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

module.exports = {
  getTopUsers
};
