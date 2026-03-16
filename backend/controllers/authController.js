const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('../config');
const { getUserByEmail, createUser } = require('../models/userModel');

const SALT_ROUNDS = 10;

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
    const token = generateToken(user);

    console.log('[AuthController] User registered:', email);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        points: user.points,
        level: user.level
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

    console.log('[AuthController] User logged in:', email);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        points: user.points,
        level: user.level
      }
    });
  } catch (err) {
    console.error('[AuthController] Login error:', err.message);
    return res.status(500).json({ message: 'Ошибка входа' });
  }
}

module.exports = {
  register,
  login
};

