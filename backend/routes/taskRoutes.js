const express = require('express');
const {
  listTasks,
  getTask,
  submitSolution,
  getTaskResult,
  getCompletedTaskIdsHandler
} = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');

const router = express.Router();

router.get('/', listTasks);
router.get('/completed-ids', authMiddleware, getCompletedTaskIdsHandler);
router.get('/:id/result', authMiddleware, getTaskResult);
router.get('/:id', getTask);
router.post('/submit', authMiddleware, requireVerifiedEmail, submitSolution);

module.exports = router;

