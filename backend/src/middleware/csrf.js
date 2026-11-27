// ============================================================
// ARCHIVO: csrf.js
// Protección CSRF mediante Double-Submit Cookie + comparación en tiempo constante
// ============================================================

const crypto = require('crypto');
const { IS_PRODUCTION } = require('../config');
const { AUTH_COOKIE_NAME, registrarAuditoria } = require('./auth');

const CSRF_COOKIE_NAME = 'medbot_csrf';

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function issueCsrfCookie(res) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // El frontend debe leerlo para enviarlo en X-CSRF-Token
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    maxAge: 30 * 60 * 1000
  });
  return token;
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/'
  });
}

function csrfProtection(req, res, next) {
  // Métodos seguros de solo lectura no requieren token CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // El login inicial se protege con SameSite=Strict, rate limiting y Content-Type JSON
  if (req.path === '/api/auth/login') {
    return next();
  }

  // Si no hay cookie de sesión ni cabecera Authorization, dejar que authenticateToken responda 401
  if ((!req.cookies || !req.cookies[AUTH_COOKIE_NAME]) && !req.headers.authorization) {
    return next();
  }

  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length !== 64 ||
    headerToken.length !== 64
  ) {
    registrarAuditoria(req.user ? req.user.id : null, 'CSRF_INVALIDO', 'SEGURIDAD', null, `Token CSRF ausente o malformado en ${req.method} ${req.originalUrl}`, req);
    return res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
  }

  const bufCookie = Buffer.from(cookieToken, 'utf8');
  const bufHeader = Buffer.from(headerToken, 'utf8');

  if (!crypto.timingSafeEqual(bufCookie, bufHeader)) {
    registrarAuditoria(req.user ? req.user.id : null, 'CSRF_INVALIDO', 'SEGURIDAD', null, `Discrepancia de token CSRF en ${req.method} ${req.originalUrl}`, req);
    return res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
  }

  next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  issueCsrfCookie,
  clearCsrfCookie,
  csrfProtection
};
