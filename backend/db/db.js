const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../config');

console.log('[DB] Connecting to SQLite database at', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] Failed to connect to database:', err.message);
  } else {
    console.log('[DB] Connected to SQLite database');
  }
});

module.exports = db;
