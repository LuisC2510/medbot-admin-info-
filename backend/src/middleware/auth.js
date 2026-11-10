const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Se requiere token de sesión.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión expirada o token inválido.' });
    }

    const user = db.prepare('SELECT id, nombre, documento, rol, activo FROM usuarios WHERE id = ?').get(decoded.id);
    if (!user || user.activo !== 1) {
      return res.status(403).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    req.user = user;
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }

    // El rol ADMIN tiene acceso maestro a todas las vistas y acciones
    if (req.user.rol === 'ADMIN' || allowedRoles.includes(req.user.rol)) {
      return next();
    }

    return res.status(403).json({
      error: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}. Tu rol actual es: ${req.user.rol}`
    });
  };
}

function registrarAuditoria(usuarioId, accion, entidad, entidadId, detalles, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    db.prepare(`
      INSERT INTO log_auditoria (usuario_id, accion, entidad, entidad_id, detalles, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(usuarioId, accion, entidad, entidadId, typeof detalles === 'object' ? JSON.stringify(detalles) : detalles, ip);
  } catch (err) {
    console.error('Error al registrar auditoría:', err.message);
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  registrarAuditoria
};

