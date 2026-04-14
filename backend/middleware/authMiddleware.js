const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { getUserById, updateUserLastSeen } = require('../models/userModel');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      points: user.points,
      level: user.level,
      emailVerified: Boolean(user.email_verified_at)
    };

    void updateUserLastSeen(user.id).catch(() => {});

    next();
  } catch (err) {
    console.error('[AuthMiddleware] JWT verification error:', err.message);
    return res.status(401).json({ message: 'Неверный или истекший токен' });
  }
}

module.exports = authMiddleware;
