// ============================================================
// ARCHIVO: auth.routes.js
// Rutas de autenticación directa (Login y perfil de usuario)
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { authenticateToken, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// RUTA: POST /api/auth/login
// Valida documento y contraseña, emitiendo el token JWT directamente
router.post('/login', (req, res) => {
  const { documento, password } = req.body;

  // 1. Validar campos obligatorios
  if (!documento || !password) {
    return res.status(400).json({ error: 'Debes ingresar el documento y la contraseña.' });
  }

  // 2. Buscar usuario por número de documento
  const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(String(documento).trim());
  if (!usuario) {
    return res.status(401).json({ error: 'Usuario no encontrado con ese documento.' });
  }

  if (usuario.activo !== 1) {
    return res.status(403).json({ error: 'El usuario se encuentra inactivo.' });
  }

  // 3. Comparar contraseña con el hash seguro guardado en BD
  const claveValida = bcrypt.compareSync(password, usuario.password_hash);
  if (!claveValida) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  // 4. Generar token de sesión JWT
  const token = jwt.sign(
    { 
      id: usuario.id, 
      documento: usuario.documento, 
      rol: usuario.rol, 
      nombre: usuario.nombre 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  // 5. Registrar evento en log de auditoría
  registrarAuditoria(usuario.id, 'INICIO_SESION', 'USUARIOS', usuario.id, `Inicio de sesión exitoso (${usuario.rol})`, req);

  // 6. Responder con el token y datos del usuario
  res.json({
    message: 'Inicio de sesión exitoso',
    token: token,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol
    }
  });
});

// RUTA: GET /api/auth/me (Consultar usuario actual)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
