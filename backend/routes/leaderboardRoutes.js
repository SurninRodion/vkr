const express = require('express');
const { getTopUsers, getEnhancedLeaderboard } = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/enhanced', getEnhancedLeaderboard);
router.get('/', getTopUsers);

module.exports = router;
