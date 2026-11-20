// ============================================================
// ARCHIVO: auth.routes.js
// OBJETIVO: Rutas para el inicio de sesión y verificación de usuario
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { authenticateToken, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// RUTA: POST /api/auth/login
// Recibe documento y contraseña, verifica con la base de datos y genera el token
router.post('/login', (req, res) => {
  const { documento, password } = req.body;

  // Paso 1: Validar que mandaron ambos datos
  if (!documento || !password) {
    return res.status(400).json({ error: 'Debes ingresar el documento y la contraseña.' });
  }

  // Paso 2: Buscar al usuario en la tabla usuarios por su número de documento
  const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(String(documento).trim());

  if (!usuario) {
    return res.status(401).json({ error: 'Usuario no encontrado con ese documento.' });
  }

  // Paso 3: Verificar que el usuario no esté desactivado
  if (usuario.activo !== 1) {
    return res.status(403).json({ error: 'Este usuario se encuentra inactivo.' });
  }

  // Paso 4: Comparar la contraseña escrita con el hash seguro guardado en la BD
  const claveCorrecta = bcrypt.compareSync(password, usuario.password_hash);
  if (!claveCorrecta) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  // Paso 5: Generar el token JWT que el frontend usará en cada petición
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

  // Paso 6: Guardar el evento en el log de auditoría
  registrarAuditoria(usuario.id, 'INICIO_SESION', 'USUARIOS', usuario.id, `Inicio de sesión como ${usuario.rol}`, req);

  // Paso 7: Responder al navegador con el token y datos básicos del usuario
  res.json({
    message: 'Ingreso exitoso',
    token: token,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol
    }
  });
});

// RUTA: GET /api/auth/me
// Devuelve la información del usuario autenticado actualmente
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
