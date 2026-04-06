const express = require('express');
const { getPublicLibraryPrompts } = require('../controllers/libraryController');
const authMiddleware = require('../middleware/authMiddleware');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');

const router = express.Router();

router.get('/prompts', authMiddleware, requireVerifiedEmail, getPublicLibraryPrompts);

module.exports = router;
