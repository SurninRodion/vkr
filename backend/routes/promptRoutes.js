const express = require('express');
const { analyze } = require('../controllers/promptController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/analyze', authMiddleware, analyze);

module.exports = router;

