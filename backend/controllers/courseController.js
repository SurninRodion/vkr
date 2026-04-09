const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');
const { analyzePrompt } = require('../utils/aiAnalyzer');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>${String(template_css || '')}</style>
  </head>
  <body>
    ${htmlBody}
  </body>
</html>`;
}

function maybeIssueCertificateForCourse(userId, courseId, done) {
  db.get(
    `
      SELECT
        (SELECT COUNT(*) FROM course_lessons WHERE course_id = ?) AS totalLessons,
        (
          SELECT COUNT(*)
          FROM course_lesson_progress p
          JOIN course_lessons cl ON cl.id = p.lesson_id
          WHERE p.user_id = ? AND cl.course_id = ?
        ) AS completedLessons
    `,
    [courseId, userId, courseId],
    (err, row) => {
      if (err) return done(err);
      const totalLessons = Number(row?.totalLessons || 0);
      const completedLessons = Number(row?.completedLessons || 0);
      if (!totalLessons || completedLessons < totalLessons) return done(null, { issued: false });

      db.get(
        'SELECT id FROM course_certificates WHERE user_id = ? AND course_id = ?',
        [userId, courseId],
        (err2, existing) => {
          if (err2) return done(err2);
          if (existing?.id) return done(null, { issued: false, certificateId: existing.id });

          db.get('SELECT id, name FROM users WHERE id = ?', [userId], (errU, user) => {
            if (errU) return done(errU);
            db.get('SELECT id, title FROM courses WHERE id = ?', [courseId], (errC, course) => {
              if (errC) return done(errC);
              if (!course) return done(null, { issued: false });

              db.get(
                'SELECT course_id, enabled, title, template_html, template_css FROM course_certificate_templates WHERE course_id = ?',
                [courseId],
                (errT, tpl) => {
                  if (errT) return done(errT);

                  const ensureTpl = (cb) => {
                    if (tpl) return cb(null, tpl);
                    const def = defaultCertificateTemplate(course.title);
                    db.run(
                      `INSERT OR REPLACE INTO course_certificate_templates (course_id, enabled, title, template_html, template_css, updated_at)
                       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                      [courseId, def.enabled, def.title, def.template_html, def.template_css],
                      (insErr) => {
                        if (insErr) return cb(insErr);
                        return cb(null, { course_id: courseId, ...def });
                      }
                    );
                  };

                  ensureTpl((errEns, finalTpl) => {
                    if (errEns) return done(errEns);
                    const enabled = Number(finalTpl?.enabled ?? 1);
                    if (!enabled) return done(null, { issued: false });

                    const certificateId = uuidv4();
                    const serial = `${String(courseId).slice(0, 8).toUpperCase()}-${Date.now()
                      .toString(36)
                      .toUpperCase()}`;
                    const issuedDate = new Date().toLocaleDateString('ru-RU');
                    const meta = {
                      user_name: user?.name || 'Пользователь',
                      course_title: course.title || 'Курс',
                      issued_date: issuedDate,
                      serial,
                    };
                    const rendered = renderCertificateHtml(finalTpl, meta);
                    db.run(
                      `INSERT INTO course_certificates (id, user_id, course_id, serial, issued_at, rendered_html, meta_json)
                       VALUES (?, ?, ?, ?, datetime('now'), ?, ?)`,
                      [certificateId, userId, courseId, serial, rendered, JSON.stringify(meta)],
                      (errIns) => {
                        if (errIns) return done(errIns);
                        return done(null, { issued: true, certificateId });
                      }
                    );
                  });
                }
              );
            });
          });
        }
      );
    }
  );
}

function buildPracticalPromptForAi(payload, userText) {
  const title = (payload.title || 'Практическое задание').trim();
  const desc = (payload.description || '').trim();
  const lines = ['Задание курса:', `Название: ${title}`];
  if (desc) lines.push(`Описание задания:\n${desc}`);
  lines.push('', 'Ответ пользователя:', String(userText).trim());
  return lines.join('\n');
}

/**
 * Публичный список курсов (без уроков: id, title, description, lessonsCount, modulesCount).
 */
