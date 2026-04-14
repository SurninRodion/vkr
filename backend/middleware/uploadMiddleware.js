const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_BASE = path.join(__dirname, '..', 'uploads', 'courses');

function getStorageForLesson(lessonId) {
  const dir = path.join(UPLOADS_BASE, lessonId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      cb(null, `${uuidv4()}${ext}`);
    }
  });
}

function uploadSingle(lessonId) {
  return multer({
    storage: getStorageForLesson(lessonId),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|txt|zip)$/i.test(file.originalname);
      if (allowed) cb(null, true);
      else cb(new Error('Недопустимый тип файла. Разрешены: изображения, PDF, DOC, TXT, ZIP.'));
    }
  }).single('file');
}

function uploadVideoSingle(lessonId) {
  return multer({
    storage: getStorageForLesson(lessonId),
    
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /\.(mp4|webm|ogg|mov|m4v)$/i.test(file.originalname);
      if (allowed) cb(null, true);
      else cb(new Error('Недопустимый тип видео. Разрешены: MP4, WEBM, OGG, MOV, M4V.'));
    }
  }).single('file');
}

module.exports = { uploadSingle, uploadVideoSingle, UPLOADS_BASE };
