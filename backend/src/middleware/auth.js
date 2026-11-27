// ============================================================
// ARCHIVO: auth.js
// OBJETIVO: Middlewares para proteger las rutas con JWT (HS256) y roles
// ============================================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_ALGORITHM } = require('../config');
const db = require('../db');

const AUTH_COOKIE_NAME = 'medbot_token';

function extractTokenFromRequest(req) {
  if (req.cookies && typeof req.cookies[AUTH_COOKIE_NAME] === 'string') {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function verifyTokenAndLoadUser(token) {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM]
  });

  if (!decoded || typeof decoded.id !== 'number' || typeof decoded.tv !== 'number') {
    return null;
  }

  const usuario = db.prepare(`
    SELECT id, nombre, documento, rol, activo, debe_cambiar_password, token_version
    FROM usuarios
    WHERE id = ?
  `).get(decoded.id);

  if (!usuario || usuario.activo !== 1 || usuario.token_version !== decoded.tv) {
    return null;
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    documento: usuario.documento,
    rol: usuario.rol,
    activo: usuario.activo,
    debe_cambiar_password: usuario.debe_cambiar_password === 1
  };
}

// 1. REVISAR SI EL USUARIO ESTÁ LOGUEADO (TIENE TOKEN VÁLIDO)
function authenticateToken(req, res, next) {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
  }

  try {
    const usuario = verifyTokenAndLoadUser(token);
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    req.user = usuario;

    // Si el usuario tiene contraseña semilla sin cambiar, solo permitir rutas de auth/cambio de clave
    const rutasPermitidasCambioClave = [
      '/api/auth/cambiar-password',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/csrf-token'
    ];

    if (usuario.debe_cambiar_password && !rutasPermitidasCambioClave.includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({
        error: 'Debe cambiar su contraseña inicial antes de acceder al sistema.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

// 2. REVISAR SI EL USUARIO TIENE EL ROL NECESARIO
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    if (req.user.rol === 'ADMIN' || rolesPermitidos.includes(req.user.rol)) {
      return next();
    }

    registrarAuditoria(
      req.user.id,
      'ACCESO_DENEGADO',
      'SEGURIDAD',
      null,
      `Rol ${req.user.rol} intentó acceder a ${req.method} ${req.originalUrl}`,
      req
    );

    return res.status(403).json({
      error: 'Acceso denegado.'
    });
  };
}

// 3. REGISTRAR ACCIONES EN LA TABLA DE AUDITORÍA (INMUTABLE)
function registrarAuditoria(usuarioId, accion, entidad, entidadId, detalles, req) {
  try {
    const ip = req ? (req.ip || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';

    db.prepare(`
      INSERT INTO log_auditoria (usuario_id, accion, entidad, entidad_id, detalles, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      usuarioId || null,
      accion,
      entidad,
      entidadId || null,
      typeof detalles === 'object' ? JSON.stringify(detalles) : String(detalles || ''),
      ip
    );
  } catch (err) {
    console.error('Aviso: No se pudo registrar auditoría:', err.message);
  }
}

module.exports = {
  AUTH_COOKIE_NAME,
  extractTokenFromRequest,
  verifyTokenAndLoadUser,
  authenticateToken,
  requireRole,
  registrarAuditoria
};
