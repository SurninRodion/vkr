require('dotenv').config();

const path = require('path');

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'database.db'),
  AI_API_URL: process.env.AI_API_URL || '',
  AI_API_KEY: process.env.AI_API_KEY || '',
  /** GigaChat API (приоритет над AI_API_*). Ключ авторизации из личного кабинета Sber. */
  GIGACHAT_CREDENTIALS: process.env.GIGACHAT_CREDENTIALS || 'MDE5Y2YyY2EtMDU1YS03N2I1LTg5MjItYmI2Njc3M2I5YTlkOjFmM2Y1NWFmLWQ5MDctNGI4Yy05OGJkLWMzMzMwYjZlZDg3Ng==',
  GIGACHAT_SCOPE: process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS',
  GIGACHAT_MODEL: process.env.GIGACHAT_MODEL || 'GigaChat',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5500',

  /** Base URL для ссылок в письмах (dev: http://localhost:5000) */
  APP_BASE_URL: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,

  /** SMTP (например Яндекс: smtp.yandex.ru:465, secure=true) */
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
  SMTP_SECURE: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  /** Адрес отправителя писем */
  MAIL_FROM: process.env.MAIL_FROM || process.env.SMTP_USER || ''
};

