const db = require('../db/db');

function getAllTasks() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, title, description, difficulty, points, type FROM tasks',
      [],
      (err, rows) => {
        if (err) {
          console.error('[TaskModel] Error fetching tasks:', err.message);
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

function getTaskById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, title, description, difficulty, points, type FROM tasks WHERE id = ?',
      [id],
      (err, row) => {
        if (err) {
          console.error('[TaskModel] Error fetching task by id:', err.message);
          return reject(err);
        }
        resolve(row);
      }
    );
  });
}

module.exports = {
  getAllTasks,
  getTaskById
};
