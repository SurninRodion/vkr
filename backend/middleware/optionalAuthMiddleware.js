const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

/**
 * Если передан корректный Bearer JWT — добавляет минимальный req.user (id, role).
 * Если токена нет или он невалерен — просто продолжаем без авторизации (без ошибки).
 */
function optionalAuthMiddleware(req, _res, next) {
  req.user = null;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded?.id) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
      };
    }
  } catch (_) {
    
  }
  next();
}

module.exports = optionalAuthMiddleware;
