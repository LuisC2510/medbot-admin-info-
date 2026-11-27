const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { BCRYPT_ROUNDS } = require('../config');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');
const {
  nivelUpdateSchema,
  emergenciaSchema,
  usuarioCreateSchema,
  validateBody,
  validateIdParam
} = require('../middleware/validate');

const router = express.Router();
router.use(authenticateToken);

const userCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de creación de usuarios. Intente más tarde.' }
});

function getIo(req) {
  return req.app.get('io');
}

// GET /api/configuracion/niveles
router.get('/niveles', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const niveles = db.prepare('SELECT nivel, nombre, color, codigo_color, minutos_max, descripcion, editable FROM niveles_triage ORDER BY nivel ASC').all();
  res.json(niveles);
});

// PUT /api/configuracion/niveles/:nivel (Solo Admin)
router.put('/niveles/:nivel', requireRole('ADMIN'), validateIdParam('nivel'), validateBody(nivelUpdateSchema), (req, res) => {
  const nivel = req.validatedParams.nivel;
  const { minutos_max } = req.validatedBody;

  if (nivel < 1 || nivel > 5) {
    return res.status(404).json({ error: 'Nivel no encontrado.' });
  }

  if (nivel === 1 || nivel === 2) {
    return res.status(400).json({
      error: 'Según la Resolución 5596 de 2015, los tiempos de Triage I y Triage II son de cumplimiento normativo estricto y no pueden modificarse.'
    });
  }

  const row = db.prepare('SELECT * FROM niveles_triage WHERE nivel = ?').get(nivel);
  if (!row) {
    return res.status(404).json({ error: 'Nivel no encontrado.' });
  }

  try {
    db.prepare('UPDATE niveles_triage SET minutos_max = ? WHERE nivel = ?').run(minutos_max, nivel);

    registrarAuditoria(
      req.user.id,
      'MODIFICAR_TIEMPO_TRIAGE',
      'NIVELES_TRIAGE',
      nivel,
      `Modificación de tiempo máximo para ${row.nombre}: de ${row.minutos_max} min a ${minutos_max} min`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('config:niveles_actualizados', { nivel, minutos_max });
    }

    res.json({
      message: `Tiempo de espera para ${row.nombre} actualizado a ${minutos_max} minutos.`,
      nivel,
      minutos_max
    });
  } catch (err) {
    console.error('Error al actualizar nivel:', err);
    res.status(500).json({ error: 'Error interno al actualizar nivel.' });
  }
});

// GET /api/configuracion/emergencia
router.get('/emergencia', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const conf = db.prepare("SELECT valor, descripcion, actualizado_en FROM configuracion WHERE clave = 'modo_emergencia'").get();
  res.json({
    modo_emergencia: conf ? conf.valor === '1' : false,
    descripcion: conf ? conf.descripcion : '',
    actualizado_en: conf ? conf.actualizado_en : null
  });
});

// POST /api/configuracion/emergencia (Solo Admin o Médico)
router.post('/emergencia', requireRole('ADMIN', 'MEDICO'), validateBody(emergenciaSchema), (req, res) => {
  const { activo } = req.validatedBody;
  const nuevoValor = activo ? '1' : '0';

  try {
    db.prepare(`
      INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
      VALUES ('modo_emergencia', ?, 'Modo desastre o emergencia con múltiples víctimas: suspende temporalmente los límites de tiempo normativos', datetime('now', 'localtime'))
      ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en
    `).run(nuevoValor);

    registrarAuditoria(
      req.user.id,
      nuevoValor === '1' ? 'ACTIVAR_MODO_EMERGENCIA' : 'DESACTIVAR_MODO_EMERGENCIA',
      'CONFIGURACION',
      1,
      `Modo Emergencia ${nuevoValor === '1' ? 'ACTIVADO' : 'DESACTIVADO'} por ${req.user.nombre}`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('emergencia:toggle', {
        activo: nuevoValor === '1',
        activado_por: req.user.nombre,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      message: `Modo de emergencia ${nuevoValor === '1' ? 'ACTIVADO' : 'DESACTIVADO'} con éxito.`,
      modo_emergencia: nuevoValor === '1'
    });
  } catch (err) {
    console.error('Error al cambiar modo de emergencia:', err);
    res.status(500).json({ error: 'Error interno al cambiar modo de emergencia.' });
  }
});

// GET /api/configuracion/usuarios (Solo Admin)
router.get('/usuarios', requireRole('ADMIN'), (req, res) => {
  const usuarios = db.prepare('SELECT id, nombre, documento, rol, activo, debe_cambiar_password, creado_en FROM usuarios ORDER BY id ASC').all();
  res.json(usuarios);
});

// POST /api/configuracion/usuarios (Solo Admin)
router.post('/usuarios', requireRole('ADMIN'), userCreationLimiter, validateBody(usuarioCreateSchema), (req, res) => {
  const { nombre, documento, rol, password } = req.validatedBody;

  const existing = db.prepare('SELECT id FROM usuarios WHERE documento = ?').get(documento);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese documento.' });
  }

  try {
    const password_hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const result = db.prepare(`
      INSERT INTO usuarios (nombre, documento, rol, password_hash, activo, debe_cambiar_password)
      VALUES (?, ?, ?, ?, 1, 1)
    `).run(nombre, documento, rol, password_hash);

    registrarAuditoria(
      req.user.id,
      'CREAR_USUARIO',
      'USUARIOS',
      result.lastInsertRowid,
      `Creación de usuario: ${nombre} (${rol})`,
      req
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      nombre,
      documento,
      rol,
      activo: 1,
      debe_cambiar_password: 1
    });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error interno al crear usuario.' });
  }
});

// GET /api/configuracion/auditoria (Solo Admin)
router.get('/auditoria', requireRole('ADMIN'), (req, res) => {
  const logs = db.prepare(`
    SELECT la.id, la.usuario_id, la.accion, la.entidad, la.entidad_id, la.detalles, la.ip, la.fecha,
           u.nombre as usuario_nombre, u.rol as usuario_rol
    FROM log_auditoria la
    LEFT JOIN usuarios u ON u.id = la.usuario_id
    ORDER BY la.id DESC LIMIT 200
  `).all();

  res.json(logs);
});

module.exports = router;
