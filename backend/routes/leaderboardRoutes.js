const express = require('express');
const { getTopUsers } = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/', getTopUsers);

module.exports = router;

