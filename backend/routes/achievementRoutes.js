const express = require('express');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { listAchievementsCatalog, listMyAchievements } = require('../controllers/achievementController');

const router = express.Router();

router.get('/', optionalAuthMiddleware, listAchievementsCatalog);
router.get('/my', authMiddleware, listMyAchievements);

module.exports = router;
