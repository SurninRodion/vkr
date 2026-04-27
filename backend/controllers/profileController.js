const { getUserById, updateUserProfile } = require('../models/userModel');
const { getUserStats } = require('../models/resultModel');

function buildAchievements(user, stats) {
  const achievements = [];

  if (stats.solvedTasks >= 1) {
    achievements.push('Первое решённое задание');
  }
  if (stats.solvedTasks >= 5) {
    achievements.push('Устойчивый практик (5+ заданий)');
  }
  if (stats.avgPromptScore >= 4.0) {
    achievements.push('Стабильное качество промптов');
  }
  if (user.points >= 500) {
    achievements.push('Собрано 500+ очков');
  }

  if (!achievements.length) {
    achievements.push('Начало пути в промпт-инжиниринге');
  }

  if (user.points >= 1000) {
    achievements.push('Собрано 1000+ очков')
  }

  return achievements;
}

async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    console.log('[ProfileController] GET /api/profile user:', userId);

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const stats = await getUserStats(userId);
    const achievements = buildAchievements(user, stats);

    return res.json({
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      points: user.points,
      level: `Уровень ${user.level}`,
      emailVerified: Boolean(user.email_verified_at),
      solvedTasks: stats.solvedTasks,
      avgPromptScore: stats.avgPromptScore,
      achievements
    });
  } catch (err) {
    console.error('[ProfileController] Error getting profile:', err.message);
    return res.status(500).json({ message: 'Ошибка получения профиля' });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    console.log('[ProfileController] PUT /api/profile user:', userId);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Поле name обязательно' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    await updateUserProfile(userId, { name: name.trim() });

    const updatedUser = await getUserById(userId);
    const stats = await getUserStats(userId);
    const achievements = buildAchievements(updatedUser, stats);

    return res.json({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role || 'user',
      points: updatedUser.points,
      level: `Уровень ${updatedUser.level}`,
      emailVerified: Boolean(updatedUser.email_verified_at),
      solvedTasks: stats.solvedTasks,
      avgPromptScore: stats.avgPromptScore,
      achievements
    });
  } catch (err) {
    console.error('[ProfileController] Error updating profile:', err.message);
    return res.status(500).json({ message: 'Ошибка обновления профиля' });
  }
}

module.exports = {
  getProfile,
  updateProfile
};
