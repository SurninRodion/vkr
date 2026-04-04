const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const { analyzePrompt } = require('../utils/aiAnalyzer');
const { UPLOADS_BASE } = require('../middleware/uploadMiddleware');

// ===== STATS =====

async function getStats(req, res) {
  try {
    const totals = await new Promise((resolve, reject) => {
      db.get(
        `
          SELECT
            (SELECT COUNT(*) FROM users)          AS totalUsers,
            (SELECT COUNT(*) FROM tasks)          AS totalTasks,
            (SELECT COUNT(*) FROM prompt_library) AS totalPrompts,
            (SELECT COUNT(DISTINCT user_id) FROM task_results) AS activeUsers
        `,
        [],
        (err, row) => {
          if (err) {
            console.error('[AdminController] Error fetching stats:', err.message);
            return reject(err);
          }
          resolve(row);
        }
      );
    });

    return res.json({
      totalUsers: totals.totalUsers || 0,
      totalTasks: totals.totalTasks || 0,
      totalPrompts: totals.totalPrompts || 0,
      activeUsers: totals.activeUsers || 0
    });
  } catch (err) {
    console.error('[AdminController] getStats error:', err.message);
    return res.status(500).json({ message: 'Ошибка получения статистики' });
  }
}

// ===== TASKS CRUD =====

async function getTasks(req, res) {
  try {
    db.all(
      'SELECT id, title, description, difficulty, points, type FROM tasks ORDER BY rowid DESC',
      [],
      (err, rows) => {
        if (err) {
          console.error('[AdminController] Error fetching tasks:', err.message);
          return res.status(500).json({ message: 'Ошибка получения заданий' });
        }
        return res.json(rows);
      }
    );
  } catch (err) {
    console.error('[AdminController] getTasks error:', err.message);
    return res.status(500).json({ message: 'Ошибка получения заданий' });
  }
}

async function createTask(req, res) {
  try {
    const { title, description, difficulty, points, type } = req.body;

    if (!title || !description || !difficulty || !points || !type) {
      return res.status(400).json({
        message: 'title, description, difficulty, points и type обязательны'
      });
    }

    const id = uuidv4();
    db.run(
      `
        INSERT INTO tasks (id, title, description, difficulty, points, type)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, title, description, difficulty, points, type],
      function (err) {
        if (err) {
          console.error('[AdminController] Error creating task:', err.message);
          return res.status(500).json({ message: 'Ошибка создания задания' });
        }
        return res.status(201).json({
          id,
          title,
          description,
          difficulty,
          points,
          type
        });
      }
    );
  } catch (err) {
    console.error('[AdminController] createTask error:', err.message);
    return res.status(500).json({ message: 'Ошибка создания задания' });
  }
}

async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { title, description, difficulty, points, type } = req.body;

    db.run(
      `
        UPDATE tasks
        SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          difficulty = COALESCE(?, difficulty),
          points = COALESCE(?, points),
          type = COALESCE(?, type)
        WHERE id = ?
      `,
      [title, description, difficulty, points, type, id],
      function (err) {
        if (err) {
          console.error('[AdminController] Error updating task:', err.message);
          return res.status(500).json({ message: 'Ошибка обновления задания' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Задание не найдено' });
        }
        return res.status(200).json({ message: 'Задание обновлено' });
      }
    );
  } catch (err) {
    console.error('[AdminController] updateTask error:', err.message);
    return res.status(500).json({ message: 'Ошибка обновления задания' });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;

    db.run(
      `
        DELETE FROM tasks
        WHERE id = ?
      `,
      [id],
      function (err) {
        if (err) {
          console.error('[AdminController] Error deleting task:', err.message);
          return res.status(500).json({ message: 'Ошибка удаления задания' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Задание не найдено' });
        }
        return res.status(204).send();
      }
    );
  } catch (err) {
    console.error('[AdminController] deleteTask error:', err.message);
    return res.status(500).json({ message: 'Ошибка удаления задания' });
  }
}

async function importTasks(req, res) {
  try {
    const { tasks } = req.body || {};

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: 'Массив tasks обязателен и не может быть пустым' });
    }

    const stmt = db.prepare(
      `
        INSERT INTO tasks (id, title, description, difficulty, points, type)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    for (const t of tasks) {
      if (!t.title || !t.description || !t.difficulty || !t.points) {
        continue;
      }
      const id = uuidv4();
      const type = t.type || 'generic';
      stmt.run(id, t.title, t.description, t.difficulty, t.points, type);
    }

    stmt.finalize((err) => {
      if (err) {
        console.error('[AdminController] Error importing tasks:', err.message);
        return res.status(500).json({ message: 'Ошибка импорта заданий' });
      }
      return res.status(201).json({ message: 'Задания импортированы' });
    });
  } catch (err) {
    console.error('[AdminController] importTasks error:', err.message);
    return res.status(500).json({ message: 'Ошибка импорта заданий' });
  }
}

// ===== AI TASK GENERATION =====

async function generateTasksAI(req, res) {
  try {
    const { topic, count = 3, difficulty = 'medium' } = req.body || {};

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ message: 'Поле topic обязательно' });
    }

    const safeCount = Math.max(1, Math.min(10, Number(count) || 3));

    // Пытаемся использовать внешний AI (через общий анализатор),
    // но даже без него вернём эвристически сгенерированные задания.
    await analyzePrompt(
      `Сгенерируй ${safeCount} практических задания по теме "${topic}" уровня сложности "${difficulty}".`
    );

    const basePoints =
      difficulty === 'easy' ? 50 : difficulty === 'hard' ? 150 : 100;

    const tasks = Array.from({ length: safeCount }).map((_, idx) => {
      const index = idx + 1;
      return {
        title: `${topic}: задание ${index}`,
        description: `Практическое задание №${index} по теме "${topic}" с уровнем сложности "${difficulty}". Сформулируйте или улучшите промпт, который решает прикладную задачу по этой теме.`,
        difficulty,
        points: basePoints,
        type: 'generated'
      };
    });

    return res.status(200).json({ tasks });
  } catch (err) {
    console.error('[AdminController] generateTasksAI error:', err.message);
    return res.status(500).json({ message: 'Ошибка генерации заданий ИИ' });
  }
}

