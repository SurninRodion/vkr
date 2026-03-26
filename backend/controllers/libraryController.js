const db = require('../db/db');

async function getPublicLibraryPrompts(req, res) {
  try {
    db.all(
      `
        SELECT id, title, category, description, example, analysis, created_at
        FROM prompt_library
        ORDER BY created_at DESC
      `,
      [],
      (err, rows) => {
        if (err) {
          console.error('[LibraryController] Error fetching prompt library:', err.message);
          return res.status(500).json({ message: 'Ошибка загрузки библиотеки промптов' });
        }
        return res.json(rows || []);
      }
    );
  } catch (err) {
    console.error('[LibraryController] getPublicLibraryPrompts:', err.message);
    return res.status(500).json({ message: 'Ошибка загрузки библиотеки промптов' });
  }
}

module.exports = {
  getPublicLibraryPrompts
};
