const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../db/db');
const { analyzePrompt } = require('../utils/aiAnalyzer');
const { UPLOADS_BASE } = require('../middleware/uploadMiddleware');

function defaultCertificateTemplate(courseTitle) {
  return {
    enabled: 1,
    title: `Сертификат: ${courseTitle || 'Курс'}`,
    template_css: `
      @page { size: A4 landscape; margin: 0; }
      :root { --ink:#0b1220; --muted:#334155; --accent:#1d4ed8; --accent2:#7c3aed; --paper:#ffffff; --stamp:#0f3b8f; }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body { margin:0; background: #fff; font-family: Inter, Arial, sans-serif; color: var(--ink); }

      .page {
        width: 297mm;
        height: 210mm;
        margin: 0;
        background: var(--paper);
        position: relative;
        overflow: hidden;
      }

      .bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(1200px 520px at 10% 0%, rgba(29,78,216,.12), transparent 60%),
          radial-gradient(900px 520px at 92% 8%, rgba(124,58,237,.10), transparent 60%),
          radial-gradient(900px 520px at 84% 96%, rgba(29,78,216,.06), transparent 55%);
        pointer-events: none;
      }

      /* Без “карточной” рамки и скруглений: лист выглядит корректно при печати */
      .paper {
        position: absolute;
        inset: 0;
      }

      .content {
        position: relative;
        height: 100%;
        padding: 18mm 20mm;
        display: flex;
        flex-direction: column;
      }

      .top {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap: 18mm;
      }

      .brand {
        font-weight: 800;
        letter-spacing: .4px;
        font-size: 18px;
      }
      .brand .a { color: var(--accent); }
      .brand .b { color: var(--accent2); }

      .meta {
        text-align:right;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }
      .meta strong { color: var(--ink); font-weight: 700; }

      .hero {
        margin-top: 14mm;
      }
      .title {
        font-size: 44px;
        font-weight: 800;
        letter-spacing: .2px;
        margin: 0;
      }
      .subtitle {
        margin: 4mm 0 0;
        font-size: 16px;
        color: var(--muted);
      }

      .name {
        margin-top: 14mm;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: .2px;
      }
      .course {
        margin-top: 3mm;
        font-size: 20px;
        color: var(--ink);
      }

      .line {
        margin-top: 8mm;
        height: 1px;
        background: linear-gradient(90deg, rgba(37,99,235,.0), rgba(37,99,235,.35), rgba(124,58,237,.25), rgba(124,58,237,0));
      }

      .footer {
        margin-top: auto;
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap: 12mm;
        padding-top: 10mm;
      }

      .sig {
        font-size: 12px;
        color: var(--muted);
      }
      .sig strong {
        display:block;
        color: var(--ink);
        font-size: 13px;
        margin-bottom: 3mm;
      }

      /* Печать сервиса (SVG, без наложений, как настоящая) */
      .stamp {
        width: 42mm;
        height: 42mm;
        opacity: .92;
      }
      .stamp svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .stamp .stroke { stroke: rgba(15,59,143,.72); }
      .stamp .stroke2 { stroke: rgba(15,59,143,.35); }
      .stamp .fillSoft { fill: rgba(15,59,143,.06); }
      .stamp .textRing { fill: rgba(15,59,143,.86); font-weight: 700; letter-spacing: .22em; }
      .stamp .textCenter { fill: rgba(15,59,143,.92); font-weight: 800; letter-spacing: .10em; }
      .stamp .muted { fill: rgba(15,59,143,.70); font-weight: 700; letter-spacing: .18em; }

      @media print {
        body { background: #fff; }
      }
    `.trim(),
    template_html: `
      <div class="page">
        <div class="bg"></div>
        <div class="paper">
          <div class="content">
            <div class="top">
              <div class="brand">Prompt <span class="a">Academy</span> <span class="b">Certificate</span></div>
              <div class="meta">
                <div>Серийный №: <strong>{{serial}}</strong></div>
                <div>Дата выдачи: <strong>{{issued_date}}</strong></div>
              </div>
            </div>

            <div class="hero">
              <h1 class="title">Сертификат</h1>
              <p class="subtitle">
                Настоящим сертификатом подтверждается, что {{user_name}} успешно завершил обучение по курсу «{{course_title}}».
              </p>
            </div>

            <div class="name">{{user_name}}</div>
            <div class="course">«{{course_title}}»</div>
            <div class="line"></div>

            <div class="footer">
              <div class="sig">
                <strong>Prompt Academy</strong>
                Обучающая платформа по промпт-инжинирингу
              </div>
              <div class="stamp" aria-label="Печать сервиса">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                  <defs>
                    <path id="ringTop" d="M 100,18 A 82,82 0 0 1 182,100" />
                    <path id="ringBottom" d="M 182,100 A 82,82 0 0 1 100,182 A 82,82 0 0 1 18,100" />
                  </defs>

                  <circle cx="100" cy="100" r="92" class="stroke" fill="none" stroke-width="6" />
                  <circle cx="100" cy="100" r="78" class="stroke2" fill="none" stroke-width="3" />
                  <circle cx="100" cy="100" r="62" class="stroke2 fillSoft" stroke-width="2" />

                  <text font-size="10" class="textRing">
                    <textPath href="#ringTop" startOffset="2%">PROMPT ACADEMY</textPath>
                  </text>
                  <text font-size="10" class="textRing">
                    <textPath href="#ringBottom" startOffset="8%">CERTIFIED • COURSE COMPLETION</textPath>
                  </text>

                  <circle cx="100" cy="100" r="42" class="stroke2" fill="none" stroke-width="2" />
                  <text x="100" y="92" text-anchor="middle" font-size="12" class="textCenter">CERTIFICATE</text>
                  <text x="100" y="112" text-anchor="middle" font-size="10" class="muted">PROMPT ACADEMY</text>
                  <text x="100" y="134" text-anchor="middle" font-size="16" class="stroke" fill="none" stroke-width="0">
                    ★ ★ ★
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    `.trim(),
  };
}

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

