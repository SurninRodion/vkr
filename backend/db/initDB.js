const db = require('./db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function seedCourseFromJsonFile(absPath, done) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const course = safeJsonParse(raw, null);
  if (!course?.title) return done();

  db.get('SELECT id FROM courses WHERE title = ? LIMIT 1', [course.title], (err, row) => {
    if (err) return done();
    if (row?.id) return done();

    const courseId = uuidv4();
    db.run(
      'INSERT INTO courses (id, title, description) VALUES (?, ?, ?)',
      [courseId, String(course.title).trim(), String(course.description ?? '')],
      (errIns) => {
        if (errIns) return done();

        const modules = Array.isArray(course.modules) ? course.modules : [];
        const modStmt = db.prepare(
          'INSERT INTO course_modules (id, course_id, title, order_index) VALUES (?, ?, ?, ?)'
        );
        const lessonStmt = db.prepare(
          'INSERT INTO course_lessons (id, course_id, module_id, title, content, order_index) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const stepStmt = db.prepare(
          'INSERT INTO course_lesson_steps (id, lesson_id, step_type, order_index, payload) VALUES (?, ?, ?, ?, ?)'
        );
        const quizStmt = db.prepare(
          'INSERT INTO course_quiz_questions (id, lesson_id, question_text, options, correct_index, order_index) VALUES (?, ?, ?, ?, ?, ?)'
        );

        const insertedLessonIds = [];
        modules.forEach((m, mi) => {
          const modId = uuidv4();
          modStmt.run(modId, courseId, String(m?.title || `Модуль ${mi + 1}`), mi);

          const lessons = Array.isArray(m?.lessons) ? m.lessons : [];
          lessons.forEach((l, li) => {
            if (!l?.title) return;
            const lessonId = uuidv4();
            insertedLessonIds.push(lessonId);
            lessonStmt.run(
              lessonId,
              courseId,
              modId,
              String(l.title).trim(),
              String(l.content ?? ''),
              typeof l.order_index === 'number' ? l.order_index : li
            );

            const steps = Array.isArray(l.steps) ? l.steps : [];
            steps.forEach((s, si) => {
              const stepType = ['theory', 'video', 'test', 'practical'].includes(s?.step_type)
                ? s.step_type
                : 'theory';
              const payload =
                typeof s?.payload === 'object' && s.payload !== null ? JSON.stringify(s.payload) : '{}';
              stepStmt.run(
                uuidv4(),
                lessonId,
                stepType,
                typeof s?.order_index === 'number' ? s.order_index : si,
                payload
              );
            });

            const quiz = Array.isArray(l.quiz_questions) ? l.quiz_questions : [];
            quiz.forEach((q, qi) => {
              if (!q?.question_text || !Array.isArray(q.options) || q.options.length < 2) return;
              const correctIndex = Math.max(
                0,
                Math.min(Number(q.correct_index ?? 0) || 0, q.options.length - 1)
              );
              quizStmt.run(
                uuidv4(),
                lessonId,
                String(q.question_text).trim(),
                JSON.stringify(q.options),
                correctIndex,
                typeof q.order_index === 'number' ? q.order_index : qi
              );
            });
          });
        });

        modStmt.finalize(() => {
          lessonStmt.finalize(() => {
            stepStmt.finalize(() => {
              quizStmt.finalize(() => done());
            });
          });
        });
      }
    );
  });
}

