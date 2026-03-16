const db = require('./db');

function initDB() {
  console.log('[DB] Initializing database schema...');

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) {
        console.error('[DB] Error creating users table:', err.message);
      } else {
        console.log('[DB] Users table ready');
      }
    });

    // Миграция для добавления поля role в существующую таблицу users
    db.run(
      "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
      (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
          console.error('[DB] Error adding role column to users table:', err.message);
        } else if (!err) {
          console.log('[DB] Added role column to users table');
        }
      }
    );

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        points INTEGER NOT NULL,
        type TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('[DB] Error creating tasks table:', err.message);
      } else {
        console.log('[DB] Tasks table ready');
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS task_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        ai_feedback TEXT,
        score INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `, (err) => {
      if (err) {
        console.error('[DB] Error creating task_results table:', err.message);
      } else {
        console.log('[DB] task_results table ready');
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        ai_response TEXT,
        analysis TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('[DB] Error creating prompts table:', err.message);
      } else {
        console.log('[DB] Prompts table ready');
      }
    });

    // Таблица библиотеки промптов (админская)
    db.run(
      `
        CREATE TABLE IF NOT EXISTS prompt_library (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT,
          description TEXT,
          example TEXT,
          analysis TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating prompt_library table:', err.message);
        } else {
          console.log('[DB] prompt_library table ready');
        }
      }
    );

    // Таблицы курсов и уроков
    db.run(
      `
        CREATE TABLE IF NOT EXISTS courses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating courses table:', err.message);
        } else {
          console.log('[DB] Courses table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_lessons (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          order_index INTEGER DEFAULT 0,
          FOREIGN KEY (course_id) REFERENCES courses(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_lessons table:', err.message);
        } else {
          console.log('[DB] course_lessons table ready');
        }
      }
    );

    // Записи пользователей на курсы и прогресс по урокам
    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_enrollments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          course_id TEXT NOT NULL,
          enrolled_at TEXT DEFAULT (datetime('now')),
          UNIQUE(user_id, course_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (course_id) REFERENCES courses(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_enrollments table:', err.message);
        } else {
          console.log('[DB] course_enrollments table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_lesson_progress (
          user_id TEXT NOT NULL,
          lesson_id TEXT NOT NULL,
          completed_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, lesson_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (lesson_id) REFERENCES course_lessons(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_lesson_progress table:', err.message);
        } else {
          console.log('[DB] course_lesson_progress table ready');
        }
      }
    );

    // Вложения к урокам (файлы, картинки)
    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_lesson_attachments (
          id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT,
          order_index INTEGER DEFAULT 0,
          FOREIGN KEY (lesson_id) REFERENCES course_lessons(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_lesson_attachments table:', err.message);
        } else {
          console.log('[DB] course_lesson_attachments table ready');
        }
      }
    );

    // Вопросы закрепляющего теста к уроку (урок считается пройденным только после прохождения теста)
    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_quiz_questions (
          id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          question_text TEXT NOT NULL,
          options TEXT NOT NULL,
          correct_index INTEGER NOT NULL,
          order_index INTEGER DEFAULT 0,
          FOREIGN KEY (lesson_id) REFERENCES course_lessons(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_quiz_questions table:', err.message);
        } else {
          console.log('[DB] course_quiz_questions table ready');
        }
      }
    );

    // Модули курса (расширение: Курс → Модули → Уроки)
    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_modules (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          title TEXT NOT NULL,
          order_index INTEGER DEFAULT 0,
          FOREIGN KEY (course_id) REFERENCES courses(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_modules table:', err.message);
        } else {
          console.log('[DB] course_modules table ready');
        }
      }
    );

    // Шаги урока (теория, видео, тест, практическое задание)
    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_lesson_steps (
          id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          step_type TEXT NOT NULL CHECK (step_type IN ('theory', 'video', 'test', 'practical')),
          order_index INTEGER DEFAULT 0,
          payload TEXT,
          FOREIGN KEY (lesson_id) REFERENCES course_lessons(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_lesson_steps table:', err.message);
        } else {
          console.log('[DB] course_lesson_steps table ready');
        }
      }
    );

    // Расширение course_lessons: привязка к модулю
    db.run(
      "ALTER TABLE course_lessons ADD COLUMN module_id TEXT REFERENCES course_modules(id)",
      (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
          console.error('[DB] Error adding module_id to course_lessons:', err.message);
        } else if (!err) {
          console.log('[DB] Added module_id column to course_lessons');
        }
      }
    );
  });
}

if (require.main === module) {
  initDB();
}

module.exports = initDB;

