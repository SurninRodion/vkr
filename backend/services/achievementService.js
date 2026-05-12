const { addPoints } = require('../models/userModel');
const {
  getAllDefinitions,
  countUsers,
  getUnlockCountsByAchievement,
  getUnlockedAchievementIds,
  unlockAchievement,
  getGamificationMetrics,
} = require('../models/achievementModel');

/** Проверка условий по ключам achievement_definitions.key */
function isUnlocked(key, metrics) {
  if (!metrics) return false;
  switch (key) {
    case 'edu_first_course':
      return metrics.completedCoursesCount >= 1;
    case 'edu_five_courses':
      return metrics.completedCoursesCount >= 5;
    case 'edu_theory_master':
      return metrics.lessonCompletions >= 40;
    case 'practice_first_task':
      return metrics.tasksCompleted >= 1;
    case 'practice_ten_tasks':
      return metrics.tasksCompleted >= 10;
    case 'practice_high_score':
      return metrics.taskMaxScore >= 8;
    case 'act_1000_points':
      return metrics.points >= 1000;
    case 'act_top10':
      return metrics.rank <= 10;
    case 'act_first_place':
      return metrics.rank === 1;
    case 'pe_prompt_architect':
      return metrics.labPromptCount >= 25;
    case 'pe_prompt_optimizer':
      return metrics.tasksCompleted >= 10 && metrics.taskAvgScore >= 8;
    case 'pe_ai_researcher':
      return metrics.labPromptCount >= 50;
    default:
      return false;
  }
}

/**
 * Прогресс для UI «Почти получено» — всегда в разрезе числовой шкалы где возможно.
 * @returns {{ current: number, required: number, progressPercent: number } | null}
 */
