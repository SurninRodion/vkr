function requireVerifiedEmail(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Требуется авторизация' });
  if (!user.emailVerified) {
    return res.status(403).json({
      message: 'Подтвердите email, чтобы продолжить.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
}

module.exports = requireVerifiedEmail;

