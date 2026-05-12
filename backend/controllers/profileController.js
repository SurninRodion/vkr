const { getUserById, updateUserProfile } = require('../models/userModel');
const { getUserStats } = require('../models/resultModel');
const { listUserAchievementsWithMeta, getGamificationMetrics } = require('../models/achievementModel');
const { nearestAchievements, evaluateForUser } = require('../services/achievementService');
const { getUserLeague } = require('../utils/leagues');

async function composeProfileAchievementsStrings(userId) {
  try {
    const rows = await listUserAchievementsWithMeta(userId);
    if (!rows.length) return [];
    return rows.map((r) => `${r.icon} ${r.title}`.trim());
  } catch (_) {
    return [];
  }
}

async function composeLeaguePack(userPoints) {
  const info = getUserLeague(Number(userPoints ?? 0));
  return {
    slug: info.slug,
    title: info.title,
    icon: info.icon,
    color: info.color,
    gradient: info.gradient,
    minPoints: info.minPoints,
    nextLeague: info.nextLeague,
    progressToNext: info.progressToNext,
  };
}

async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    console.log('[ProfileController] GET /api/profile user:', userId);

    let user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    try {
      await evaluateForUser(userId);
      const again = await getUserById(userId);
      if (again) user = again;
    } catch (_) {
      
    }

    const stats = await getUserStats(userId);
    const achievements = await composeProfileAchievementsStrings(userId);
    const league = await composeLeaguePack(user.points);
    let unlockedAchievementDetails = [];
    try {
      unlockedAchievementDetails = await listUserAchievementsWithMeta(userId);
      unlockedAchievementDetails = unlockedAchievementDetails.slice(0, 8).map((r) => ({
        id: r.achievementId,
        key: r.key,
        title: r.title,
        icon: r.icon,
        rarity: r.rarity,
      }));
    } catch (_) {
      
    }

    return res.json({
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      points: user.points,
      level: `Уровень ${user.level}`,
      emailVerified: Boolean(user.email_verified_at),
      solvedTasks: stats.solvedTasks,
      avgPromptScore: stats.avgPromptScore,
      achievements,
      league,
      unlockedAchievementDetails,
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

    let updatedUser = await getUserById(userId);
    const stats = await getUserStats(userId);
    try {
      await evaluateForUser(userId);
      const again = await getUserById(userId);
      if (again) updatedUser = again;
    } catch (_) {
      
    }
    const achievements = await composeProfileAchievementsStrings(userId);
    const league = await composeLeaguePack(updatedUser.points);
    let unlockedAchievementDetails = [];
    try {
      unlockedAchievementDetails = await listUserAchievementsWithMeta(userId);
      unlockedAchievementDetails = unlockedAchievementDetails.slice(0, 8).map((r) => ({
        id: r.achievementId,
        key: r.key,
        title: r.title,
        icon: r.icon,
        rarity: r.rarity,
      }));
    } catch (_) {
      
    }

    return res.json({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role || 'user',
      points: updatedUser.points,
      level: `Уровень ${updatedUser.level}`,
      emailVerified: Boolean(updatedUser.email_verified_at),
      solvedTasks: stats.solvedTasks,
      avgPromptScore: stats.avgPromptScore,
      achievements,
      league,
      unlockedAchievementDetails,
    });
  } catch (err) {
    console.error('[ProfileController] Error updating profile:', err.message);
    return res.status(500).json({ message: 'Ошибка обновления профиля' });
  }
}

async function getProfileProgress(req, res) {
  try {
    const userId = req.user.id;
    let user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    try {
      await evaluateForUser(userId);
      const again = await getUserById(userId);
      if (again) user = again;
    } catch (_) {
      
    }
    const stats = await getUserStats(userId);
    let metrics = null;
    try {
      metrics = await getGamificationMetrics(userId);
    } catch (_) {
      
    }

    let leaguePack = {};
    try {
      leaguePack = await composeLeaguePack(user.points);
    } catch (_) {
      
    }

    let nearest = [];
    try {
      nearest = await nearestAchievements(userId, 5);
    } catch (_) {
      
    }

    return res.json({
      points: Number(user.points ?? 0),
      levelNumeric: Number(user.level ?? 1),
      league: leaguePack,
      solvedTasks: stats.solvedTasks,
      avgPromptScore: stats.avgPromptScore,
      rank: metrics ? metrics.rank : null,
      totals: metrics
        ? {
            tasksCompleted: metrics.tasksCompleted,
            completedCoursesCount: metrics.completedCoursesCount,
            lessonCompletions: metrics.lessonCompletions,
            labPromptCount: metrics.labPromptCount,
          }
        : null,
      nearestAchievements: nearest,
    });
  } catch (err) {
    console.error('[ProfileController] getProfileProgress:', err.message);
    return res.status(500).json({ message: 'Ошибка получения прогресса' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getProfileProgress,
};