// ===== PROMPT LIBRARY =====

async function getPrompts(req, res) {
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
          console.error('[AdminController] Error fetching prompt library:', err.message);
          return res.status(500).json({ message: 'Ошибка получения библиотеки промптов' });
        }
        return res.json(rows);
      }
    );
  } catch (err) {
    console.error('[AdminController] getPrompts error:', err.message);
    return res.status(500).json({ message: 'Ошибка получения библиотеки промптов' });
  }
}

async function createPrompt(req, res) {
  try {
    const { title, category, description, example, analysis } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: 'title и description обязательны для промпта' });
    }

    const id = uuidv4();
    db.run(
      `
        INSERT INTO prompt_library (id, title, category, description, example, analysis)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, title, category || '', description, example || '', analysis || ''],
      function (err) {
        if (err) {
          console.error('[AdminController] Error creating library prompt:', err.message);
          return res.status(500).json({ message: 'Ошибка создания промпта' });
        }
        return res.status(201).json({
          id,
          title,
          category: category || '',
          description,
          example: example || '',
          analysis: analysis || ''
        });
      }
    );
  } catch (err) {
    console.error('[AdminController] createPrompt error:', err.message);
    return res.status(500).json({ message: 'Ошибка создания промпта' });
  }
}

async function updatePrompt(req, res) {
  try {
    const { id } = req.params;
    const { title, category, description, example, analysis } = req.body;

    db.run(
      `
        UPDATE prompt_library
        SET
          title = COALESCE(?, title),
          category = COALESCE(?, category),
          description = COALESCE(?, description),
          example = COALESCE(?, example),
          analysis = COALESCE(?, analysis)
        WHERE id = ?
      `,
      [title, category, description, example, analysis, id],
      function (err) {
        if (err) {
          console.error('[AdminController] Error updating library prompt:', err.message);
          return res.status(500).json({ message: 'Ошибка обновления промпта' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Промпт не найден' });
        }
        return res.status(200).json({ message: 'Промпт обновлён' });
      }
    );
  } catch (err) {
    console.error('[AdminController] updatePrompt error:', err.message);
    return res.status(500).json({ message: 'Ошибка обновления промпта' });
  }
}

async function deletePrompt(req, res) {
  try {
    const { id } = req.params;

    db.run(
      `
        DELETE FROM prompt_library
        WHERE id = ?
      `,
      [id],
      function (err) {
        if (err) {
          console.error('[AdminController] Error deleting library prompt:', err.message);
          return res.status(500).json({ message: 'Ошибка удаления промпта' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Промпт не найден' });
        }
        return res.status(204).send();
      }
    );
  } catch (err) {
    console.error('[AdminController] deletePrompt error:', err.message);
    return res.status(500).json({ message: 'Ошибка удаления промпта' });
  }
}

function normalizeImportPromptCategory(cat) {
  const s = String(cat ?? '')
    .trim()
    .toLowerCase();
  if (['learning', 'coding', 'style', 'other'].includes(s)) return s;
  if (s === 'обучение') return 'learning';
  if (s === 'код' || s === 'code') return 'coding';
  if (s === 'тон и стиль' || s.includes('тон')) return 'style';
  return 'other';
}

async function importPrompts(req, res) {
  try {
    const { prompts } = req.body || {};

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res
        .status(400)
        .json({ message: 'Массив prompts обязателен и не может быть пустым' });
    }

    const stmt = db.prepare(
      `
        INSERT INTO prompt_library (id, title, category, description, example, analysis)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    let imported = 0;
    for (const p of prompts) {
      if (!p || !p.title || !p.description) continue;
      const id = uuidv4();
      const category = normalizeImportPromptCategory(p.category);
      const title = String(p.title).trim();
      const description = String(p.description).trim();
      const example = p.example != null ? String(p.example) : '';
      const analysis = p.analysis != null ? String(p.analysis) : '';
      stmt.run(id, title, category, description, example, analysis);
      imported += 1;
    }

    stmt.finalize((err) => {
      if (err) {
        console.error('[AdminController] Error importing prompts:', err.message);
        return res.status(500).json({ message: 'Ошибка импорта промптов' });
      }
      if (imported === 0) {
        return res.status(400).json({
          message: 'Ни одной записи не импортировано: у каждого элемента нужны непустые title и description'
        });
      }
      return res.status(201).json({ message: 'Промпты импортированы', imported });
    });
  } catch (err) {
    console.error('[AdminController] importPrompts error:', err.message);
    return res.status(500).json({ message: 'Ошибка импорта промптов' });
  }
}