function seedCourses() {
  try {
    const seedDir = path.join(__dirname, 'seed', 'courses');
    const seedFiles = [
      {
        file: 'prompt-engineering-basics.ru.json',
        logTitle: 'Основы промпт-инжиниринга',
      },
      {
        file: 'image-generation-basics.ru.json',
        logTitle: 'Генерация изображений: быстрый старт',
      },
    ];

    seedFiles.forEach(({ file, logTitle }) => {
      const seedPath = path.join(seedDir, file);
      if (!fs.existsSync(seedPath)) return;
      seedCourseFromJsonFile(seedPath, () => {
        console.log('[DB] Seeded course:', logTitle);
      });
    });
  } catch (e) {
    console.error('[DB] Error seeding courses:', e.message);
  }
}

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

    db.run(
      "ALTER TABLE users ADD COLUMN last_seen_at TEXT",
      (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
          console.error('[DB] Error adding last_seen_at to users table:', err.message);
        } else if (!err) {
          console.log('[DB] Added last_seen_at column to users table');
        }
      }
    );

    db.run(
      "ALTER TABLE users ADD COLUMN email_verified_at TEXT",
      (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
          console.error('[DB] Error adding email_verified_at to users table:', err.message);
        } else if (!err) {
          console.log('[DB] Added email_verified_at column to users table');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating email_verification_tokens table:', err.message);
        } else {
          console.log('[DB] email_verification_tokens table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating password_reset_tokens table:', err.message);
        } else {
          console.log('[DB] password_reset_tokens table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS auth_rate_limits (
          id TEXT PRIMARY KEY,
          scope TEXT NOT NULL,
          key TEXT NOT NULL,
          window_start_ms INTEGER NOT NULL,
          count INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(scope, key)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating auth_rate_limits table:', err.message);
        } else {
          console.log('[DB] auth_rate_limits table ready');
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
          db.get('SELECT COUNT(*) AS c FROM prompt_library', [], (countErr, row) => {
            if (countErr) {
              console.error('[DB] Error counting prompt_library:', countErr.message);
              return;
            }
            if (row && row.c > 0) return;
            const seedId = 'seed-prompt-library-demo-001';
            db.run(
              `
                INSERT INTO prompt_library (id, title, category, description, example, analysis)
                VALUES (?, ?, ?, ?, ?, ?)
              `,
              [
                seedId,
                'Объясни сложную тему простыми словами',
                'learning',
                'Шаблон для запроса к ИИ: сначала роль и контекст, затем цель, формат ответа и ограничения. Подходит для учебников, объяснений концепций и подготовки к экзаменам.',
                `Ты — опытный преподаватель [дисциплина/уровень: например, физика 9 класс]. Объясни тему «[название темы]» так, чтобы её понял человек без глубокой подготовки.

Структура ответа:
1) Одной фразой — зачем эта тема важна.
2) Ключевые термины — с короткими определениями.
3) Пошаговое объяснение с примером из жизни или простой аналогией.
4) Типичная ошибка, которую делают новички, и как её избежать.
5) В конце — 3 проверочных вопроса с ответами.

Пиши ясно, без лишней воды. Если нужны уточнения, задай до 3 вопросов, затем дай ответ.`,
                `Почему структура работает: роль задаёт тон, формат — предсказуемый каркас ответа, пример/аналогия снижает когнитивную нагрузку, блок про ошибки — типичный приём в педагогике. Плейсхолдеры в квадратных скобках стоит заменить на свои данные — так промпт становится конкретным и проверяемым.`
              ],
              (seedErr) => {
                if (seedErr) {
                  console.error('[DB] Error seeding prompt_library:', seedErr.message);
                } else {
                  console.log('[DB] Seeded default prompt_library entry');
                }
              }
            );
          });
        }
      }
    );

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

    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_lesson_videos (
          id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (lesson_id) REFERENCES course_lessons(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_lesson_videos table:', err.message);
        } else {
          console.log('[DB] course_lesson_videos table ready');
        }
      }
    );

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

    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_practical_submissions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          course_id TEXT NOT NULL,
          lesson_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          submission_text TEXT NOT NULL,
          ai_feedback TEXT,
          score INTEGER,
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(user_id, course_id, lesson_id, step_id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_practical_submissions table:', err.message);
        } else {
          console.log('[DB] course_practical_submissions table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_certificate_templates (
          course_id TEXT PRIMARY KEY,
          enabled INTEGER DEFAULT 0,
          title TEXT,
          template_html TEXT,
          template_css TEXT,
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (course_id) REFERENCES courses(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_certificate_templates table:', err.message);
        } else {
          console.log('[DB] course_certificate_templates table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS course_certificates (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          course_id TEXT NOT NULL,
          serial TEXT,
          issued_at TEXT DEFAULT (datetime('now')),
          rendered_html TEXT NOT NULL,
          meta_json TEXT,
          UNIQUE(user_id, course_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (course_id) REFERENCES courses(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating course_certificates table:', err.message);
        } else {
          console.log('[DB] course_certificates table ready');
        }
      }
    );

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

    db.run(
      "ALTER TABLE course_lessons ADD COLUMN quiz_required INTEGER DEFAULT 1",
      (err) => {
        if (err && !/duplicate column name/i.test(err.message)) {
          console.error('[DB] Error adding quiz_required to course_lessons:', err.message);
        } else if (!err) {
          console.log('[DB] Added quiz_required column to course_lessons');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS achievement_definitions (
          id TEXT PRIMARY KEY,
          key TEXT UNIQUE NOT NULL,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '',
          rarity TEXT NOT NULL CHECK (
            rarity IN ('common','rare','epic','legendary')
          ),
          points_reward INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating achievement_definitions:', err.message);
        } else {
          console.log('[DB] achievement_definitions table ready');
        }
      }
    );

    db.run(
      `
        CREATE TABLE IF NOT EXISTS user_achievements (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          achievement_id TEXT NOT NULL,
          unlocked_at TEXT DEFAULT (datetime('now')),
          UNIQUE(user_id, achievement_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id)
        )
      `,
      (err) => {
        if (err) {
          console.error('[DB] Error creating user_achievements:', err.message);
        } else {
          console.log('[DB] user_achievements table ready');
        }
      }
    );

    db.run(
      `
        CREATE INDEX IF NOT EXISTS idx_user_achievements_user
        ON user_achievements (user_id)
      `,
      (err) => {
        if (err && !/already exists/i.test(err.message || '')) {
          console.error('[DB] idx_user_achievements_user:', err.message);
        }
      }
    );

    db.run(
      `
        CREATE INDEX IF NOT EXISTS idx_user_achievements_definition
        ON user_achievements (achievement_id)
      `,
      (err) => {
        if (err && !/already exists/i.test(err.message || '')) {
          console.error('[DB] idx_user_achievements_definition:', err.message);
        }
      }
    );

    function seedAchievementDefinitions(done) {
      const rows = [
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000001',
          'edu_first_course',
          'learning',
          '🎓 Первый курс',
          'Завершите первый учебный курс целиком: все уроки отмечены как пройденные.',
          '🎓',
          'common',
          35,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000002',
          'edu_five_courses',
          'learning',
          '📚 Завершил 5 курсов',
          'Пройдите пять разных курсов до конца — серьёзный вклад в обучение.',
          '📚',
          'epic',
          160,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000003',
          'edu_theory_master',
          'learning',
          '🧠 Мастер теории',
          'Закройте не менее 40 уроков по курсам — глубокая работа с материалом.',
          '🧠',
          'rare',
          90,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000004',
          'practice_first_task',
          'practice',
          '⚡ Первое задание',
          'Выполните первое практическое задание в разделе «Практика».',
          '⚡',
          'common',
          25,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000005',
          'practice_ten_tasks',
          'practice',
          '🔥 Выполнил 10 заданий',
          'Решите 10 практических заданий — уверенная серия побед.',
          '🔥',
          'rare',
          80,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000006',
          'practice_high_score',
          'practice',
          '🎯 Высокий уровень',
          'Получите оценку эффективности не ниже 8/10 хотя бы в одном задании.',
          '🎯',
          'common',
          40,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000007',
          'act_1000_points',
          'activity',
          '🚀 Набрал 1000 очков',
          'Достигните суммарно 1000 очков активности.',
          '🚀',
          'common',
          50,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000008',
          'act_top10',
          'activity',
          '👑 Попал в ТОП-10',
          'Стремитесь войти в топ-10 глобального рейтинга по очкам.',
          '👑',
          'epic',
          175,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-000000000009',
          'act_first_place',
          'activity',
          '🥇 Первое место в рейтинге',
          'Займите первую строчку рейтинга.',
          '🥇',
          'legendary',
          400,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-00000000000a',
          'pe_prompt_architect',
          'prompting',
          '🤖 Архитектор промптов',
          'Обработайте в «Лаборатории» 25 промптов (анализ/генерация).',
          '🤖',
          'rare',
          110,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-00000000000b',
          'pe_prompt_optimizer',
          'prompting',
          '🛠 Оптимизатор промптов',
          'При средней оценке за решения практических заданий не ниже 8/10 завершите 10+ задач.',
          '🛠',
          'epic',
          150,
          0,
        ],
        [
          'aaaaaaaa-aaaa-4aaa-a000-00000000000c',
          'pe_ai_researcher',
          'prompting',
          '🧪 ИИ-исследователь',
          'Сделайте 50 анализов промптов в «Лаборатории» — исследовательский склад ума.',
          '🧪',
          'legendary',
          350,
          0,
        ],
      ];

      const stmt = db.prepare(
        `INSERT OR IGNORE INTO achievement_definitions (
          id, key, category, title, description, icon, rarity, points_reward, hidden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      rows.forEach((row) => {
        stmt.run(row);
      });
      stmt.finalize((e) => done(e || null));
    }

    seedAchievementDefinitions((seedErr) => {
      if (seedErr) {
        console.error('[DB] Achievement seed:', seedErr.message);
      }
    });

    seedCourses();
  });
}

if (require.main === module) {
  initDB();
}

module.exports = initDB;