function listCourses(req, res) {
  db.all(
    `
      SELECT c.id, c.title, c.description,
             (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) AS lessonsCount,
             (
               CASE
                 WHEN (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) > 0
                 THEN (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id)
                 WHEN (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) > 0
                 THEN 1
                 ELSE 0
               END
             ) AS modulesCount
      FROM courses c
      ORDER BY c.rowid DESC
    `,
    [],
    (err, courses) => {
      if (err) {
        console.error('[CourseController] listCourses error:', err.message);
        return res.status(500).json({ message: 'Ошибка получения списка курсов' });
      }
      const rows = courses || [];
      // sqlite3 отдаёт алиасы иногда в нижнем регистре — приводим к стабильному JSON для клиента
      res.json(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          lessonsCount: Number(row.lessonsCount ?? row.lessonscount ?? 0),
          modulesCount: Number(row.modulesCount ?? row.modulescount ?? 0),
        }))
      );
    }
  );
}

/**
 * Один курс по id с модулями, уроками, шагами, вложениями и тестами (без правильных ответов).
 */
function getCourse(req, res) {
  const { id } = req.params;
      db.get(
        'SELECT id, title, description FROM courses WHERE id = ?',
    [id],
    (err, course) => {
      if (err) {
        console.error('[CourseController] getCourse error:', err.message);
        return res.status(500).json({ message: 'Ошибка получения курса' });
      }
      if (!course) {
        return res.status(404).json({ message: 'Курс не найден' });
      }
      db.all(
        `SELECT id, course_id, module_id, title, content, order_index, quiz_required FROM course_lessons WHERE course_id = ? ORDER BY order_index ASC`,
        [id],
        (err2, lessons) => {
          if (err2) {
            console.error('[CourseController] getCourse lessons error:', err2.message);
            return res.status(500).json({ message: 'Ошибка получения уроков' });
          }
          const lessonList = lessons || [];
          const lessonIds = lessonList.map((l) => l.id);

          if (!lessonList.length) {
            return res.json({ ...course, lessons: [], modules: [] });
          }

          const placeholders = lessonIds.map(() => '?').join(',');
          db.all(
            `SELECT id, lesson_id, step_type, order_index, payload FROM course_lesson_steps WHERE lesson_id IN (${placeholders}) ORDER BY lesson_id, order_index ASC`,
            lessonIds,
            (errSteps, stepRows) => {
              if (errSteps) return res.status(500).json({ message: 'Ошибка загрузки курса' });
              const stepsByLesson = {};
              (stepRows || []).forEach((r) => {
                if (!stepsByLesson[r.lesson_id]) stepsByLesson[r.lesson_id] = [];
                let payload = {};
                try {
                  payload = r.payload ? JSON.parse(r.payload) : {};
                } catch (_) {}
                if (r.step_type === 'test' && typeof payload.correct_index !== 'undefined') {
                  const { correct_index, ...rest } = payload;
                  payload = rest;
                }
                stepsByLesson[r.lesson_id].push({
                  id: r.id,
                  step_type: r.step_type,
                  order_index: r.order_index,
                  payload
                });
              });

              db.all(
                `SELECT id, lesson_id, file_path, original_name, mime_type, order_index FROM course_lesson_attachments WHERE lesson_id IN (${placeholders}) ORDER BY lesson_id, order_index`,
                lessonIds,
                (err3, attRows) => {
                  if (err3) return res.status(500).json({ message: 'Ошибка загрузки курса' });
                  const attByLesson = {};
                  (attRows || []).forEach((a) => {
                    if (!attByLesson[a.lesson_id]) attByLesson[a.lesson_id] = [];
                    attByLesson[a.lesson_id].push({
                      id: a.id,
                      url: '/' + a.file_path.replace(/\\/g, '/'),
                      original_name: a.original_name,
                      mime_type: a.mime_type
                    });
                  });
                  db.all(
                    `SELECT id, lesson_id, question_text, options, order_index FROM course_quiz_questions WHERE lesson_id IN (${placeholders}) ORDER BY lesson_id, order_index`,
                    lessonIds,
                    (err4, quizRows) => {
                      if (err4) return res.status(500).json({ message: 'Ошибка загрузки курса' });
                      const quizByLesson = {};
                      (quizRows || []).forEach((q) => {
                        if (!quizByLesson[q.lesson_id]) quizByLesson[q.lesson_id] = [];
                        let opts = [];
                        try {
                          opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options || [];
                        } catch (_) {}
                        quizByLesson[q.lesson_id].push({
                          id: q.id,
                          question_text: q.question_text,
                          options: opts
                        });
                      });
                      const lessonsWithExtra = lessonList.map((l) => ({
                        ...l,
                        quiz_required: typeof l.quiz_required === 'number' ? l.quiz_required : Number(l.quiz_required ?? 1),
                        attachments: attByLesson[l.id] || [],
                        quiz: quizByLesson[l.id] || [],
                        steps: (stepsByLesson[l.id] || []).sort((a, b) => a.order_index - b.order_index)
                      }));

                      db.all(
                        `SELECT id, course_id, title, order_index FROM course_modules WHERE course_id = ? ORDER BY order_index ASC`,
                        [id],
                        (errMod, modulesRows) => {
                          if (errMod) {
                            return res.json({ ...course, lessons: lessonsWithExtra, modules: [] });
                          }
                          const modules = (modulesRows || []).map((m) => ({
                            ...m,
                            lessons: lessonsWithExtra.filter((l) => l.module_id === m.id)
                          }));
                          res.json({ ...course, lessons: lessonsWithExtra, modules });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

/**
 * Записаться на курс (только авторизованный пользователь).
 */
function enroll(req, res) {
  const userId = req.user.id;
  const { id: courseId } = req.params;

  db.get('SELECT id FROM courses WHERE id = ?', [courseId], (err, course) => {
    if (err) {
      console.error('[CourseController] enroll check course error:', err.message);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
    if (!course) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    db.get(
      'SELECT id FROM course_enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId],
      (err2, existing) => {
        if (err2) {
          console.error('[CourseController] enroll check existing error:', err2.message);
          return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (existing) {
          return res.status(400).json({ message: 'Вы уже записаны на этот курс' });
        }

        const enrollmentId = uuidv4();
        db.run(
          'INSERT INTO course_enrollments (id, user_id, course_id) VALUES (?, ?, ?)',
          [enrollmentId, userId, courseId],
          (err3) => {
            if (err3) {
              console.error('[CourseController] enroll insert error:', err3.message);
              return res.status(500).json({ message: 'Ошибка записи на курс' });
            }
            res.status(201).json({ message: 'Вы записаны на курс', courseId });
          }
        );
      }
    );
  });
}

/**
 * Отметить урок как пройденный (только если у урока нет теста; иначе — пройти тест).
 */
function completeLesson(req, res) {
  const userId = req.user.id;
  const { courseId, lessonId } = req.params;

  db.get(
    'SELECT id, quiz_required FROM course_lessons WHERE id = ? AND course_id = ?',
    [lessonId, courseId],
    (err, lesson) => {
      if (err) {
        console.error('[CourseController] completeLesson check lesson error:', err.message);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }
      if (!lesson) {
        return res.status(404).json({ message: 'Урок не найден' });
      }

      db.get(
        'SELECT id FROM course_quiz_questions WHERE lesson_id = ? LIMIT 1',
        [lessonId],
        (errQ, hasQuiz) => {
          if (errQ) return res.status(500).json({ message: 'Ошибка сервера' });
          const required = Number(lesson.quiz_required ?? 1) === 1;
          if (hasQuiz && required) {
            return res.status(400).json({
              message: 'У этого урока есть закрепляющий тест. Пройдите тест, чтобы завершить урок.'
            });
          }

          db.run(
            `INSERT OR IGNORE INTO course_lesson_progress (user_id, lesson_id) VALUES (?, ?)`,
            [userId, lessonId],
            function (err2) {
              if (err2) {
                console.error('[CourseController] completeLesson insert error:', err2.message);
                return res.status(500).json({ message: 'Ошибка сохранения прогресса' });
              }
              maybeIssueCertificateForCourse(userId, courseId, () => {
                res.json({ message: 'Урок отмечен как пройденный', lessonId });
              });
            }
          );
        }
      );
    }
  );
}

const QUIZ_PASS_THRESHOLD = 0.8;

/**
 * Отправить ответы на тест урока. При успешном прохождении урок помечается пройденным.
 */
function submitQuiz(req, res) {
  const userId = req.user.id;
  const { courseId, lessonId } = req.params;
  const { answers } = req.body || {};

  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: 'Передайте массив ответов answers' });
  }

  db.get(
    'SELECT id, quiz_required FROM course_lessons WHERE id = ? AND course_id = ?',
    [lessonId, courseId],
    (err, lesson) => {
      if (err) return res.status(500).json({ message: 'Ошибка сервера' });
      if (!lesson) return res.status(404).json({ message: 'Урок не найден' });

      db.all(
        'SELECT id, correct_index FROM course_quiz_questions WHERE lesson_id = ? ORDER BY order_index ASC',
        [lessonId],
        (err2, questions) => {
          if (err2) return res.status(500).json({ message: 'Ошибка сервера' });
          if (!questions || !questions.length) {
            return res.status(400).json({ message: 'У этого урока нет теста' });
          }
          let correct = 0;
          const details = questions.map((q, i) => {
            const raw = answers[i];
            const userAnswer = typeof raw === 'number' ? raw : parseInt(raw, 10);
            const normalizedUserAnswer = Number.isFinite(userAnswer) ? userAnswer : -1;
            const correctIndex = typeof q.correct_index === 'number' ? q.correct_index : parseInt(q.correct_index, 10) || 0;
            const isCorrect = normalizedUserAnswer === correctIndex;
            if (isCorrect) correct++;
            return {
              questionId: q.id,
              userAnswer: normalizedUserAnswer,
              correctIndex,
              correct: isCorrect,
            };
          });
          const total = questions.length;
          const score = total > 0 ? correct / total : 0;
          const passed = score >= QUIZ_PASS_THRESHOLD;
          const required = Number(lesson.quiz_required ?? 1) === 1;

          if (!passed) {
            return res.json({
              passed: false,
              score: Math.round(score * 100),
              total,
              details,
              message: `Порог прохождения ${Math.round(QUIZ_PASS_THRESHOLD * 100)}%. Попробуйте ещё раз.`
            });
          }

          if (!required) {
            return res.json({
              passed: true,
              score: Math.round(score * 100),
              total,
              details,
              message: 'Тест пройден.'
            });
          }

          db.run(
            `INSERT OR IGNORE INTO course_lesson_progress (user_id, lesson_id) VALUES (?, ?)`,
            [userId, lessonId],
            function (err3) {
              if (err3) return res.status(500).json({ message: 'Ошибка сохранения прогресса' });
              maybeIssueCertificateForCourse(userId, courseId, () => {
                res.json({
                  passed: true,
                  score: Math.round(score * 100),
                  total,
                  details,
                  message: 'Тест пройден. Урок завершён.'
                });
              });
            }
          );
        }
      );
    }
  );
}

/**
 * Список курсов пользователя с прогрессом (для профиля).
 * Возвращает: { enrollments: [ { courseId, title, description, totalLessons, completedLessons, progressPercent }, ... ] }
 */
function getMyCourses(req, res) {
  const userId = req.user.id;

  db.all(
    `
      SELECT e.course_id AS courseId, c.title, c.description
      FROM course_enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ?
      ORDER BY e.enrolled_at DESC
    `,
    [userId],
    (err, enrollments) => {
      if (err) {
        console.error('[CourseController] getMyCourses error:', err.message);
        return res.status(500).json({ message: 'Ошибка получения курсов' });
      }
      if (!enrollments || !enrollments.length) {
        return res.json({ enrollments: [] });
      }

      const courseIds = enrollments.map((e) => e.courseId);
      const placeholders = courseIds.map(() => '?').join(',');

      db.all(
        `SELECT course_id, COUNT(*) AS total FROM course_lessons WHERE course_id IN (${placeholders}) GROUP BY course_id`,
        courseIds,
        (err2, totalRows) => {
          if (err2) {
            console.error('[CourseController] getMyCourses total error:', err2.message);
            return res.status(500).json({ message: 'Ошибка получения курсов' });
          }
          const totalByCourse = {};
          (totalRows || []).forEach((r) => {
            totalByCourse[r.course_id] = r.total;
          });

          db.all(
            `
              SELECT cl.course_id, COUNT(*) AS completed
              FROM course_lesson_progress p
              JOIN course_lessons cl ON cl.id = p.lesson_id
              WHERE p.user_id = ? AND cl.course_id IN (${placeholders})
              GROUP BY cl.course_id
            `,
            [userId, ...courseIds],
            (err3, completedRows) => {
              if (err3) {
                console.error('[CourseController] getMyCourses completed error:', err3.message);
                return res.status(500).json({ message: 'Ошибка получения прогресса' });
              }
              const completedByCourse = {};
              (completedRows || []).forEach((r) => {
                completedByCourse[r.course_id] = r.completed;
              });

              const result = enrollments.map((e) => {
                const totalLessons = totalByCourse[e.courseId] || 0;
                const completedLessons = completedByCourse[e.courseId] || 0;
                const progressPercent =
                  totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                return {
                  courseId: e.courseId,
                  title: e.title,
                  description: e.description,
                  totalLessons,
                  completedLessons,
                  progressPercent
                };
              });

              res.json({ enrollments: result });
            }
          );
        }
      );
    }
  );
}

/**
 * Прогресс по одному курсу для текущего пользователя (уроки с флагом completed).
 */
function getCourseProgress(req, res) {
  const userId = req.user.id;
  const { id: courseId } = req.params;

  db.get(
    'SELECT id FROM course_enrollments WHERE user_id = ? AND course_id = ?',
    [userId, courseId],
    (err, enrollment) => {
      if (err) {
        console.error('[CourseController] getCourseProgress error:', err.message);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }
      if (!enrollment) {
        return res.json({
          enrolled: false,
          completedLessonIds: [],
          totalLessons: 0,
          practicalSubmissions: [],
        });
      }

      db.all(
        'SELECT id FROM course_lessons WHERE course_id = ? ORDER BY order_index ASC',
        [courseId],
        (err2, lessons) => {
          if (err2) {
            console.error('[CourseController] getCourseProgress lessons error:', err2.message);
            return res.status(500).json({ message: 'Ошибка сервера' });
          }
          const lessonIds = (lessons || []).map((l) => l.id);
          if (!lessonIds.length) {
            return res.json({
              enrolled: true,
              completedLessonIds: [],
              totalLessons: 0,
              practicalSubmissions: [],
            });
          }

          const placeholders = lessonIds.map(() => '?').join(',');
          db.all(
            `SELECT lesson_id FROM course_lesson_progress WHERE user_id = ? AND lesson_id IN (${placeholders})`,
            [userId, ...lessonIds],
            (err3, rows) => {
              if (err3) {
                console.error('[CourseController] getCourseProgress completed error:', err3.message);
                return res.status(500).json({ message: 'Ошибка сервера' });
              }
              const completedLessonIds = (rows || []).map((r) => r.lesson_id);

              db.all(
                `SELECT lesson_id, step_id, submission_text, ai_feedback, score, updated_at
                 FROM course_practical_submissions WHERE user_id = ? AND course_id = ?`,
                [userId, courseId],
                (err4, subRows) => {
                  if (err4) {
                    console.error('[CourseController] getCourseProgress practical error:', err4.message);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                  }
                  const practicalSubmissions = (subRows || []).map((r) => {
                    let analysis = null;
                    const raw = r.ai_feedback ?? r.AI_FEEDBACK;
                    if (raw) {
                      try {
                        analysis = JSON.parse(raw);
                      } catch {
                        analysis = { aiResponse: String(raw) };
                      }
                    }
                    return {
                      lessonId: r.lesson_id ?? r.lessonid,
                      stepId: r.step_id ?? r.stepid,
                      submissionText: r.submission_text ?? r.submissiontext,
                      analysis,
                      score: r.score,
                      updatedAt: r.updated_at ?? r.updatedat,
                    };
                  });

                  res.json({
                    enrolled: true,
                    completedLessonIds,
                    totalLessons: lessonIds.length,
                    practicalSubmissions,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
}

/**
 * Сертификаты текущего пользователя (для профиля).
 */
function getMyCertificates(req, res) {
  const userId = req.user.id;
  db.all(
    `
      SELECT cc.id, cc.course_id AS courseId, cc.serial, cc.issued_at AS issuedAt, c.title AS courseTitle
      FROM course_certificates cc
      JOIN courses c ON c.id = cc.course_id
      WHERE cc.user_id = ?
      ORDER BY cc.issued_at DESC
    `,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('[CourseController] getMyCertificates error:', err.message);
        return res.status(500).json({ message: 'Ошибка получения сертификатов' });
      }
      const list = (rows || []).map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        serial: r.serial,
        issuedAt: r.issuedAt,
      }));
      res.json({ certificates: list });
    }
  );
}

/**
 * HTML сертификата по id (только владелец).
 */
function getMyCertificateHtml(req, res) {
  const userId = req.user.id;
  const { id } = req.params;
  db.get(
    `SELECT id, rendered_html FROM course_certificates WHERE id = ? AND user_id = ?`,
    [id, userId],
    (err, row) => {
      if (err) return res.status(500).json({ message: 'Ошибка получения сертификата' });
      if (!row) return res.status(404).json({ message: 'Сертификат не найден' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(row.rendered_html);
    }
  );
}

/**
 * PDF сертификата по id (только владелец).
 * Генерируется на сервере (Chromium/Playwright), чтобы гарантировать корректный результат.
 */
function getMyCertificatePdf(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  db.get(
    `SELECT id, rendered_html, serial FROM course_certificates WHERE id = ? AND user_id = ?`,
    [id, userId],
    async (err, row) => {
      if (err) return res.status(500).json({ message: 'Ошибка получения сертификата' });
      if (!row) return res.status(404).json({ message: 'Сертификат не найден' });

      let chromium;
      try {
        chromium = require('playwright').chromium;
      } catch (e) {
        return res.status(500).json({
          message:
            'PDF генератор не установлен. Установите зависимости бэкенда и браузеры Playwright (npm i && npx playwright install).',
        });
      }

      let browser;
      try {
        browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1123, height: 794 } }); // A4 landscape @96dpi approx
        await page.setContent(String(row.rendered_html || ''), { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          try {
            // eslint-disable-next-line no-undef
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
          } catch (_) {}
        });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
          preferCSSPageSize: true,
        });

        const safeSerial = String(row.serial || 'certificate').replace(/[\\/:*?"<>|]+/g, '-');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="certificate-${safeSerial}.pdf"`);
        return res.status(200).send(pdfBuffer);
      } catch (e) {
        console.error('[CourseController] getMyCertificatePdf error:', e.message);
        return res.status(500).json({ message: 'Ошибка генерации PDF' });
      } finally {
        try {
          if (browser) await browser.close();
        } catch (_) {}
      }
    }
  );
}

/**
 * Отправка ответа на практический шаг: проверка через GigaChat (как в разделе «Практика»), сохранение текста и фидбека.
 */
function submitPracticalStep(req, res) {
  const userId = req.user.id;
  const { courseId, lessonId, stepId } = req.params;
  const { text } = req.body || {};
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return res.status(400).json({ message: 'Передайте текст ответа (поле text)' });
  }

  db.get(
    'SELECT id FROM course_enrollments WHERE user_id = ? AND course_id = ?',
    [userId, courseId],
    (err, enrollment) => {
      if (err) {
        console.error('[CourseController] submitPractical enroll:', err.message);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }
      if (!enrollment) {
        return res.status(403).json({ message: 'Запишитесь на курс, чтобы отправлять ответы.' });
      }

      db.get(
        'SELECT id FROM course_lessons WHERE id = ? AND course_id = ?',
        [lessonId, courseId],
        (err2, lesson) => {
          if (err2) return res.status(500).json({ message: 'Ошибка сервера' });
          if (!lesson) return res.status(404).json({ message: 'Урок не найден' });

          db.get(
            'SELECT id, step_type, payload FROM course_lesson_steps WHERE id = ? AND lesson_id = ?',
            [stepId, lessonId],
            async (err3, step) => {
              if (err3) return res.status(500).json({ message: 'Ошибка сервера' });
              if (!step) return res.status(404).json({ message: 'Шаг не найден' });
              if (step.step_type !== 'practical') {
                return res.status(400).json({ message: 'Этот шаг не является практическим заданием' });
              }
              let payload = {};
              try {
                payload = step.payload ? JSON.parse(step.payload) : {};
              } catch (_) {}

              const promptForAi = buildPracticalPromptForAi(payload, trimmed);
              try {
                const analysis = await analyzePrompt(promptForAi);
                if (!analysis || typeof analysis.effectiveness !== 'number') {
                  return res.status(503).json({
                    message:
                      'Проверка выполняется только через GigaChat. Проверьте GIGACHAT_CREDENTIALS или повторите позже.',
                  });
                }
                const score = Math.max(0, Math.min(10, Math.round(analysis.effectiveness)));
                const feedbackJson = JSON.stringify(analysis);

                db.get(
                  'SELECT id FROM course_practical_submissions WHERE user_id = ? AND course_id = ? AND lesson_id = ? AND step_id = ?',
                  [userId, courseId, lessonId, stepId],
                  (err4, existing) => {
                    if (err4) {
                      console.error('[CourseController] submitPractical select:', err4.message);
                      return res.status(500).json({ message: 'Ошибка сохранения' });
                    }
                    const rowId = existing && existing.id ? existing.id : uuidv4();
                    db.run(
                      `INSERT OR REPLACE INTO course_practical_submissions (id, user_id, course_id, lesson_id, step_id, submission_text, ai_feedback, score, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                      [rowId, userId, courseId, lessonId, stepId, trimmed, feedbackJson, score],
                      (err5) => {
                        if (err5) {
                          console.error('[CourseController] submitPractical insert:', err5.message);
                          return res.status(500).json({ message: 'Ошибка сохранения' });
                        }
                        res.status(201).json({
                          message: 'Ответ сохранён и проверен',
                          submissionText: trimmed,
                          analysis,
                          score,
                        });
                      }
                    );
                  }
                );
              } catch (e) {
                console.error('[CourseController] submitPractical AI:', e.message);
                return res.status(500).json({ message: 'Ошибка проверки ответа' });
              }
            }
          );
        }
      );
    }
  );
}

/**
 * Проверка ответа на шаг типа "тест" (только авторизованный пользователь).
 */
function checkStepAnswer(req, res) {
  const { courseId, lessonId, stepId } = req.params;
  const { answer } = req.body || {};
  const answerIndex = typeof answer === 'number' ? answer : parseInt(answer, 10);
  if (Number.isNaN(answerIndex) || answerIndex < 0) {
    return res.status(400).json({ message: 'Передайте ответ answer (индекс варианта)' });
  }

  db.get(
    'SELECT id FROM course_lessons WHERE id = ? AND course_id = ?',
    [lessonId, courseId],
    (err, lesson) => {
      if (err) return res.status(500).json({ message: 'Ошибка сервера' });
      if (!lesson) return res.status(404).json({ message: 'Урок не найден' });

      db.get(
        'SELECT id, step_type, payload FROM course_lesson_steps WHERE id = ? AND lesson_id = ?',
        [stepId, lessonId],
        (err2, step) => {
          if (err2) return res.status(500).json({ message: 'Ошибка сервера' });
          if (!step) return res.status(404).json({ message: 'Шаг не найден' });
          if (step.step_type !== 'test') {
            return res.status(400).json({ message: 'Этот шаг не является тестом' });
          }
          let payload = {};
          try {
            payload = step.payload ? JSON.parse(step.payload) : {};
          } catch (_) {}
          const correctIndex = typeof payload.correct_index === 'number' ? payload.correct_index : 0;
          const correct = answerIndex === correctIndex;
          res.json({ correct });
        }
      );
    }
  );
}

module.exports = {
  listCourses,
  getCourse,
  enroll,
  completeLesson,
  submitQuiz,
  getMyCourses,
  getCourseProgress,
  checkStepAnswer,
  submitPracticalStep,
  getMyCertificates,
  getMyCertificateHtml,
  getMyCertificatePdf,
};
