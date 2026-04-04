const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { PORT, CORS_ORIGIN } = require('./config');
const initDB = require('./db/initDB');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const promptRoutes = require('./routes/promptRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const courseRoutes = require('./routes/courseRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Basic request logging
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

const frontendPath = path.join(__dirname, '..', 'frontend');

// Вход в админку — сразу сводка (Dashboard), без промежуточной страницы admin/index.html
app.get(['/admin', '/admin/'], (req, res) => {
  res.redirect(302, '/admin/dashboard');
});

// 301: /page.html -> /page, /index.html и */index.html -> без «index» и без .html
function redirectHtmlToCleanUrl(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!req.path.endsWith('.html')) return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads')) return next();

  let clean = req.path.slice(0, -5);
  if (clean === '/index' || clean === '') clean = '/';
  else if (clean.endsWith('/index')) clean = clean.slice(0, -6) || '/';

  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(301, clean + qs);
}

// GET /courses -> courses.html, GET / -> index.html; /admin редирект на /admin/dashboard (см. выше)
function serveExtensionlessHtml(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads')) return next();

  const segments = req.path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && last.includes('.')) return next();

  if (req.path === '/' || req.path === '') {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }

  const rel = req.path.replace(/^\/+/, '').replace(/\/+$/, '');
  const base = path.join(frontendPath, rel);
  const htmlFile = base + '.html';
  if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) {
    return res.sendFile(htmlFile);
  }
  const indexInDir = path.join(base, 'index.html');
  if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) {
    return res.sendFile(indexInDir);
  }
  next();
}

app.use(redirectHtmlToCleanUrl);
app.use(serveExtensionlessHtml);

// Статика фронтенда (CSS, JS, изображения)
app.use(express.static(frontendPath));

// Загруженные файлы курсов (изображения, документы)
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// Health-check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PromptLearn backend is running' });
});

// API роуты
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler (fallback)
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

initDB();

app.listen(PORT, () => {
  console.log(`PromptLearn backend listening on http://localhost:${PORT}`);
});

