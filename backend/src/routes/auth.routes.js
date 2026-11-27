// ============================================================
// ARCHIVO: auth.routes.js
// Rutas de autenticación segura (Login, Logout, Cambio de clave, CSRF)
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const {
  JWT_SECRET,
  JWT_ALGORITHM,
  JWT_EXPIRES_IN,
  IS_PRODUCTION,
  BCRYPT_ROUNDS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES
} = require('../config');
const {
  AUTH_COOKIE_NAME,
  authenticateToken,
  registrarAuditoria
} = require('../middleware/auth');
const { issueCsrfCookie, clearCsrfCookie } = require('../middleware/csrf');
const { loginSchema, cambiarPasswordSchema, validateBody } = require('../middleware/validate');

const router = express.Router();

// Hash ficticio precalculado (costo 12) para igualar tiempos de respuesta cuando el usuario no existe
const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7H4Q4oN3qQ1uQpR5f4m4T8k8O2m5r6W';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente nuevamente más tarde.' }
});

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/',
    maxAge: 30 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PRODUCTION,
    path: '/'
  });
}

// GET /api/auth/csrf-token
router.get('/csrf-token', (req, res) => {
  const csrfToken = issueCsrfCookie(res);
  res.json({ csrfToken });
});

// POST /api/auth/login
router.post('/login', loginLimiter, validateBody(loginSchema), (req, res) => {
  const { documento, password } = req.validatedBody;

  const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(documento);

  if (!usuario) {
    // Igualar tiempo de respuesta con bcrypt
    bcrypt.compareSync(password, DUMMY_PASSWORD_HASH);
    registrarAuditoria(null, 'LOGIN_FALLIDO', 'USUARIOS', null, `Intento fallido para documento no registrado: ${documento}`, req);
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  // Verificar bloqueo temporal por fuerza bruta
  if (usuario.bloqueado_hasta) {
    const lockRow = db.prepare("SELECT datetime('now', 'localtime') < ? AS bloqueado").get(usuario.bloqueado_hasta);
    if (lockRow && lockRow.bloqueado === 1) {
      registrarAuditoria(usuario.id, 'LOGIN_BLOQUEADO', 'USUARIOS', usuario.id, 'Intento de acceso con cuenta bloqueada temporalmente', req);
      return res.status(423).json({
        error: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente más tarde.'
      });
    }
  }

  const claveValida = bcrypt.compareSync(password, usuario.password_hash);

  if (!claveValida || usuario.activo !== 1) {
    const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;
    if (nuevosIntentos >= MAX_LOGIN_ATTEMPTS) {
      db.prepare(`
        UPDATE usuarios
        SET intentos_fallidos = ?,
            bloqueado_hasta = datetime('now', 'localtime', '+' || ? || ' minutes')
        WHERE id = ?
      `).run(nuevosIntentos, LOCKOUT_MINUTES, usuario.id);
      registrarAuditoria(usuario.id, 'CUENTA_BLOQUEADA', 'USUARIOS', usuario.id, `Cuenta bloqueada tras ${nuevosIntentos} intentos fallidos`, req);
    } else {
      db.prepare('UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?').run(nuevosIntentos, usuario.id);
      registrarAuditoria(usuario.id, 'LOGIN_FALLIDO', 'USUARIOS', usuario.id, `Contraseña incorrecta o usuario inactivo (intento ${nuevosIntentos})`, req);
    }
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  // Restablecer contador de intentos fallidos
  db.prepare('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?').run(usuario.id);

  const token = jwt.sign(
    {
      id: usuario.id,
      rol: usuario.rol,
      tv: usuario.token_version
    },
    JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN
    }
  );

  setAuthCookie(res, token);
  const csrfToken = issueCsrfCookie(res);

  registrarAuditoria(usuario.id, 'INICIO_SESION', 'USUARIOS', usuario.id, `Inicio de sesión exitoso (${usuario.rol})`, req);

  res.json({
    message: 'Inicio de sesión exitoso',
    csrfToken,
    mustChangePassword: usuario.debe_cambiar_password === 1,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol,
      debe_cambiar_password: usuario.debe_cambiar_password === 1
    }
  });
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', authenticateToken, validateBody(cambiarPasswordSchema), (req, res) => {
  const { currentPassword, newPassword } = req.validatedBody;

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  if (!usuario) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!bcrypt.compareSync(currentPassword, usuario.password_hash)) {
    registrarAuditoria(req.user.id, 'CAMBIO_PASSWORD_FALLIDO', 'USUARIOS', req.user.id, 'Contraseña actual incorrecta', req);
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual.' });
  }

  const nuevoHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
  const nuevaVersion = (usuario.token_version || 1) + 1;

  db.prepare(`
    UPDATE usuarios
    SET password_hash = ?,
        debe_cambiar_password = 0,
        token_version = ?
    WHERE id = ?
  `).run(nuevoHash, nuevaVersion, usuario.id);

  const nuevoToken = jwt.sign(
    {
      id: usuario.id,
      rol: usuario.rol,
      tv: nuevaVersion
    },
    JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN
    }
  );

  setAuthCookie(res, nuevoToken);
  const csrfToken = issueCsrfCookie(res);

  registrarAuditoria(usuario.id, 'CAMBIO_PASSWORD', 'USUARIOS', usuario.id, 'Contraseña actualizada exitosamente', req);

  res.json({
    message: 'Contraseña actualizada exitosamente.',
    csrfToken,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol,
      debe_cambiar_password: false
    }
  });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  db.prepare('UPDATE usuarios SET token_version = token_version + 1 WHERE id = ?').run(req.user.id);
  registrarAuditoria(req.user.id, 'CIERRE_SESION', 'USUARIOS', req.user.id, 'Cierre de sesión e invalidación de token', req);
  clearAuthCookie(res);
  clearCsrfCookie(res);
  res.json({ message: 'Sesión cerrada exitosamente.' });
});

// POST /api/auth/refresh  — renueva el token silenciosamente si aún es válido
router.post('/refresh', authenticateToken, (req, res) => {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(req.user.id);
  if (!usuario) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const nuevoToken = jwt.sign(
    {
      id: usuario.id,
      rol: usuario.rol,
      tv: usuario.token_version
    },
    JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN
    }
  );

  setAuthCookie(res, nuevoToken);
  const csrfToken = issueCsrfCookie(res);

  res.json({
    csrfToken,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol,
      debe_cambiar_password: usuario.debe_cambiar_password === 1
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
