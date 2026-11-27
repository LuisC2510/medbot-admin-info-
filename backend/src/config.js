// ============================================================
// ARCHIVO: config.js
// Configuración segura del servidor y variables de entorno
// ============================================================

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim().length < 32) {
  console.error('❌ ERROR CRÍTICO DE SEGURIDAD: JWT_SECRET no está definido en .env o tiene menos de 32 caracteres.');
  console.error('   El servidor no puede iniciar sin un secreto criptográfico robusto.');
  process.exit(1);
}

const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
const ALLOWED_ORIGINS = allowedOriginsRaw
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const NODE_ENV = process.env.NODE_ENV || 'development';
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HTTPS_PORT: parseInt(process.env.HTTPS_PORT || '3443', 10),
  HTTPS_ENABLED,
  SSL_KEY_PATH: process.env.SSL_KEY_PATH || './certs/localhost-key.pem',
  SSL_CERT_PATH: process.env.SSL_CERT_PATH || './certs/localhost.pem',
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === 'production' || HTTPS_ENABLED,
  JWT_SECRET,
  JWT_ALGORITHM: 'HS256',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30m',
  BCRYPT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,
  ALLOWED_ORIGINS
};
