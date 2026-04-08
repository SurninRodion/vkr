const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
  getStats,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  importTasks,
  generateTasksAI,
  getPrompts,
  importPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
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
  getUsers,
  updateUserRole,
  deleteUser
} = require('../controllers/adminController');
const { uploadSingle, uploadVideoSingle } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

// Статистика
router.get('/stats', getStats);

// Задания
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.post('/import/tasks', importTasks);
router.post('/import/prompts', importPrompts);

// Генерация заданий ИИ
router.post('/tasks/generate-ai', generateTasksAI);

// Библиотека промптов
router.get('/prompts', getPrompts);
router.post('/prompts', createPrompt);
router.put('/prompts/:id', updatePrompt);
router.delete('/prompts/:id', deletePrompt);

// Курсы
router.get('/courses', getCourses);
router.post('/courses', createCourse);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.get('/courses/:id/certificate-template', getCourseCertificateTemplate);
router.put('/courses/:id/certificate-template', updateCourseCertificateTemplate);
router.post('/courses/:id/certificate-template/reset', resetCourseCertificateTemplate);
router.post('/courses/:id/certificates/reissue', reissueCourseCertificates);
router.post('/lessons/:lessonId/attachments', (req, res, next) => {
  uploadSingle(req.params.lessonId)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
    next();
  });
}, uploadAttachment);

router.post('/lessons/:lessonId/videos', (req, res, next) => {
  uploadVideoSingle(req.params.lessonId)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Ошибка загрузки видео' });
    next();
  });
}, uploadLessonVideo);
router.delete('/attachments/:id', deleteAttachment);

// Пользователи
router.get('/users', getUsers);
router.put('/users/:id', updateUserRole);
router.delete('/users/:id', deleteUser);

module.exports = router;

