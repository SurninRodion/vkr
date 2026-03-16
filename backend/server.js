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
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Basic request logging
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Статика фронтенда (обслуживание index.html и ассетов)
const frontendPath = path.join(__dirname, '..', 'frontend');
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
app.use('/api/admin', adminRoutes);

// Корневой маршрут — отдать фронтенд
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler (fallback)
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

initDB();

app.listen(PORT, () => {
  console.log(`PromptLearn backend listening on http://localhost:${PORT}`);
});

