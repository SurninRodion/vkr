const db = require('../db/db');

function createTaskResult({ id, user_id, task_id, prompt_text, ai_feedback, score }) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT INTO task_results (id, user_id, task_id, prompt_text, ai_feedback, score)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, user_id, task_id, prompt_text, ai_feedback, score],
      function (err) {
        if (err) {
          console.error('[ResultModel] Error creating task result:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function getResultByUserAndTask(userId, taskId) {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT id, user_id, task_id, prompt_text, ai_feedback, score, created_at
        FROM task_results
        WHERE user_id = ? AND task_id = ?
        LIMIT 1
      `,
      [userId, taskId],
      (err, row) => {
        if (err) {
          console.error('[ResultModel] Error fetching result:', err.message);
          return reject(err);
        }
        resolve(row || null);
      }
    );
  });
}

function getCompletedTaskIds(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT task_id FROM task_results WHERE user_id = ?`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('[ResultModel] Error fetching completed task IDs:', err.message);
          return reject(err);
        }
        resolve((rows || []).map((r) => r.task_id));
      }
    );
  });
}

function getUserStats(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT
          COUNT(*) as solvedTasks,
          COALESCE(AVG(score), 0) as avgScore10
        FROM task_results
        WHERE user_id = ?
      `,
      [userId],
      (err, row) => {
        if (err) {
          console.error('[ResultModel] Error fetching user stats:', err.message);
          return reject(err);
        }

        const solvedTasks = row?.solvedTasks || 0;
        const avgScore10 = row?.avgScore10 || 0;
        const avgPromptScore = Math.round(((avgScore10 / 2) || 0) * 10) / 10; 

        resolve({ solvedTasks, avgPromptScore });
      }
    );
  });
}

module.exports = {
  createTaskResult,
  getResultByUserAndTask,
  getCompletedTaskIds,
  getUserStats
};