function saveQuizForLesson(lessonId, questions, done) {
  db.run('DELETE FROM course_quiz_questions WHERE lesson_id = ?', [lessonId], () => {
    if (!Array.isArray(questions) || !questions.length) return done();
    const stmt = db.prepare(
      `INSERT INTO course_quiz_questions (id, lesson_id, question_text, options, correct_index, order_index) VALUES (?, ?, ?, ?, ?, ?)`
    );
    questions.forEach((q, i) => {
      if (!q?.question_text || !Array.isArray(q.options) || q.options.length < 2) return;
      const opts = JSON.stringify(q.options);
      const correct = Math.max(
        0,
        Math.min(Number(q.correct_index ?? 0) || 0, (q.options?.length || 1) - 1)
      );
      stmt.run(uuidv4(), lessonId, String(q.question_text).trim(), opts, correct, i);
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

        // Для каждого нового курса заранее сохраняем дефолтный шаблон сертификата,
        // чтобы затем менялись только переменные (название курса/пользователь/дата/серийный номер).
        try {
          const def = defaultCertificateTemplate(title);
          db.run(
            `INSERT OR REPLACE INTO course_certificate_templates (course_id, enabled, title, template_html, template_css, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [id, def.enabled, def.title, def.template_html, def.template_css]
          );
        } catch (_) {}

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
              `INSERT INTO course_lessons (id, course_id, module_id, title, content, order_index, quiz_required) VALUES (?, ?, ?, ?, ?, ?, ?)`
            );
            let lessonIndex = 0;
            const insertedLessons = [];
            modulesPayload.forEach((mod, mi) => {
              const modId = moduleIds[mi].id;
              (mod.lessons || []).forEach((lesson, li) => {
                if (!lesson.title) return;
                const lessonId = uuidv4();
                const orderIndex = typeof lesson.order_index === 'number' ? lesson.order_index : lessonIndex;
                const quizRequired = lesson.quiz_required === 0 || lesson.quiz_required === false ? 0 : 1;
                lessonStmt.run(lessonId, id, modId, lesson.title, lesson.content || '', orderIndex, quizRequired);
                insertedLessons.push({
                  id: lessonId,
                  title: lesson.title,
                  content: lesson.content || '',
                  order_index: orderIndex,
                  module_id: modId,
                  steps: lesson.steps || [],
                  quiz_questions: lesson.quiz_questions || [],
                  quiz_required: quizRequired,
                });
                lessonIndex++;
              });
            });
            lessonStmt.finalize((errLess) => {
              if (errLess) {
                console.error('[AdminController] Error creating lessons:', errLess.message);
                return res.status(500).json({ message: 'Ошибка создания уроков' });
              }
              let opsDone = 0;
              const total = insertedLessons.length;
              if (total === 0) return res.status(201).json({ id, title, description: description || '', lessons: [], modules: modulesPayload });
              insertedLessons.forEach((l) => {
                saveStepsForLesson(l.id, l.steps, () => {
                  opsDone++;
                  if (opsDone >= total * 2) res.status(201).json({ id, title, description: description || '', lessons: insertedLessons, modules: modulesPayload });
                });
                saveQuizForLesson(l.id, l.quiz_questions || [], () => {
                  opsDone++;
                  if (opsDone >= total * 2) res.status(201).json({ id, title, description: description || '', lessons: insertedLessons, modules: modulesPayload });
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
                db.all('SELECT id, file_path FROM course_lesson_videos WHERE lesson_id = ?', [lessonId], (e2, vids) => {
                  (vids || []).forEach((v) => {
                    try {
                      const fullPath = path.join(__dirname, '..', v.file_path);
                      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                    } catch (_) {}
                  });
                  db.run('DELETE FROM course_lesson_videos WHERE lesson_id = ?', [lessonId]);
                });
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
                    const quizRequired = lesson.quiz_required === 0 || lesson.quiz_required === false ? 0 : 1;
                    db.run(
                      `UPDATE course_lessons SET title = ?, content = ?, order_index = ?, module_id = ?, quiz_required = ? WHERE id = ? AND course_id = ?`,
                      [lesson.title, lesson.content || '', orderIndex, moduleId, quizRequired, lesson.id, courseId],
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
                    const quizRequired2 = lesson.quiz_required === 0 || lesson.quiz_required === false ? 0 : 1;
                    db.run(
                      `INSERT INTO course_lessons (id, course_id, module_id, title, content, order_index, quiz_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                      [newId, courseId, moduleId, lesson.title, lesson.content || '', orderIndex, quizRequired2],
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
                  db.all('SELECT id, file_path FROM course_lesson_videos WHERE lesson_id = ?', [lessonId], (e2, vids) => {
                    (vids || []).forEach((v) => {
                      const fullPath = path.join(__dirname, '..', v.file_path);
                      try {
                        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                      } catch (_) {}
                    });
                    db.run('DELETE FROM course_lesson_videos WHERE lesson_id = ?', [lessonId]);
                  });
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
        db.all('SELECT file_path FROM course_lesson_videos WHERE lesson_id = ?', [lid], (e, vids) => {
          (vids || []).forEach((v) => {
            try {
              const fullPath = path.join(__dirname, '..', v.file_path);
              if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            } catch (_) {}
          });
          db.run('DELETE FROM course_lesson_videos WHERE lesson_id = ?', [lid]);
        });
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

async function uploadLessonVideo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }
    const { lessonId } = req.params;
    const backendRoot = path.join(__dirname, '..');
    const relativePath = path.relative(backendRoot, req.file.path).replace(/\\/g, '/');
    const videoId = uuidv4();
    db.run(
      `INSERT INTO course_lesson_videos (id, lesson_id, file_path, original_name, mime_type) VALUES (?, ?, ?, ?, ?)`,
      [videoId, lessonId, relativePath, req.file.originalname || req.file.filename || 'video', req.file.mimetype || ''],
      (err) => {
        if (err) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
          return res.status(500).json({ message: 'Ошибка сохранения видео' });
        }
        const url = '/' + relativePath;
        return res.status(201).json({
          id: videoId,
          url,
          original_name: req.file.originalname || req.file.filename,
          mime_type: req.file.mimetype || '',
        });
      }
    );
  } catch (err) {
    console.error('[AdminController] uploadLessonVideo error:', err.message);
    return res.status(500).json({ message: 'Ошибка загрузки видео' });
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

// ===== COURSE CERTIFICATE TEMPLATES =====

function getCourseCertificateTemplate(req, res) {
  const { id: courseId } = req.params;
  db.get('SELECT id, title FROM courses WHERE id = ?', [courseId], (errC, course) => {
    if (errC) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!course) return res.status(404).json({ message: 'Курс не найден' });

    db.get(
      'SELECT course_id AS courseId, enabled, title, template_html AS templateHtml, template_css AS templateCss, updated_at AS updatedAt FROM course_certificate_templates WHERE course_id = ?',
      [courseId],
      (err, row) => {
        if (err) return res.status(500).json({ message: 'Ошибка получения шаблона' });
        if (row) return res.json(row);

        const def = defaultCertificateTemplate(course.title);
        db.run(
          `INSERT OR REPLACE INTO course_certificate_templates (course_id, enabled, title, template_html, template_css, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [courseId, def.enabled, def.title, def.template_html, def.template_css],
          (insErr) => {
            if (insErr) return res.status(500).json({ message: 'Ошибка создания шаблона' });
            return res.json({
              courseId,
              enabled: def.enabled,
              title: def.title,
              templateHtml: def.template_html,
              templateCss: def.template_css,
              updatedAt: new Date().toISOString(),
            });
          }
        );
      }
    );
  });
}

function updateCourseCertificateTemplate(req, res) {
  const { id: courseId } = req.params;
  const { enabled, title, templateHtml, templateCss } = req.body || {};
  const enabledInt = enabled ? 1 : 0;
  db.get('SELECT id FROM courses WHERE id = ?', [courseId], (errC, course) => {
    if (errC) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!course) return res.status(404).json({ message: 'Курс не найден' });
    db.run(
      `INSERT OR REPLACE INTO course_certificate_templates (course_id, enabled, title, template_html, template_css, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [
        courseId,
        enabledInt,
        String(title ?? '').trim(),
        String(templateHtml ?? ''),
        String(templateCss ?? ''),
      ],
      (err) => {
        if (err) return res.status(500).json({ message: 'Ошибка сохранения шаблона' });
        return res.status(200).json({ message: 'Шаблон сертификата сохранён' });
      }
    );
  });
}

function resetCourseCertificateTemplate(req, res) {
  const { id: courseId } = req.params;
  db.get('SELECT id, title FROM courses WHERE id = ?', [courseId], (errC, course) => {
    if (errC) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!course) return res.status(404).json({ message: 'Курс не найден' });
    const def = defaultCertificateTemplate(course.title);
    db.run(
      `INSERT OR REPLACE INTO course_certificate_templates (course_id, enabled, title, template_html, template_css, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [courseId, def.enabled, def.title, def.template_html, def.template_css],
      (err) => {
        if (err) return res.status(500).json({ message: 'Ошибка сброса шаблона' });
        return res.status(200).json({ message: 'Шаблон сброшен на значения по умолчанию' });
      }
    );
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderCertificateHtml({ template_html, template_css }, meta) {
  const safe = {
    user_name: escapeHtml(meta.user_name),
    course_title: escapeHtml(meta.course_title),
    issued_date: escapeHtml(meta.issued_date),
    serial: escapeHtml(meta.serial),
  };
  const htmlBody = String(template_html || '')
    .replace(/\{\{\s*user_name\s*\}\}/g, safe.user_name)
    .replace(/\{\{\s*course_title\s*\}\}/g, safe.course_title)
    .replace(/\{\{\s*issued_date\s*\}\}/g, safe.issued_date)
    .replace(/\{\{\s*serial\s*\}\}/g, safe.serial);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safe.course_title} — сертификат</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
    <style>${String(template_css || '')}</style>
  </head>
  <body>
    ${htmlBody}
  </body>
</html>`;
}

function reissueCourseCertificates(req, res) {
  const { id: courseId } = req.params;

  db.get('SELECT id, title FROM courses WHERE id = ?', [courseId], (errC, course) => {
    if (errC) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!course) return res.status(404).json({ message: 'Курс не найден' });

    db.get(
      'SELECT enabled, title, template_html, template_css FROM course_certificate_templates WHERE course_id = ?',
      [courseId],
      (errT, tplRow) => {
        if (errT) return res.status(500).json({ message: 'Ошибка загрузки шаблона' });
        const tpl = tplRow || defaultCertificateTemplate(course.title);

        db.all(
          'SELECT id, user_id, serial, issued_at FROM course_certificates WHERE course_id = ? ORDER BY issued_at DESC',
          [courseId],
          (errList, certs) => {
            if (errList) return res.status(500).json({ message: 'Ошибка загрузки сертификатов' });
            const rows = certs || [];
            if (!rows.length) return res.status(200).json({ message: 'Сертификатов для перевыпуска нет', updated: 0 });

            let updated = 0;
            let failed = 0;
            let processed = 0;

            rows.forEach((cc) => {
              db.get('SELECT name FROM users WHERE id = ?', [cc.user_id], (errU, u) => {
                const issued = cc.issued_at ? new Date(cc.issued_at) : new Date();
                const issuedDate = Number.isNaN(issued.getTime())
                  ? new Date().toLocaleDateString('ru-RU')
                  : issued.toLocaleDateString('ru-RU');
                const meta = {
                  user_name: u?.name || 'Пользователь',
                  course_title: course.title || 'Курс',
                  issued_date: issuedDate,
                  serial: cc.serial || '',
                };
                const rendered = renderCertificateHtml(tpl, meta);
                db.run(
                  'UPDATE course_certificates SET rendered_html = ?, meta_json = ? WHERE id = ?',
                  [rendered, JSON.stringify(meta), cc.id],
                  (errUp) => {
                    if (errUp) failed += 1;
                    else updated += 1;
                    processed += 1;
                    if (processed >= rows.length) {
                      return res.status(200).json({
                        message: 'Перевыпуск завершён',
                        updated,
                        failed,
                      });
                    }
                  }
                );
              });
            });
          }
        );
      }
    );
  });
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

// ===== DEV TOOLS =====

function devResetCourseProgress(req, res) {
  const { id: courseId } = req.params;
  const { email } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!courseId) return res.status(400).json({ message: 'courseId обязателен' });
  if (!normalizedEmail) return res.status(400).json({ message: 'Передайте email пользователя' });

  db.get('SELECT id, email FROM users WHERE lower(email) = ? LIMIT 1', [normalizedEmail], (errU, user) => {
    if (errU) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!user?.id) return res.status(404).json({ message: 'Пользователь не найден' });

    const userId = user.id;
    const result = { deleted: { enrollments: 0, lesson_progress: 0, practical_submissions: 0, certificates: 0 } };

    db.serialize(() => {
      // Прогресс по урокам этого курса
      db.run(
        `
          DELETE FROM course_lesson_progress
          WHERE user_id = ?
            AND lesson_id IN (SELECT id FROM course_lessons WHERE course_id = ?)
        `,
        [userId, courseId],
        function (e1) {
          if (e1) console.error('[AdminController] devReset lesson_progress:', e1.message);
          result.deleted.lesson_progress = this?.changes || 0;
        }
      );

      // Сданные практические шаги
      db.run(
        `DELETE FROM course_practical_submissions WHERE user_id = ? AND course_id = ?`,
        [userId, courseId],
        function (e2) {
          if (e2) console.error('[AdminController] devReset practical_submissions:', e2.message);
          result.deleted.practical_submissions = this?.changes || 0;
        }
      );

      // Сертификаты
      db.run(
        `DELETE FROM course_certificates WHERE user_id = ? AND course_id = ?`,
        [userId, courseId],
        function (e3) {
          if (e3) console.error('[AdminController] devReset certificates:', e3.message);
          result.deleted.certificates = this?.changes || 0;
        }
      );

      // Запись на курс
      db.run(
        `DELETE FROM course_enrollments WHERE user_id = ? AND course_id = ?`,
        [userId, courseId],
        function (e4) {
          if (e4) console.error('[AdminController] devReset enrollments:', e4.message);
          result.deleted.enrollments = this?.changes || 0;

          // Финальный ответ отдаём после последнего шага
          return res.status(200).json({
            message: 'Прогресс по курсу сброшен',
            user: { id: userId, email: user.email },
            courseId,
            ...result,
          });
        }
      );
    });
  });
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
  uploadLessonVideo,
  deleteAttachment,
  getCourseCertificateTemplate,
  updateCourseCertificateTemplate,
  resetCourseCertificateTemplate,
  reissueCourseCertificates,
  // Users
  getUsers,
  updateUserRole: updateUserRoleController,
  deleteUser: deleteUserController,
  // Dev tools
  devResetCourseProgress,
};

