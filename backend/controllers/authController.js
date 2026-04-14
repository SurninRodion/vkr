const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET, APP_BASE_URL } = require('../config');
const { getUserByEmail, createUser, updateUserLastSeen, markEmailVerified, updateUserPasswordHash } = require('../models/userModel');
const { createEmailVerificationToken, consumeEmailVerificationToken } = require('../models/emailVerificationModel');
const { createPasswordResetToken, consumePasswordResetToken } = require('../models/passwordResetModel');
const { checkAndIncrement } = require('../models/rateLimitModel');
const { sendMail } = require('../utils/mailer');

const SALT_ROUNDS = 10;

function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').toString();
  if (xff) return xff.split(',')[0].trim();
  return (req.socket?.remoteAddress || req.ip || '').toString();
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function sendVerificationEmail({ email, userId, name }) {
  const { token } = await createEmailVerificationToken({ userId, ttlMinutes: 60 * 24 });
  const verifyUrl = `${APP_BASE_URL.replace(/\/+$/, '')}/profile?verifyToken=${encodeURIComponent(token)}`;

  const subject = 'Подтверждение email — Prompt Academy';
  const text = `Здравствуйте${name ? `, ${name}` : ''}!\n\nПодтвердите email, перейдя по ссылке:\n${verifyUrl}\n\nЕсли вы не регистрировались, просто проигнорируйте это письмо.`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.45; color: #111;">
      <h2 style="margin: 0 0 12px;">Подтверждение email</h2>
      <p style="margin: 0 0 12px;">Здравствуйте${name ? `, <b>${String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>` : ''}!</p>
      <p style="margin: 0 0 16px;">Чтобы завершить регистрацию, подтвердите email по кнопке ниже.</p>
      <p style="margin: 0 0 16px;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; border-radius: 10px; text-decoration: none;">
          Подтвердить email
        </a>
      </p>
      <p style="margin: 0 0 12px; font-size: 13px; color: #555;">Если кнопка не работает, откройте ссылку:</p>
      <p style="margin: 0 0 0; font-size: 13px;"><a href="${verifyUrl}">${verifyUrl}</a></p>
    </div>
  `;

  await sendMail({ to: email, subject, text, html });
}

async function sendPasswordResetEmail({ email, userId, name }) {
  const { token } = await createPasswordResetToken({ userId, ttlMinutes: 30 });
  const resetUrl = `${APP_BASE_URL.replace(/\/+$/, '')}/login?resetToken=${encodeURIComponent(token)}`;

  const subject = 'Восстановление пароля — Prompt Academy';
  const text = `Здравствуйте${name ? `, ${name}` : ''}!\n\nЧтобы сбросить пароль, перейдите по ссылке:\n${resetUrl}\n\nЕсли вы не запрашивали сброс, просто проигнорируйте это письмо.`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.45; color: #111;">
      <h2 style="margin: 0 0 12px;">Восстановление пароля</h2>
      <p style="margin: 0 0 12px;">Здравствуйте${name ? `, <b>${String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>` : ''}!</p>
      <p style="margin: 0 0 16px;">Чтобы установить новый пароль, нажмите кнопку ниже. Ссылка действует 30 минут.</p>
      <p style="margin: 0 0 16px;">
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; border-radius: 10px; text-decoration: none;">
          Сбросить пароль
        </a>
      </p>
      <p style="margin: 0 0 12px; font-size: 13px; color: #555;">Если кнопка не работает, откройте ссылку:</p>
      <p style="margin: 0 0 0; font-size: 13px;"><a href="${resetUrl}">${resetUrl}</a></p>
    </div>
  `;

  await sendMail({ to: email, subject, text, html });
}

async function register(req, res) {
  try {
    const { email, password, name } = req.body;
    console.log('[AuthController] Register attempt for email:', email);

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'email, password и name обязательны' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Пользователь с таким email уже существует' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = uuidv4();

    const user = await createUser({ id, email, password_hash, name, role: 'user' });
    void updateUserLastSeen(user.id).catch(() => {});
    const token = generateToken(user);
    void sendVerificationEmail({ email: user.email, userId: user.id, name: user.name }).catch((e) => {
      console.error('[AuthController] Failed to send verification email:', e.message);
    });

    console.log('[AuthController] User registered:', email);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        points: user.points,
        level: user.level,
        emailVerified: false
      }
    });
  } catch (err) {
    console.error('[AuthController] Register error:', err.message);
    return res.status(500).json({ message: 'Ошибка регистрации' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    console.log('[AuthController] Login attempt for email:', email);

    if (!email || !password) {
      return res.status(400).json({ message: 'email и password обязательны' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const token = generateToken(user);
    void updateUserLastSeen(user.id).catch(() => {});

    console.log('[AuthController] User logged in:', email);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        points: user.points,
        level: user.level,
        emailVerified: Boolean(user.email_verified_at)
      }
    });
  } catch (err) {
    console.error('[AuthController] Login error:', err.message);
    return res.status(500).json({ message: 'Ошибка входа' });
  }
}

async function verifyEmail(req, res) {
  try {
    const token = (req.query.token || '').toString();
    if (!token) {
      return res.status(400).json({ message: 'token обязателен' });
    }

    const result = await consumeEmailVerificationToken({ token });
    if (!result) {
      return res.status(400).json({ message: 'Ссылка подтверждения неверна или устарела' });
    }
    if (!result.ok) {
      return res.status(400).json({
        message:
          result.reason === 'expired'
            ? 'Ссылка подтверждения истекла. Запросите письмо ещё раз.'
            : 'Ссылка подтверждения уже использована. Попробуйте войти в аккаунт.',
      });
    }

    await markEmailVerified(result.userId);
    return res.json({ message: 'Email подтверждён' });
  } catch (err) {
    console.error('[AuthController] Verify email error:', err.message);
    return res.status(500).json({ message: 'Ошибка подтверждения email' });
  }
}

async function resendVerification(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Требуется авторизация' });

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) return res.status(401).json({ message: 'Пользователь не найден' });
    if (dbUser.email_verified_at) {
      return res.status(200).json({ message: 'Email уже подтверждён' });
    }

    const ip = getClientIp(req);
    const emailKey = dbUser.email.toLowerCase();
    const ipGate = await checkAndIncrement({
      scope: 'resend_verification:ip',
      key: ip,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipGate.ok) {
      res.set('Retry-After', String(ipGate.retryAfterSeconds));
      return res.status(429).json({
        message: 'Слишком много запросов. Попробуйте позже.',
        retryAfterSeconds: ipGate.retryAfterSeconds,
      });
    }

    const emailGate = await checkAndIncrement({
      scope: 'resend_verification:email',
      key: emailKey,
      limit: 2,
      windowMs: 10 * 60 * 1000,
    });
    if (!emailGate.ok) {
      res.set('Retry-After', String(emailGate.retryAfterSeconds));
      return res.status(429).json({
        message: 'Письмо уже отправлялось недавно. Попробуйте позже.',
        retryAfterSeconds: emailGate.retryAfterSeconds,
      });
    }

    await sendVerificationEmail({ email: dbUser.email, userId: dbUser.id, name: dbUser.name });
    return res.json({ message: 'Письмо отправлено' });
  } catch (err) {
    console.error('[AuthController] Resend verification error:', err.message);
    return res.status(500).json({ message: 'Не удалось отправить письмо. Попробуйте позже.' });
  }
}

