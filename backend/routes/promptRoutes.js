const express = require('express');
const { analyze } = require('../controllers/promptController');
const authMiddleware = require('../middleware/authMiddleware');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');

const router = express.Router();

router.post('/analyze', authMiddleware, requireVerifiedEmail, analyze);

module.exports = router;

