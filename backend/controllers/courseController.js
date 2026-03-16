const { v4: uuidv4 } = require('uuid');
const db = require('../db/db');

/**
 * Публичный список курсов (без уроков, только id, title, description, lessonsCount).
 */
function listCourses(req, res) {
  db.all(
    `
      SELECT c.id, c.title, c.description,
             (SELECT COUNT(*) FROM course_lessons WHERE course_id = c.id) AS lessonsCount
      FROM courses c
      ORDER BY c.rowid DESC
    `,
    [],
    (err, courses) => {
      if (err) {
        console.error('[CourseController] listCourses error:', err.message);
        return res.status(500).json({ message: 'Ошибка получения списка курсов' });
      }
      res.json(courses || []);
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
        `SELECT id, course_id, module_id, title, content, order_index FROM course_lessons WHERE course_id = ? ORDER BY order_index ASC`,
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
    'SELECT id FROM course_lessons WHERE id = ? AND course_id = ?',
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
          if (hasQuiz) {
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
              res.json({ message: 'Урок отмечен как пройденный', lessonId });
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
    'SELECT id FROM course_lessons WHERE id = ? AND course_id = ?',
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
          questions.forEach((q, i) => {
            const userAnswer = typeof answers[i] === 'number' ? answers[i] : parseInt(answers[i], 10);
            if (userAnswer === q.correct_index) correct++;
          });
          const total = questions.length;
          const score = total > 0 ? correct / total : 0;
          const passed = score >= QUIZ_PASS_THRESHOLD;

          if (!passed) {
            return res.json({
              passed: false,
              score: Math.round(score * 100),
              total,
              message: `Порог прохождения ${Math.round(QUIZ_PASS_THRESHOLD * 100)}%. Попробуйте ещё раз.`
            });
          }

          db.run(
            `INSERT OR IGNORE INTO course_lesson_progress (user_id, lesson_id) VALUES (?, ?)`,
            [userId, lessonId],
            function (err3) {
              if (err3) return res.status(500).json({ message: 'Ошибка сохранения прогресса' });
              res.json({
                passed: true,
                score: Math.round(score * 100),
                total,
                message: 'Тест пройден. Урок завершён.'
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
        return res.json({ enrolled: false, completedLessonIds: [], totalLessons: 0 });
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
              totalLessons: 0
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
              res.json({
                enrolled: true,
                completedLessonIds,
                totalLessons: lessonIds.length
              });
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
  checkStepAnswer
};
