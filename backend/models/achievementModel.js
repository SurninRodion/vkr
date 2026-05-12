const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

function runGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function runAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function runRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCb(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function getAllDefinitions() {
  return runAll(
    `
      SELECT
        id, key, category, title, description, icon, rarity,
        points_reward AS pointsReward, hidden, created_at AS createdAt
      FROM achievement_definitions
      ORDER BY
        CASE category
          WHEN 'learning' THEN 1
          WHEN 'practice' THEN 2
          WHEN 'activity' THEN 3
          WHEN 'prompting' THEN 4
          ELSE 5
        END,
        rarity,
        title
    `
  );
}

function countUsers() {
  return runGet('SELECT COUNT(*) AS c FROM users', []).then((r) => Number(r?.c ?? 0));
}

function getUnlockCountsByAchievement() {
  return runAll(
    `
      SELECT achievement_id AS achievementId, COUNT(*) AS unlockCount
      FROM user_achievements
      GROUP BY achievement_id
    `,
    []
  );
}

async function buildUnlockPercentageMap(totalUsers, unlockCounts) {
  const base = Math.max(1, totalUsers);
  const map = {};
  unlockCounts.forEach((r) => {
    const aid = r.achievementId || r.achievement_id;
    const c = Number(r.unlockCount || r.unlockcount || 0);
    map[aid] = Math.round((c / base) * 1000) / 10;
  });
  return map;
}

async function getUnlockedAchievementIds(userId) {
  const rows = await runAll(
    `SELECT achievement_id AS id FROM user_achievements WHERE user_id = ?`,
    [userId]
  );
  const set = new Set();
  rows.forEach((r) => {
    const aid = r.id ?? r.achievement_id ?? r.achievementId;
    if (aid) set.add(String(aid));
  });
  return set;
}

async function unlockAchievement(userId, achievementId) {
  const id = uuidv4();
  const changes = await runRun(
    `
      INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id)
      VALUES (?, ?, ?)
    `,
    [id, userId, achievementId]
  );
  if (!changes) {
    return { inserted: false, userAchievementId: null };
  }
  return { inserted: true, userAchievementId: id };
}

/**
 * Одна строка ключевых метрик для условий достижений.
 */
async function getGamificationMetrics(userId) {
  const userRow = await runGet(
    `SELECT id, points, level, created_at AS created_at FROM users WHERE id = ?`,
    [userId]
  );
  if (!userRow) return null;

  const taskAgg = await runGet(
    `
      SELECT
        COUNT(*) AS tasks_completed,
        MAX(score) AS task_max_score,
        AVG(score) AS task_avg_score
      FROM task_results
      WHERE user_id = ?
    `,
    [userId]
  );

  const lc = await runGet(
    `SELECT COUNT(*) AS n FROM course_lesson_progress WHERE user_id = ?`,
    [userId]
  );

  const lab = await runGet(`SELECT COUNT(*) AS n FROM prompts WHERE user_id = ?`, [userId]);

  const coursesRow = await runGet(
    `
      SELECT COUNT(*) AS completed_courses
      FROM (
        SELECT e.course_id
        FROM course_enrollments e
        WHERE e.user_id = ?
        GROUP BY e.course_id
        HAVING
          (SELECT COUNT(*) FROM course_lessons WHERE course_id = e.course_id) > 0
          AND (
            SELECT COUNT(*)
            FROM course_lesson_progress p
            JOIN course_lessons cl ON cl.id = p.lesson_id AND cl.course_id = e.course_id
            WHERE p.user_id = ?
          ) = (SELECT COUNT(*) FROM course_lessons WHERE course_id = e.course_id)
      )
    `,
    [userId, userId]
  );

  const points = Number(userRow.points ?? 0);
  const createdAt = userRow.created_at || '';

  const rankRow = await runGet(
    `
      SELECT COUNT(*) AS before_me
      FROM users o
      JOIN users u ON u.id = ?
      WHERE
        u.id IS NOT NULL
        AND (
          o.points > u.points
          OR (
            o.points = u.points
            AND (o.created_at < u.created_at OR (o.created_at IS NULL AND u.created_at IS NOT NULL))
          )
        )
    `,
    [userId]
  );

  const rank = Number(rankRow?.before_me ?? 0) + 1;

  return {
    userId,
    points,
    level: Number(userRow.level ?? 1),
    userCreatedAt: createdAt,
    tasksCompleted: Number(taskAgg?.tasks_completed ?? 0),
    taskMaxScore: Number(taskAgg?.task_max_score ?? 0),
    taskAvgScore: Number(taskAgg?.task_avg_score ?? 0),
    lessonCompletions: Number(lc?.n ?? 0),
    labPromptCount: Number(lab?.n ?? 0),
    completedCoursesCount: Number(coursesRow?.completed_courses ?? 0),
    rank,
  };
}

async function getTopAchievementsForUsers(userIds, limitEach = 3) {
  if (!userIds.length) return {};
  const placeholders = userIds.map(() => '?').join(',');
  const safeLimit = Math.min(10, Math.max(1, limitEach));
  const rows = await runAll(
    `
      WITH ranked AS (
        SELECT
          ua.user_id AS user_id,
          ad.id AS achievement_id,
          ad.title AS title,
          ad.icon AS icon,
          ad.rarity AS rarity,
          ad.key AS achievement_key,
          ROW_NUMBER() OVER (
            PARTITION BY ua.user_id
            ORDER BY
              CASE ad.rarity
                WHEN 'legendary' THEN 4
                WHEN 'epic' THEN 3
                WHEN 'rare' THEN 2
                ELSE 1
              END DESC,
              ad.points_reward DESC,
              ua.unlocked_at DESC
          ) AS rn
        FROM user_achievements ua
        JOIN achievement_definitions ad ON ad.id = ua.achievement_id AND ad.hidden = 0
        WHERE ua.user_id IN (${placeholders})
      )
      SELECT *
      FROM ranked
      WHERE rn <= ?
      ORDER BY user_id, rn
    `,
    [...userIds, safeLimit]
  );

  const byUser = {};
  rows.forEach((r) => {
    const uid = r.user_id;
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push({
      id: r.achievement_id,
      key: r.achievement_key,
      title: r.title,
      icon: r.icon,
      rarity: r.rarity,
    });
  });
  return byUser;
}

async function listUserAchievementsWithMeta(userId) {
  const rows = await runAll(
    `
      SELECT
        ua.id AS unlockId,
        ua.unlocked_at AS unlockedAt,
        ad.id AS achievementId,
        ad.key,
        ad.title,
        ad.description,
        ad.icon,
        ad.rarity,
        ad.points_reward AS pointsReward
      FROM user_achievements ua
      JOIN achievement_definitions ad ON ad.id = ua.achievement_id
      WHERE ua.user_id = ?
      ORDER BY ua.unlocked_at DESC
    `,
    [userId]
  );

  const rarityWeight = {
    legendary: 4,
    epic: 3,
    rare: 2,
    common: 1,
  };

  rows.sort((a, b) => {
    const wa = rarityWeight[b.rarity] - rarityWeight[a.rarity];
    if (wa !== 0) return wa;
    return String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || ''));
  });

  return rows;
}

module.exports = {
  getAllDefinitions,
  countUsers,
  getUnlockCountsByAchievement,
  buildUnlockPercentageMap,
  getUnlockedAchievementIds,
  unlockAchievement,
  getGamificationMetrics,
  getTopAchievementsForUsers,
  listUserAchievementsWithMeta,
};
