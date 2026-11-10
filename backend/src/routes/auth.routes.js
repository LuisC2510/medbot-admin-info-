const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { authenticateToken, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { documento, password } = req.body;

  if (!documento || !password) {
    return res.status(400).json({ error: 'Debe ingresar documento y contraseña.' });
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE documento = ?').get(String(documento).trim());

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas. Usuario no encontrado.' });
  }

  if (user.activo !== 1) {
    return res.status(403).json({ error: 'El usuario se encuentra inactivo en el sistema.' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Credenciales inválidas. Contraseña incorrecta.' });
  }

  const token = jwt.sign(
    { id: user.id, documento: user.documento, rol: user.rol, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  registrarAuditoria(user.id, 'INICIO_SESION', 'USUARIOS', user.id, `Inicio de sesión exitoso como ${user.rol}`, req);

  res.json({
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      documento: user.documento,
      rol: user.rol
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