async function forgotPassword(req, res) {
  try {
    const email = (req.body?.email || '').toString().trim();
    if (!email) {
      return res.status(400).json({ message: 'email обязателен' });
    }

    const ip = getClientIp(req);
    const normalizedEmail = email.toLowerCase();

    const ipGate = await checkAndIncrement({
      scope: 'forgot_password:ip',
      key: ip,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipGate.ok) {
      res.set('Retry-After', String(ipGate.retryAfterSeconds));
      return res.status(429).json({
        message: 'Слишком много запросов. Попробуйте позже.',
        retryAfterSeconds: ipGate.retryAfterSeconds,
      });
    }

    const emailGate = await checkAndIncrement({
      scope: 'forgot_password:email',
      key: normalizedEmail,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!emailGate.ok) {
      res.set('Retry-After', String(emailGate.retryAfterSeconds));
      return res.status(429).json({
        message: 'Запрос уже отправлялся недавно. Попробуйте позже.',
        retryAfterSeconds: emailGate.retryAfterSeconds,
      });
    }

    const user = await getUserByEmail(email);
    if (user) {
      void sendPasswordResetEmail({ email: user.email, userId: user.id, name: user.name }).catch((e) => {
        console.error('[AuthController] Failed to send reset email:', e.message);
      });
    }

    return res.json({ message: 'Если такой email зарегистрирован, мы отправили письмо со ссылкой.' });
  } catch (err) {
    console.error('[AuthController] Forgot password error:', err.message);
    return res.status(500).json({ message: 'Не удалось обработать запрос. Попробуйте позже.' });
  }
}

async function resetPassword(req, res) {
  try {
    const token = (req.body?.token || '').toString();
    const newPassword = (req.body?.newPassword || '').toString();

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'token и newPassword обязательны' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    }

    const result = await consumePasswordResetToken({ token });
    if (!result) {
      return res.status(400).json({ message: 'Ссылка сброса пароля неверна или устарела' });
    }
    if (!result.ok) {
      return res.status(400).json({
        message:
          result.reason === 'expired'
            ? 'Ссылка сброса пароля истекла. Запросите восстановление ещё раз.'
            : 'Ссылка сброса пароля уже использована. Запросите восстановление ещё раз.',
      });
    }

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await updateUserPasswordHash(result.userId, password_hash);
    return res.json({ message: 'Пароль обновлён. Теперь вы можете войти.' });
  } catch (err) {
    console.error('[AuthController] Reset password error:', err.message);
    return res.status(500).json({ message: 'Не удалось сбросить пароль. Попробуйте позже.' });
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
};