function achievementProgress(defKey, metrics) {
  if (!metrics) return null;
  const pct = (cur, req) =>
    req > 0 ? Math.min(100, Math.round((Math.min(cur, req) / req) * 100)) : cur > 0 ? 100 : 0;

  switch (defKey) {
    case 'edu_first_course': {
      const req = 1;
      const cur = metrics.completedCoursesCount;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'edu_five_courses': {
      const req = 5;
      const cur = metrics.completedCoursesCount;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'edu_theory_master': {
      const req = 40;
      const cur = metrics.lessonCompletions;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'practice_first_task': {
      const req = 1;
      const cur = metrics.tasksCompleted;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'practice_ten_tasks': {
      const req = 10;
      const cur = metrics.tasksCompleted;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'practice_high_score': {
      const best = metrics.taskMaxScore;
      const cur = Math.min(best, 8);
      return { current: Math.round(best * 10) / 10, required: 8, progressPercent: pct(cur, 8) };
    }
    case 'act_1000_points': {
      const req = 1000;
      const cur = metrics.points;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'act_top10': {
      const r = metrics.rank;
      if (r <= 10) return { current: r, required: 10, progressPercent: 100 };
      const approx = Math.max(5, Math.min(92, Math.round((10 / Math.max(r, 11)) * 100)));
      return { current: r, required: 10, progressPercent: approx };
    }
    case 'act_first_place': {
      const r = metrics.rank;
      if (r <= 1) return { current: 1, required: 1, progressPercent: 100 };
      const approx = Math.max(4, Math.min(88, Math.round((1 / Math.max(r, 2)) * 100)));
      return { current: r, required: 1, progressPercent: approx };
    }
    case 'pe_prompt_architect': {
      const req = 25;
      const cur = metrics.labPromptCount;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    case 'pe_prompt_optimizer': {
      const needTasks = 10;
      const needAvg = 8;
      const taskPart = pct(metrics.tasksCompleted, needTasks);
      const avgPart = pct(Math.min(metrics.taskAvgScore, needAvg), needAvg);
      return {
        current: Math.round((taskPart + avgPart) / 2),
        required: 100,
        progressPercent: Math.round((taskPart + avgPart) / 2),
      };
    }
    case 'pe_ai_researcher': {
      const req = 50;
      const cur = metrics.labPromptCount;
      return { current: cur, required: req, progressPercent: pct(cur, req) };
    }
    default:
      return null;
  }
}

function formatHintRu(defKey, progress, metrics) {
  if (!progress || !metrics) return '';
  switch (defKey) {
    case 'edu_first_course':
    case 'edu_five_courses': {
      const left = Math.max(0, progress.required - progress.current);
      if (left === 0) return '';
      const w = left === 1 ? 'курс' : left < 5 ? 'курса' : 'курсов';
      return `Осталось завершить ${left} ${w}`;
    }
    case 'edu_theory_master': {
      const left = Math.max(0, progress.required - progress.current);
      return left ? `Осталось закрыть ${left} уроков` : '';
    }
    case 'practice_first_task':
    case 'practice_ten_tasks': {
      const left = Math.max(0, progress.required - progress.current);
      return left ? `Осталось ${left} ${left === 1 ? 'задание' : 'заданий'}` : '';
    }
    case 'practice_high_score':
      return metrics.taskMaxScore < 8
        ? `Нужно ≥8 баллов по эффективности (сейчас до ${metrics.taskMaxScore.toFixed(
            1
          )}/10)`
        : '';
    case 'act_1000_points': {
      const left = Math.max(0, progress.required - metrics.points);
      return left ? `Осталось ${left} очков` : '';
    }
    case 'act_top10':
      return metrics.rank > 10
        ? `Сейчас вы на ${metrics.rank} месте — поднимайтесь в топ`
        : '';
    case 'act_first_place':
      return metrics.rank > 1 ? `Следующая цель — 1 место (сейчас ${metrics.rank})` : '';
    case 'pe_prompt_architect':
    case 'pe_ai_researcher': {
      const left = Math.max(0, progress.required - progress.current);
      return left ? `Осталось ${left} ${left === 1 ? 'промпт' : 'промптов'} в Лаборатории` : '';
    }
    case 'pe_prompt_optimizer':
      return 'Нужно 10+ заданий и средняя оценка решений не ниже 8/10';
    default:
      return '';
  }
}

/**
 * Проверить и выдать все подходящие достижения (с учётом каскадных очков).
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, key: string, title: string, icon: string, rarity: string, pointsReward: number }>>}
 */
async function evaluateForUser(userId) {
  if (!userId) return [];
  const definitions = await getAllDefinitions();

  /** @type {Array<{ id: string, key: string, title: string, icon: string, rarity: string, pointsReward: number }>} */
  const collected = [];

  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let metrics = await getGamificationMetrics(userId);
    if (!metrics) break;

    const unlocked = await getUnlockedAchievementIds(userId);
    const batchThisPass = [];

    for (const def of definitions) {
      if (Number(def.hidden) === 1) continue;
      const defId = String(def.id || '').trim();
      if (!defId) continue;
      if (unlocked.has(defId)) continue;
      if (!isUnlocked(def.key, metrics)) continue;

      const { inserted } = await unlockAchievement(userId, defId);
      if (!inserted) continue;

      const reward = Number(def.pointsReward ?? def.points_reward ?? 0);
      if (reward > 0) {
        await addPoints(userId, reward);
      }

      unlocked.add(defId);
      batchThisPass.push({
        id: defId,
        key: def.key,
        title: def.title,
        icon: def.icon,
        rarity: def.rarity,
        pointsReward: reward,
      });
    }

    if (!batchThisPass.length) break;
    collected.push(...batchThisPass);
  }

  return collected;
}

async function enrichDefinitionsForResponse(userIdNullable) {
  if (userIdNullable) {
    try {
      await evaluateForUser(userIdNullable);
    } catch (e) {
      console.error('[achievementService] evaluateForUser in enrich:', e.message);
    }
  }

  const definitions = await getAllDefinitions();
  const totalUsers = await countUsers();
  const unlockRows = await getUnlockCountsByAchievement();
  const unlockCountById = {};
  unlockRows.forEach((r) => {
    const aid = String(r.achievementId || r.achievement_id || '');
    if (!aid) return;
    unlockCountById[aid] = Number(r.unlockCount || r.unlockcount || 0);
  });

  let unlockedSet = null;
  let metrics = null;

  if (userIdNullable) {
    unlockedSet = await getUnlockedAchievementIds(userIdNullable);
    metrics = await getGamificationMetrics(userIdNullable);
  }

  const list = definitions.map((d) => {
    const defId = String(d.id);
    const unlockCount = unlockCountById[defId] ?? 0;
    const pct =
      totalUsers > 0 ? Math.round(((unlockCount / totalUsers) * 100 + Number.EPSILON) * 10000) / 10000 : 0;

    const unlocked = unlockedSet ? unlockedSet.has(defId) : false;
    const hidden = Number(d.hidden) === 1;
    const prog = !unlocked && !hidden && metrics ? achievementProgress(d.key, metrics) : null;
    const hint = prog ? formatHintRu(d.key, prog, metrics) : '';

    let clientTitle = d.title;
    let clientDescription = d.description;
    if (hidden && !unlocked) {
      clientTitle = 'Скрытое достижение';
      clientDescription = 'Выполните особые условия на платформе, чтобы раскрыть награду.';
    }

    return {
      id: d.id,
      key: d.key,
      category: d.category,
      title: clientTitle,
      description: clientDescription,
      icon: hidden && !unlocked ? '❓' : d.icon,
      rarity: d.rarity,
      pointsReward: Number(d.pointsReward ?? d.pointsreward ?? d.points_reward ?? 0),
      hidden,
      unlocked,
      unlockedPercentUsers: pct,
      unlockCount,
      eligibleUsersTotal: totalUsers,
      progress: unlocked || hidden ? null : prog,
      hint,
    };
  });

  return { list, totalUsers, unlockRows, metrics };
}

async function nearestAchievements(userId, limit = 4) {
  const { list } = await enrichDefinitionsForResponse(userId);
  const candidates = list.filter((x) => {
    if (x.hidden) return false;
    if (x.unlocked) return false;
    if (!x.progress || typeof x.progress.progressPercent !== 'number') return false;
    const p = Number(x.progress.progressPercent);
    if (!Number.isFinite(p) || p < 28 || p >= 99.5) return false;
    return true;
  });
  candidates.sort((a, b) => {
    const da = Number(b.progress.progressPercent) - Number(a.progress.progressPercent);
    if (da !== 0) return da;
    return String(a.title).localeCompare(String(b.title), 'ru');
  });
  return candidates.slice(0, limit);
}

module.exports = {
  evaluateForUser,
  isUnlocked,
  achievementProgress,
  enrichDefinitionsForResponse,
  nearestAchievements,
  formatHintRu,
};
