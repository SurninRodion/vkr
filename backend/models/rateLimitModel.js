const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');

function checkAndIncrement({ scope, key, limit, windowMs }) {
  const now = Date.now();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE', (beginErr) => {
        if (beginErr) return reject(beginErr);

        db.get(
          `SELECT id, window_start_ms, count FROM auth_rate_limits WHERE scope = ? AND key = ?`,
          [scope, key],
          (getErr, row) => {
            if (getErr) {
              return db.run('ROLLBACK', () => reject(getErr));
            }

            const commit = (result) => db.run('COMMIT', () => resolve(result));
            const rollback = (err) => db.run('ROLLBACK', () => reject(err));

            if (!row) {
              const id = uuidv4();
              return db.run(
                `
                  INSERT INTO auth_rate_limits (id, scope, key, window_start_ms, count)
                  VALUES (?, ?, ?, ?, ?)
                `,
                [id, scope, key, now, 1],
                (insErr) => {
                  if (insErr) return rollback(insErr);
                  return commit({ ok: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 });
                }
              );
            }

            const windowStart = Number(row.window_start_ms || 0);
            const count = Number(row.count || 0);
            const windowEnd = windowStart + windowMs;

            if (now > windowEnd) {
              return db.run(
                `
                  UPDATE auth_rate_limits
                  SET window_start_ms = ?, count = 1, updated_at = datetime('now')
                  WHERE id = ?
                `,
                [now, row.id],
                (updErr) => {
                  if (updErr) return rollback(updErr);
                  return commit({ ok: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 });
                }
              );
            }

            if (count >= limit) {
              const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - now) / 1000));
              return commit({ ok: false, remaining: 0, retryAfterSeconds });
            }

            return db.run(
              `
                UPDATE auth_rate_limits
                SET count = count + 1, updated_at = datetime('now')
                WHERE id = ?
              `,
              [row.id],
              (updErr) => {
                if (updErr) return rollback(updErr);
                const nextCount = count + 1;
                return commit({
                  ok: true,
                  remaining: Math.max(0, limit - nextCount),
                  retryAfterSeconds: 0,
                });
              }
            );
          }
        );
      });
    });
  });
}

module.exports = {
  checkAndIncrement,
};
