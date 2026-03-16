const db = require('../db/db');

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('[UserModel] Error fetching user by email:', err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('[UserModel] Error fetching user by id:', err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
}

function createUser(user) {
  const { id, email, password_hash, name, role = 'user', points = 0, level = 1 } = user;
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT INTO users (id, email, password_hash, name, role, points, level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [id, email, password_hash, name, role, points, level],
      function (err) {
        if (err) {
          console.error('[UserModel] Error creating user:', err.message);
          return reject(err);
        }
        resolve({ id, email, name, role, points, level });
      }
    );
  });
}

function addPoints(userId, pointsToAdd) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        UPDATE users
        SET points = points + ?, level = 1 + CAST(points / 500 AS INTEGER)
        WHERE id = ?
      `,
      [pointsToAdd, userId],
      function (err) {
        if (err) {
          console.error('[UserModel] Error adding points:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function updateUserProfile(id, { name }) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        UPDATE users
        SET name = ?
        WHERE id = ?
      `,
      [name, id],
      function (err) {
        if (err) {
          console.error('[UserModel] Error updating profile:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function getLeaderboard(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT id, name, email, points, level
        FROM users
        ORDER BY points DESC, created_at ASC
        LIMIT ?
      `,
      [limit],
      (err, rows) => {
        if (err) {
          console.error('[UserModel] Error fetching leaderboard:', err.message);
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT id, name, email, points, level, role, created_at
        FROM users
        ORDER BY created_at DESC
      `,
      [],
      (err, rows) => {
        if (err) {
          console.error('[UserModel] Error fetching all users:', err.message);
          return reject(err);
        }
        resolve(rows);
      }
    );
  });
}

function updateUserRole(id, role) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        UPDATE users
        SET role = ?
        WHERE id = ?
      `,
      [role, id],
      function (err) {
        if (err) {
          console.error('[UserModel] Error updating user role:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

function deleteUser(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        DELETE FROM users
        WHERE id = ?
      `,
      [id],
      function (err) {
        if (err) {
          console.error('[UserModel] Error deleting user:', err.message);
          return reject(err);
        }
        resolve();
      }
    );
  });
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  addPoints,
  updateUserProfile,
  getLeaderboard,
  getAllUsers,
  updateUserRole,
  deleteUser
};