// ===== COURSES =====

function loadAttachmentsAndQuizForLessons(lessonIds, cb) {
  if (!lessonIds.length) return cb(null, { attachments: {}, quiz: {} });
  const placeholders = lessonIds.map(() => '?').join(',');
  db.all(
    `SELECT id, lesson_id, file_path, original_name, mime_type, order_index FROM course_lesson_attachments WHERE lesson_id IN (${placeholders}) ORDER BY lesson_id, order_index`,
    lessonIds,
    (err, attachments) => {
      if (err) return cb(err);
      db.all(
        `SELECT id, lesson_id, question_text, options, correct_index, order_index FROM course_quiz_questions WHERE lesson_id IN (${placeholders}) ORDER BY lesson_id, order_index`,
        lessonIds,
        (err2, quizRows) => {
          if (err2) return cb(err2);
          const byLessonAtt = {};
          (attachments || []).forEach((a) => {
            if (!byLessonAtt[a.lesson_id]) byLessonAtt[a.lesson_id] = [];
            byLessonAtt[a.lesson_id].push({
              id: a.id,
              url: '/' + a.file_path.replace(/\\/g, '/'),
              original_name: a.original_name,
              mime_type: a.mime_type
            });
          });
          const byLessonQuiz = {};
          (quizRows || []).forEach((q) => {
            if (!byLessonQuiz[q.lesson_id]) byLessonQuiz[q.lesson_id] = [];
            let opts = [];
            try {
              opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options || [];
            } catch (_) {}
            byLessonQuiz[q.lesson_id].push({
              id: q.id,
              question_text: q.question_text,
              options: opts,
              correct_index: q.correct_index
            });
          });
          return cb(null, { attachments: byLessonAtt, quiz: byLessonQuiz });
        }
      );
    }
  );
}

function loadStepsForLessons(lessonIds, cb) {
  if (!lessonIds.length) return cb(null, {});
  const placeholders = lessonIds.map(() => '?').join(',');
  db.all(
    `SELECT id, lesson_id, step_type, order_index, payload FROM course_lesson_steps WHERE lesson_id IN (${placeholders}) ORDER BY lesson_id, order_index ASC`,
    lessonIds,
    (err, rows) => {
      if (err) return cb(err);
      const byLesson = {};
      (rows || []).forEach((r) => {
        if (!byLesson[r.lesson_id]) byLesson[r.lesson_id] = [];
        let payload = null;
        try {
          payload = r.payload ? JSON.parse(r.payload) : {};
        } catch (_) {}
        byLesson[r.lesson_id].push({
          id: r.id,
          step_type: r.step_type,
          order_index: r.order_index,
          payload: payload || {}
        });
      });
      return cb(null, byLesson);
    }
  );
}

