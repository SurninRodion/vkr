/**
 * Удаляет все практические задания и результаты их выполнения.
 * Запуск: node ./db/clearTasks.js (из папки backend)
 */
require('dotenv').config();
const db = require('./db');

db.serialize(() => {
  db.run('DELETE FROM task_results', function (err) {
    if (err) {
      console.error('[clearTasks] Ошибка удаления task_results:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('[clearTasks] Удалено результатов заданий:', this.changes);

    db.run('DELETE FROM tasks', function (err2) {
      if (err2) {
        console.error('[clearTasks] Ошибка удаления tasks:', err2.message);
        db.close();
        process.exit(1);
      }
      console.log('[clearTasks] Удалено заданий:', this.changes);
      console.log('[clearTasks] Готово.');
      db.close();
    });
  });
});
