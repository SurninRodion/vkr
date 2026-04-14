async function adminMiddleware(req, res, next) {
  
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Доступ разрешён только администраторам' });
  }

  next();
}

module.exports = adminMiddleware;