async function getCourses(req, res) {
  try {
    db.all(
      `SELECT id, title, description FROM courses ORDER BY rowid DESC`,
      [],
      (err, courses) => {
        if (err) {
          console.error('[AdminController] Error fetching courses:', err.message);
          return res.status(500).json({ message: 'Ошибка получения курсов' });
        }
        if (!courses.length) return res.json([]);

        const ids = courses.map((c) => c.id);
        const placeholders = ids.map(() => '?').join(',');

        db.all(
          `SELECT id, course_id, module_id, title, content, order_index FROM course_lessons WHERE course_id IN (${placeholders}) ORDER BY course_id, order_index ASC`,
          ids,
          (err2, lessons) => {
            if (err2) {
              console.error('[AdminController] Error fetching lessons:', err2.message);
              return res.status(500).json({ message: 'Ошибка получения уроков' });
            }

            db.all(
              `SELECT id, course_id, title, order_index FROM course_modules WHERE course_id IN (${placeholders}) ORDER BY course_id, order_index ASC`,
              ids,
              (errMod, modulesRows) => {
                if (errMod) {
                  console.error('[AdminController] Error fetching modules:', errMod.message);
                  return res.status(500).json({ message: 'Ошибка получения модулей' });
                }

                const grouped = {};
                const lessonIds = [];
                for (const lesson of lessons || []) {
                  lessonIds.push(lesson.id);
                  if (!grouped[lesson.course_id]) grouped[lesson.course_id] = [];
                  grouped[lesson.course_id].push({
                    id: lesson.id,
                    title: lesson.title,
                    content: lesson.content,
                    order_index: lesson.order_index,
                    module_id: lesson.module_id || null
                  });
                }

                loadAttachmentsAndQuizForLessons(lessonIds, (err3, extra) => {
                  if (err3) return res.status(500).json({ message: 'Ошибка загрузки вложений/тестов' });
                  loadStepsForLessons(lessonIds, (errSteps, stepsByLesson) => {
                    if (errSteps) return res.status(500).json({ message: 'Ошибка загрузки шагов' });
                    for (const list of Object.values(grouped)) {
                      for (const lesson of list) {
                        lesson.attachments = extra.attachments[lesson.id] || [];
                        lesson.quiz_questions = extra.quiz[lesson.id] || [];
                        lesson.steps = stepsByLesson[lesson.id] || [];
                      }
                    }
                    const modulesByCourse = {};
                    (modulesRows || []).forEach((m) => {
                      if (!modulesByCourse[m.course_id]) modulesByCourse[m.course_id] = [];
                      modulesByCourse[m.course_id].push({
                        id: m.id,
                        title: m.title,
                        order_index: m.order_index,
                        lessons: (grouped[m.course_id] || []).filter((l) => l.module_id === m.id)
                      });
                    });
                    const result = courses.map((c) => ({
                      ...c,
                      lessons: grouped[c.id] || [],
                      modules: (modulesByCourse[c.id] || []).sort((a, b) => a.order_index - b.order_index)
                    }));
                    return res.json(result);
                  });
                });
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error('[AdminController] getCourses error:', err.message);
    return res.status(500).json({ message: 'Ошибка получения курсов' });
  }
}

function saveStepsForLesson(lessonId, steps, done) {
  if (!Array.isArray(steps) || !steps.length) {
    db.run('DELETE FROM course_lesson_steps WHERE lesson_id = ?', [lessonId], () => done());
    return;
  }
  const validTypes = ['theory', 'video', 'test', 'practical'];
  db.run('DELETE FROM course_lesson_steps WHERE lesson_id = ?', [lessonId], () => {
    const stmt = db.prepare(
      `INSERT INTO course_lesson_steps (id, lesson_id, step_type, order_index, payload) VALUES (?, ?, ?, ?, ?)`
    );
    steps.forEach((s, i) => {
      const type = validTypes.includes(s.step_type) ? s.step_type : 'theory';
      const orderIndex = typeof s.order_index === 'number' ? s.order_index : i;
      const payload = typeof s.payload === 'object' && s.payload !== null ? JSON.stringify(s.payload) : (s.payload ? String(s.payload) : '{}');
      stmt.run(uuidv4(), lessonId, type, orderIndex, payload);
    });
    stmt.finalize(done);
  });
}

async function createCourse(req, res) {
  try {
    const { title, description, lessons = [], modules: modulesPayload } = req.body || {};

    if (!title) {
      return res.status(400).json({ message: 'title обязателен для курса' });
    }

    const id = uuidv4();
    db.run(
      `INSERT INTO courses (id, title, description) VALUES (?, ?, ?)`,
      [id, title, description || ''],
      (err) => {
        if (err) {
          console.error('[AdminController] Error creating course:', err.message);
          return res.status(500).json({ message: 'Ошибка создания курса' });
        }

        const useModules = Array.isArray(modulesPayload) && modulesPayload.length > 0;
        const lessonsToInsert = useModules
          ? modulesPayload.flatMap((mod, mi) => (mod.lessons || []).map((l, li) => ({ ...l, module_order: mi, order_index: l.order_index ?? li })))
          : Array.isArray(lessons) ? lessons.map((l, i) => ({ ...l, module_id: null, order_index: l.order_index ?? i })) : [];

        if (!lessonsToInsert.length) {
          return res.status(201).json({ id, title, description: description || '', lessons: [], modules: [] });
        }

        if (useModules) {
          const modStmt = db.prepare(
            `INSERT INTO course_modules (id, course_id, title, order_index) VALUES (?, ?, ?, ?)`
          );
          const moduleIds = [];
          modulesPayload.forEach((mod, mi) => {
            const modId = uuidv4();
            moduleIds.push({ id: modId, order_index: mi });
            modStmt.run(modId, id, mod.title || `Модуль ${mi + 1}`, mi);
          });
          modStmt.finalize((errMod) => {
            if (errMod) {
              console.error('[AdminController] Error creating modules:', errMod.message);
              return res.status(500).json({ message: 'Ошибка создания модулей' });
            }
            const lessonStmt = db.prepare(
              `INSERT INTO course_lessons (id, course_id, module_id, title, content, order_index) VALUES (?, ?, ?, ?, ?, ?)`
            );
            let lessonIndex = 0;
            const insertedLessons = [];
            modulesPayload.forEach((mod, mi) => {
              const modId = moduleIds[mi].id;
              (mod.lessons || []).forEach((lesson, li) => {
                if (!lesson.title) return;
                const lessonId = uuidv4();
                const orderIndex = typeof lesson.order_index === 'number' ? lesson.order_index : lessonIndex;
                lessonStmt.run(lessonId, id, modId, lesson.title, lesson.content || '', orderIndex);
                insertedLessons.push({ id: lessonId, title: lesson.title, content: lesson.content || '', order_index: orderIndex, module_id: modId, steps: lesson.steps || [] });
                lessonIndex++;
              });
            });
            lessonStmt.finalize((errLess) => {
              if (errLess) {
                console.error('[AdminController] Error creating lessons:', errLess.message);
                return res.status(500).json({ message: 'Ошибка создания уроков' });
              }
              let stepsDone = 0;
              const total = insertedLessons.length;
              if (total === 0) return res.status(201).json({ id, title, description: description || '', lessons: [], modules: modulesPayload });
              insertedLessons.forEach((l) => {
                saveStepsForLesson(l.id, l.steps, () => {
                  stepsDone++;
                  if (stepsDone >= total) res.status(201).json({ id, title, description: description || '', lessons: insertedLessons, modules: modulesPayload });
                });
              });
            });
          });
          return;
        }

        const stmt = db.prepare(
          `INSERT INTO course_lessons (id, course_id, title, content, order_index) VALUES (?, ?, ?, ?, ?)`
        );
        const insertedLessons = [];

        lessons.forEach((lesson, index) => {
          if (!lesson.title) return;
          const lessonId = uuidv4();
          stmt.run(
            lessonId,
            id,
            lesson.title,
            lesson.content || '',
            typeof lesson.order_index === 'number' ? lesson.order_index : index
          );
          insertedLessons.push({
            id: lessonId,
            title: lesson.title,
            content: lesson.content || '',
            order_index: typeof lesson.order_index === 'number' ? lesson.order_index : index,
            attachments: [],
            quiz_questions: []
          });
        });

        stmt.finalize((err2) => {
          if (err2) {
            console.error('[AdminController] Error creating lessons:', err2.message);
            return res.status(500).json({ message: 'Ошибка создания уроков' });
          }
          return res.status(201).json({
            id,
            title,
            description: description || '',
            lessons: insertedLessons
          });
        });
      }
    );
  } catch (err) {
    console.error('[AdminController] createCourse error:', err.message);
    return res.status(500).json({ message: 'Ошибка создания курса' });
  }
}

async function updateCourse(req, res) {
  try {
    const { id: courseId } = req.params;
    const { title, description, lessons, modules: modulesPayload } = req.body || {};

    db.run(
      `UPDATE courses SET title = COALESCE(?, title), description = COALESCE(?, description) WHERE id = ?`,
      [title, description, courseId],
      function (err) {
        if (err) {
          console.error('[AdminController] Error updating course:', err.message);
          return res.status(500).json({ message: 'Ошибка обновления курса' });
        }
        if (this.changes === 0) return res.status(404).json({ message: 'Курс не найден' });

        const useModules = Array.isArray(modulesPayload) && modulesPayload.length > 0;

        if (useModules) {
          db.all('SELECT id FROM course_modules WHERE course_id = ?', [courseId], (errModList, existingMods) => {
            if (errModList) return res.status(500).json({ message: 'Ошибка обновления курса' });
            const existingModIds = new Set((existingMods || []).map((m) => m.id));
            const payloadModIds = new Set(modulesPayload.map((m) => m.id).filter(Boolean));
            const modsToDelete = [...existingModIds].filter((mid) => !payloadModIds.has(mid));

            function deleteModuleCascade(modId, done) {
              db.all('SELECT id FROM course_lessons WHERE module_id = ?', [modId], (e, less) => {
                const lessonIds = (less || []).map((l) => l.id);
                function delLessons(idx) {
                  if (idx >= lessonIds.length) {
                    db.run('DELETE FROM course_modules WHERE id = ?', [modId], () => done());
                    return;
                  }
                  deleteLessonAttachmentsQuizSteps(lessonIds[idx], () => delLessons(idx + 1));
                }
                delLessons(0);
              });
            }

            function deleteLessonAttachmentsQuizSteps(lessonId, done) {
              db.run('DELETE FROM course_lesson_steps WHERE lesson_id = ?', [lessonId]);
              db.all('SELECT id, file_path FROM course_lesson_attachments WHERE lesson_id = ?', [lessonId], (e, atts) => {
                (atts || []).forEach((a) => {
                  try {
                    const fullPath = path.join(__dirname, '..', a.file_path);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                  } catch (_) {}
                });
                db.run('DELETE FROM course_lesson_attachments WHERE lesson_id = ?', [lessonId]);
                db.run('DELETE FROM course_quiz_questions WHERE lesson_id = ?', [lessonId]);
                db.run('DELETE FROM course_lesson_progress WHERE lesson_id = ?', [lessonId]);
                db.run('DELETE FROM course_lessons WHERE id = ?', [lessonId], () => done());
              });
            }

            function saveQuizForLesson(lessonId, questions, done) {
              db.run('DELETE FROM course_quiz_questions WHERE lesson_id = ?', [lessonId], () => {
                if (!Array.isArray(questions) || !questions.length) return done();
                const stmt = db.prepare(
                  `INSERT INTO course_quiz_questions (id, lesson_id, question_text, options, correct_index, order_index) VALUES (?, ?, ?, ?, ?, ?)`
                );
                questions.forEach((q, i) => {
                  if (!q.question_text || !Array.isArray(q.options)) return;
                  const opts = JSON.stringify(q.options);
                  const correct = Math.max(0, Math.min((q.correct_index ?? 0), (q.options?.length || 1) - 1));
                  stmt.run(uuidv4(), lessonId, q.question_text, opts, correct, i);
                });
                stmt.finalize(done);
              });
            }

            let modDelIdx = 0;
            function doDeleteMods() {
              if (modDelIdx >= modsToDelete.length) return syncModules();
              deleteModuleCascade(modsToDelete[modDelIdx], () => {
                modDelIdx++;
                doDeleteMods();
              });
            }

            function syncModules() {
              db.all('SELECT id FROM course_lessons WHERE course_id = ?', [courseId], (errLess, existingLessons) => {
                if (errLess) return res.status(500).json({ message: 'Ошибка обновления курса' });
                const existingLessonIds = new Set((existingLessons || []).map((l) => l.id));
                const allPayloadLessons = modulesPayload.flatMap((mod) => (mod.lessons || []).map((l) => ({ ...l, module_id: mod.id })));
                const payloadLessonIds = new Set(allPayloadLessons.map((l) => l.id).filter(Boolean));
                const lessonsToDelete = [...existingLessonIds].filter((lid) => !payloadLessonIds.has(lid));

                let delIdx = 0;
                function doDeleteLessons() {
                  if (delIdx >= lessonsToDelete.length) return upsertModulesAndLessons();
                  deleteLessonAttachmentsQuizSteps(lessonsToDelete[delIdx], () => {
                    delIdx++;
                    doDeleteLessons();
                  });
                }
                doDeleteLessons();
              });
            }

            function upsertModulesAndLessons() {
              const existingModIdsSet = new Set();
              db.all('SELECT id FROM course_modules WHERE course_id = ?', [courseId], (e, mods) => {
                (mods || []).forEach((m) => existingModIdsSet.add(m.id));
                let processed = 0;
                const totalMods = modulesPayload.length;
                if (totalMods === 0) return res.status(200).json({ message: 'Курс обновлён' });

                modulesPayload.forEach((mod, modIndex) => {
                  const modId = mod.id && existingModIdsSet.has(mod.id) ? mod.id : null;
                  if (modId) {
                    db.run(
                      'UPDATE course_modules SET title = ?, order_index = ? WHERE id = ?',
                      [mod.title || `Модуль ${modIndex + 1}`, modIndex, modId],
                      () => upsertLessonsForModule(mod, modId, modIndex, () => {
                        processed++;
                        if (processed >= totalMods) res.status(200).json({ message: 'Курс обновлён' });
                      })
                    );
                  } else {
                    const newModId = uuidv4();
                    db.run(
                      'INSERT INTO course_modules (id, course_id, title, order_index) VALUES (?, ?, ?, ?)',
                      [newModId, courseId, mod.title || `Модуль ${modIndex + 1}`, modIndex],
                      () => upsertLessonsForModule(mod, newModId, modIndex, () => {
                        processed++;
                        if (processed >= totalMods) res.status(200).json({ message: 'Курс обновлён' });
                      })
                    );
                  }
                });
              });
            }

            function upsertLessonsForModule(mod, moduleId, modIndex, done) {
              db.all('SELECT id FROM course_lessons WHERE course_id = ?', [courseId], (errL, existingLessons) => {
                if (errL) return done();
                const existingIds = new Set((existingLessons || []).map((l) => l.id));
                const lessons = mod.lessons || [];
                let lessonProcessed = 0;
                const total = lessons.filter((l) => l.title).length;
                if (total === 0) return done();

                lessons.forEach((lesson, lessonIndex) => {
                  if (!lesson.title) return;
                  const orderIndex = typeof lesson.order_index === 'number' ? lesson.order_index : lessonIndex;

                  if (lesson.id && existingIds.has(lesson.id)) {
                    db.run(
                      `UPDATE course_lessons SET title = ?, content = ?, order_index = ?, module_id = ? WHERE id = ? AND course_id = ?`,
                      [lesson.title, lesson.content || '', orderIndex, moduleId, lesson.id, courseId],
                      function (upErr) {
                        if (upErr) console.error('[AdminController] Error updating lesson:', upErr.message);
                        saveQuizForLesson(lesson.id, lesson.quiz_questions || [], () => {
                          saveStepsForLesson(lesson.id, lesson.steps || [], () => {
                            lessonProcessed++;
                            if (lessonProcessed >= total) done();
                          });
                        });
                      }
                    );
                  } else {
                    const newId = uuidv4();
                    db.run(
                      `INSERT INTO course_lessons (id, course_id, module_id, title, content, order_index) VALUES (?, ?, ?, ?, ?, ?)`,
                      [newId, courseId, moduleId, lesson.title, lesson.content || '', orderIndex],
                      (insErr) => {
                        if (insErr) console.error('[AdminController] Error inserting lesson:', insErr.message);
                        saveQuizForLesson(newId, lesson.quiz_questions || [], () => {
                          saveStepsForLesson(newId, lesson.steps || [], () => {
                            lessonProcessed++;
                            if (lessonProcessed >= total) done();
                          });
                        });
                      }
                    );
                  }
                });
              });
            }

            doDeleteMods();
          });
          return;
        }

        if (!Array.isArray(lessons)) return res.status(200).json({ message: 'Курс обновлён' });

        db.all(
          'SELECT id FROM course_lessons WHERE course_id = ?',
          [courseId],
          (errList, existingLessons) => {
            if (errList) return res.status(500).json({ message: 'Ошибка обновления курса' });
            const existingIds = new Set((existingLessons || []).map((l) => l.id));
            const payloadIds = new Set(lessons.map((l) => l.id).filter(Boolean));
            const toDelete = [...existingIds].filter((lid) => !payloadIds.has(lid));

            function deleteLessonAttachmentsAndQuiz(lessonId, done) {
              db.run('DELETE FROM course_lesson_steps WHERE lesson_id = ?', [lessonId]);
              db.all(
                'SELECT id, file_path FROM course_lesson_attachments WHERE lesson_id = ?',
                [lessonId],
                (e, atts) => {
                  (atts || []).forEach((a) => {
                    const fullPath = path.join(__dirname, '..', a.file_path);
                    try {
                      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                    } catch (_) {}
                  });
                  db.run('DELETE FROM course_lesson_attachments WHERE lesson_id = ?', [lessonId]);
                  db.run('DELETE FROM course_quiz_questions WHERE lesson_id = ?', [lessonId], () =>
                    done()
                  );
                }
              );
            }

            function doNext(idx) {
              if (idx >= toDelete.length) return upsertLessons();
              deleteLessonAttachmentsAndQuiz(toDelete[idx], () => doNext(idx + 1));
            }
            doNext(0);

            function upsertLessons() {
              let processed = 0;
              const total = lessons.filter((l) => l.title).length;
              if (total === 0) return res.status(200).json({ message: 'Курс обновлён' });

              lessons.forEach((lesson, index) => {
                if (!lesson.title) return;
                const orderIndex = typeof lesson.order_index === 'number' ? lesson.order_index : index;

                if (lesson.id && existingIds.has(lesson.id)) {
                  db.run(
                    `UPDATE course_lessons SET title = ?, content = ?, order_index = ? WHERE id = ? AND course_id = ?`,
                    [lesson.title, lesson.content || '', orderIndex, lesson.id, courseId],
                    function (upErr) {
                      if (upErr) {
                        console.error('[AdminController] Error updating lesson:', upErr.message);
                      }
                      saveQuizForLesson(lesson.id, lesson.quiz_questions || [], () => {
                        processed++;
                        if (processed >= total) res.status(200).json({ message: 'Курс обновлён' });
                      });
                    }
                  );
                } else {
                  const newId = uuidv4();
                  db.run(
                    `INSERT INTO course_lessons (id, course_id, title, content, order_index) VALUES (?, ?, ?, ?, ?)`,
                    [newId, courseId, lesson.title, lesson.content || '', orderIndex],
                    (insErr) => {
                      if (insErr) {
                        console.error('[AdminController] Error inserting lesson:', insErr.message);
                      }
                      saveQuizForLesson(newId, lesson.quiz_questions || [], () => {
                        processed++;
                        if (processed >= total) res.status(200).json({ message: 'Курс обновлён' });
                      });
                    }
                  );
                }
              });
            }

            function saveQuizForLesson(lessonId, questions, done) {
              db.run('DELETE FROM course_quiz_questions WHERE lesson_id = ?', [lessonId], () => {
                if (!Array.isArray(questions) || !questions.length) return done();
                const stmt = db.prepare(
                  `INSERT INTO course_quiz_questions (id, lesson_id, question_text, options, correct_index, order_index) VALUES (?, ?, ?, ?, ?, ?)`
                );
                questions.forEach((q, i) => {
                  if (!q.question_text || !Array.isArray(q.options)) return;
                  const opts = JSON.stringify(q.options);
                  const correct = Math.max(0, Math.min((q.correct_index ?? 0), (q.options?.length || 1) - 1));
                  stmt.run(uuidv4(), lessonId, q.question_text, opts, correct, i);
                });
                stmt.finalize(done);
              });
            }
          }
        );
      }
    );
  } catch (err) {
    console.error('[AdminController] updateCourse error:', err.message);
    return res.status(500).json({ message: 'Ошибка обновления курса' });
  }
}

async function deleteCourse(req, res) {
  try {
    const { id } = req.params;

    db.all('SELECT id FROM course_lessons WHERE course_id = ?', [id], (err, lessons) => {
      if (err) return res.status(500).json({ message: 'Ошибка удаления курса' });
      const lessonIds = (lessons || []).map((l) => l.id);
      lessonIds.forEach((lid) => {
        db.run('DELETE FROM course_lesson_steps WHERE lesson_id = ?', [lid]);
        db.run('DELETE FROM course_lesson_attachments WHERE lesson_id = ?', [lid]);
        db.run('DELETE FROM course_quiz_questions WHERE lesson_id = ?', [lid]);
      });
      db.run('DELETE FROM course_modules WHERE course_id = ?', [id]);
      db.run('DELETE FROM course_practical_submissions WHERE course_id = ?', [id]);
      db.run('DELETE FROM course_lessons WHERE course_id = ?', [id], (err2) => {
        if (err2) return res.status(500).json({ message: 'Ошибка удаления уроков' });
        db.run('DELETE FROM courses WHERE id = ?', [id], function (err3) {
          if (err3) return res.status(500).json({ message: 'Ошибка удаления курса' });
          if (this.changes === 0) return res.status(404).json({ message: 'Курс не найден' });
          return res.status(204).send();
        });
      });
    });
  } catch (err) {
    console.error('[AdminController] deleteCourse error:', err.message);
    return res.status(500).json({ message: 'Ошибка удаления курса' });
  }
}

async function uploadAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }
    const { lessonId } = req.params;
    const backendRoot = path.join(__dirname, '..');
    const relativePath = path.relative(backendRoot, req.file.path).replace(/\\/g, '/');
    const attId = uuidv4();
    db.run(
      `INSERT INTO course_lesson_attachments (id, lesson_id, file_path, original_name, mime_type, order_index) VALUES (?, ?, ?, ?, ?, 0)`,
      [attId, lessonId, relativePath, req.file.originalname || req.file.filename || 'file', req.file.mimetype || ''],
      (err) => {
        if (err) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
          return res.status(500).json({ message: 'Ошибка сохранения вложения' });
        }
        const url = '/' + relativePath;
        return res.status(201).json({ id: attId, url, original_name: req.file.originalname || req.file.filename });
      }
    );
  } catch (err) {
    console.error('[AdminController] uploadAttachment error:', err.message);
    return res.status(500).json({ message: 'Ошибка загрузки файла' });
  }
}

async function deleteAttachment(req, res) {
  try {
    const { id } = req.params;
    db.get('SELECT id, lesson_id, file_path FROM course_lesson_attachments WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ message: 'Ошибка сервера' });
      if (!row) return res.status(404).json({ message: 'Вложение не найдено' });
      const fullPath = path.join(__dirname, '..', row.file_path);
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (_) {}
      db.run('DELETE FROM course_lesson_attachments WHERE id = ?', [id], function (err2) {
        if (err2) return res.status(500).json({ message: 'Ошибка удаления' });
        return res.status(204).send();
      });
    });
  } catch (err) {
    console.error('[AdminController] deleteAttachment error:', err.message);
    return res.status(500).json({ message: 'Ошибка удаления вложения' });
  }
}

// ===== USERS =====

const { getAllUsers, updateUserRole, deleteUser } = require('../models/userModel');

async function getUsers(req, res) {
  try {
    const users = await getAllUsers();
    return res.json(users);
  } catch (err) {
    console.error('[AdminController] getUsers error:', err.message);
    return res.status(500).json({ message: 'Ошибка получения пользователей' });
  }
}

async function updateUserRoleController(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body || {};

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'role должен быть user или admin' });
    }

    await updateUserRole(id, role);
    return res.status(200).json({ message: 'Роль пользователя обновлена' });
  } catch (err) {
    console.error('[AdminController] updateUserRole error:', err.message);
    return res.status(500).json({ message: 'Ошибка обновления роли пользователя' });
  }
}

async function deleteUserController(req, res) {
  try {
    const { id } = req.params;

    await deleteUser(id);
    return res.status(204).send();
  } catch (err) {
    console.error('[AdminController] deleteUser error:', err.message);
    return res.status(500).json({ message: 'Ошибка удаления пользователя' });
  }
}

module.exports = {
  getStats,
  // Tasks
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  importTasks,
  generateTasksAI,
  // Prompts
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  importPrompts,
  // Courses
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadAttachment,
  deleteAttachment,
  // Users
  getUsers,
  updateUserRole: updateUserRoleController,
  deleteUser: deleteUserController
};

