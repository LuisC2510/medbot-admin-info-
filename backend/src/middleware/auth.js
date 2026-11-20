// ============================================================
// ARCHIVO: auth.js
// OBJETIVO: Middlewares para proteger las rutas con JWT y roles
// ============================================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../db');

// 1. REVISAR SI EL USUARIO ESTÁ LOGUEADO (TIENE TOKEN VÁLIDO)
function authenticateToken(req, res, next) {
  // El token viene en el header "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Si no mandaron ningún token, no puede entrar
  if (!token) {
    return res.status(401).json({ error: 'No has iniciado sesión. Por favor ingresa.' });
  }

  // Verificamos si el token es válido y no ha vencido
  jwt.verify(token, JWT_SECRET, (error, datosDecodificados) => {
    if (error) {
      // Si el token venció o es inválido, respondemos 401
      return res.status(401).json({ error: 'Tu sesión ha expirado. Por favor ingresa de nuevo.' });
    }

    // Buscamos al usuario en la base de datos para confirmar que siga activo
    const usuario = db.prepare('SELECT id, nombre, documento, rol, activo FROM usuarios WHERE id = ?').get(datosDecodificados.id);

    if (!usuario || usuario.activo !== 1) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    // Guardamos los datos del usuario en la petición para usarlo en las siguientes rutas
    req.user = usuario;
    next();
  });
}

// 2. REVISAR SI EL USUARIO TIENE EL ROL NECESARIO
// Por ejemplo: requireRole('MEDICO') o requireRole('ADMINISTRATIVO')
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No estás autenticado.' });
    }

    // El ADMIN siempre tiene permiso para todo
    if (req.user.rol === 'ADMIN' || rolesPermitidos.includes(req.user.rol)) {
      return next();
    }

    // Si no tiene el rol, le negamos el acceso con 403 (Prohibido)
    return res.status(403).json({
      error: `Acceso denegado. Se necesita el rol: ${rolesPermitidos.join(' o ')}.`
    });
  };
}

// 3. REGISTRAR ACCIONES EN LA TABLA DE AUDITORÍA
function registrarAuditoria(usuarioId, accion, entidad, entidadId, detalles, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    
    db.prepare(`
      INSERT INTO log_auditoria (usuario_id, accion, entidad, entidad_id, detalles, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      usuarioId,
      accion,
      entidad,
      entidadId,
      typeof detalles === 'object' ? JSON.stringify(detalles) : detalles,
      ip
    );
  } catch (err) {
    console.log('Aviso: No se pudo registrar auditoría:', err.message);
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  registrarAuditoria
};
