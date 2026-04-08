const express = require('express');
const { getProfile, updateProfile } = require('../controllers/profileController');
const { getMyCourses, getMyCertificates, getMyCertificateHtml, getMyCertificatePdf } = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getProfile);
router.get('/courses', authMiddleware, getMyCourses);
router.get('/certificates', authMiddleware, getMyCertificates);
router.get('/certificates/:id/html', authMiddleware, getMyCertificateHtml);
router.get('/certificates/:id/pdf', authMiddleware, getMyCertificatePdf);
router.put('/', authMiddleware, updateProfile);

module.exports = router;

