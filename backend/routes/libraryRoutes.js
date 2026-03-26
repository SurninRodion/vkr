const express = require('express');
const { getPublicLibraryPrompts } = require('../controllers/libraryController');

const router = express.Router();

router.get('/prompts', getPublicLibraryPrompts);

module.exports = router;
