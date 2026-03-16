const express = require('express');
const {
  listCourses,
  getCourse,
  enroll,
  completeLesson,
  submitQuiz,
  getCourseProgress,
  checkStepAnswer
} = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', listCourses);
router.get('/:id', getCourse);
router.get('/:id/progress', authMiddleware, getCourseProgress);
router.post('/:id/enroll', authMiddleware, enroll);
router.post('/:courseId/lessons/:lessonId/complete', authMiddleware, completeLesson);
router.post('/:courseId/lessons/:lessonId/quiz/submit', authMiddleware, submitQuiz);
router.post('/:courseId/lessons/:lessonId/steps/:stepId/check', authMiddleware, checkStepAnswer);

module.exports = router;
