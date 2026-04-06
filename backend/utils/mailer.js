const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = require('../config');

function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && MAIL_FROM);
}

function getTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendMail({ to, subject, html, text }) {
  if (!isMailConfigured()) {
    const err = new Error('SMTP не настроен (переменные окружения SMTP_* / MAIL_FROM)');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }

  const transport = getTransport();
  return transport.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  isMailConfigured,
  sendMail,
};

