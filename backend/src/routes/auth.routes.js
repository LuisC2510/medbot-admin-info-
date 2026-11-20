// ============================================================
// ARCHIVO: auth.routes.js
// Rutas de autenticación con Verificación en Dos Pasos (2FA de Microsoft)
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { authenticateToken, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// Almacén temporal en memoria para los códigos de verificación de dos pasos
// Guarda: { userId, codigo, expira }
const desafios2FA = new Map();

// RUTA 1: POST /api/auth/login (Paso 1: usuario y contraseña)
router.post('/login', (req, res) => {
  const { documento, password, codigo2FA } = req.body;

  // 1. Validar campos
  if (!documento || !password) {
    return res.status(400).json({ error: 'Debes ingresar documento y contraseña.' });
  }

  // 2. Buscar usuario en base de datos
  const usuario = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(String(documento).trim());
  if (!usuario) {
    return res.status(401).json({ error: 'Usuario no encontrado con ese documento.' });
  }

  if (usuario.activo !== 1) {
    return res.status(403).json({ error: 'El usuario se encuentra inactivo.' });
  }

  // 3. Comparar contraseña con bcrypt
  const claveValida = bcrypt.compareSync(password, usuario.password_hash);
  if (!claveValida) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  // 4. ¿Requiere Verificación en Dos Pasos de Microsoft?
  // Médicos, Enfermeros y Administradores manejan datos clínicos y requieren 2FA
  const rolesCon2FA = ['MEDICO', 'ENFERMERO', 'ADMIN'];

  if (rolesCon2FA.includes(usuario.rol)) {
    // Si no mandaron el código de verificación todavía, iniciamos el Paso 2
    if (!codigo2FA) {
      // Generar código de 6 dígitos (ej: 582914)
      const codigoGenerado = Math.floor(100000 + Math.random() * 900000).toString();

      // Token temporal para identificar este intento de login (válido por 5 minutos)
      const tempToken = jwt.sign(
        { id: usuario.id, paso: '2FA_PENDIENTE' },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      desafios2FA.set(tempToken, {
        userId: usuario.id,
        codigo: codigoGenerado,
        expira: Date.now() + 5 * 60 * 1000
      });

      return res.json({
        require2FA: true,
        tempToken: tempToken,
        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          documento: usuario.documento,
          rol: usuario.rol
        },
        mensaje: 'Verificación en dos pasos requerida (Microsoft Authenticator)',
        codigoDemo: codigoGenerado // Se muestra para facilitar la prueba en clase
      });
    }
  }

  // Si es ADMINISTRATIVO o si se validó directamente, generamos el token final
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

  registrarAuditoria(usuario.id, 'INICIO_SESION', 'USUARIOS', usuario.id, `Ingreso directo (${usuario.rol})`, req);

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

// RUTA 2: POST /api/auth/verify-2fa (Paso 2: confirmar código Microsoft Authenticator)
router.post('/verify-2fa', (req, res) => {
  const { tempToken, codigo } = req.body;

  if (!tempToken || !codigo) {
    return res.status(400).json({ error: 'Debes enviar el token temporal y el código de 6 dígitos.' });
  }

  const desafio = desafios2FA.get(tempToken);
  if (!desafio || Date.now() > desafio.expira) {
    return res.status(400).json({ error: 'El código ha expirado. Por favor inicia sesión de nuevo.' });
  }

  // Comparar el código escrito con el generado
  if (desafio.codigo !== String(codigo).trim()) {
    return res.status(400).json({ error: 'Código de verificación incorrecto. Revisa tu app Microsoft Authenticator.' });
  }

  // Código correcto: borrar el desafío usado
  desafios2FA.delete(tempToken);

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(desafio.userId);
  if (!usuario || usuario.activo !== 1) {
    return res.status(401).json({ error: 'Usuario no disponible o inactivo.' });
  }

  // Generar el token final de sesión
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

  registrarAuditoria(usuario.id, 'LOGIN_2FA_MICROSOFT', 'USUARIOS', usuario.id, `2FA Microsoft exitoso (${usuario.rol})`, req);

  res.json({
    message: 'Verificación de dos pasos completada con éxito',
    token: token,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      documento: usuario.documento,
      rol: usuario.rol
    }
  });
});

// RUTA 3: GET /api/auth/me (Consultar usuario actual)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
