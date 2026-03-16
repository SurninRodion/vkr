const express = require('express');
const { getProfile, updateProfile } = require('../controllers/profileController');
const { getMyCourses } = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getProfile);
router.get('/courses', authMiddleware, getMyCourses);
router.put('/', authMiddleware, updateProfile);

module.exports = router;

