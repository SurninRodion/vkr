const { enrichDefinitionsForResponse, evaluateForUser } = require('../services/achievementService');
const { listUserAchievementsWithMeta } = require('../models/achievementModel');
async function listAchievementsCatalog(req, res) {
  try {
    const userId = req.user?.id || null;
    const { list, totalUsers } = await enrichDefinitionsForResponse(userId);

    const rarityRank = { legendary: 4, epic: 3, rare: 2, common: 1 };
    const rareShowcase = [...list]
      .filter((x) => {
        if (x.hidden) return false;
        const r = String(x.rarity || '').toLowerCase();
        const pct = Number(x.unlockedPercentUsers ?? 100);
        return r === 'rare' || r === 'epic' || r === 'legendary' || pct <= 12;
      })
      .sort((a, b) => {
        const ra = rarityRank[String(b.rarity || '').toLowerCase()] || 0;
        const rb = rarityRank[String(a.rarity || '').toLowerCase()] || 0;
        if (ra !== rb) return ra - rb;
        return Number(a.unlockedPercentUsers ?? 999) - Number(b.unlockedPercentUsers ?? 999);
      })
      .slice(0, 8);

    return res.json({
      achievements: list,
      totalUsers,
      rareShowcase,
    });
  } catch (err) {
    console.error('[AchievementController] listAchievementsCatalog:', err.message);
    return res.status(500).json({ message: 'Ошибка получения достижений' });
  }
}

async function listMyAchievements(req, res) {
  try {
    const userId = req.user.id;
    try {
      await evaluateForUser(userId);
    } catch (_) {
      
    }
    const detailed = await listUserAchievementsWithMeta(userId);
    return res.json({
      unlocked: detailed.map((r) => ({
        unlockId: r.unlockId,
        unlockedAt: r.unlockedAt,
        achievementId: r.achievementId,
        key: r.key,
        title: r.title,
        description: r.description,
        icon: r.icon,
        rarity: r.rarity,
        pointsReward: Number(r.pointsReward ?? 0),
      })),
      count: detailed.length,
    });
  } catch (err) {
    console.error('[AchievementController] listMyAchievements:', err.message);
    return res.status(500).json({ message: 'Ошибка загрузки ваших достижений' });
  }
}

module.exports = {
  listAchievementsCatalog,
  listMyAchievements,
};
