const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createPasswordResetToken({ userId, ttlMinutes = 30 }) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(token);
  const id = uuidv4();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `
          DELETE FROM password_reset_tokens
          WHERE user_id = ?
            AND used_at IS NULL
        `,
        [userId],
        (cleanupErr) => {
          if (cleanupErr) {
            console.error('[PasswordResetModel] Error cleaning tokens:', cleanupErr.message);
            return reject(cleanupErr);
          }

          db.run(
            `
              INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
              VALUES (?, ?, ?, datetime('now', ?))
            `,
            [id, userId, tokenHash, `+${ttlMinutes} minutes`],
            (err) => {
              if (err) {
                console.error('[PasswordResetModel] Error creating token:', err.message);
                return reject(err);
              }
              resolve({ token });
            }
          );
        }
      );
    });
  });
}

function consumePasswordResetToken({ token }) {
  const tokenHash = sha256Hex(token);

  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT id, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [tokenHash],
      (err, row) => {
        if (err) {
          console.error('[PasswordResetModel] Error fetching token:', err.message);
          return reject(err);
        }
        resolve(row || null);
      }
    );
  }).then((row) => {
    if (!row) return null;
    if (row.used_at) return { ok: false, reason: 'used' };

    return new Promise((resolve, reject) => {
      db.get(`SELECT datetime('now') AS now`, [], (nowErr, nowRow) => {
        if (nowErr) return reject(nowErr);
        const now = nowRow?.now;
        if (!now) return reject(new Error('Не удалось получить текущее время'));
        if (now > row.expires_at) return resolve({ ok: false, reason: 'expired' });

        db.run(
          `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`,
          [row.id],
          (updErr) => {
            if (updErr) {
              console.error('[PasswordResetModel] Error consuming token:', updErr.message);
              return reject(updErr);
            }
            resolve({ ok: true, userId: row.user_id });
          }
        );
      });
    });
  });
}

module.exports = {
  createPasswordResetToken,
  consumePasswordResetToken,
};

