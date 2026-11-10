const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function getIo(req) {
  return req.app.get('io');
}

// GET /api/configuracion/niveles (Público autenticado)
router.get('/niveles', (req, res) => {
  const niveles = db.prepare('SELECT * FROM niveles_triage ORDER BY nivel ASC').all();
  res.json(niveles);
});

// PUT /api/configuracion/niveles/:nivel (Editar tiempos de Triage III, IV o V - Admin)
router.put('/niveles/:nivel', requireRole('ADMIN'), (req, res) => {
  const nivel = parseInt(req.params.nivel, 10);
  const { minutos_max } = req.body;

  if (nivel === 1 || nivel === 2) {
    return res.status(400).json({
      error: 'Según la Resolución 5596 de 2015, los tiempos de Triage I (Inmediato) y Triage II (máx 30 min) son de cumplimiento normativo estricto y no pueden ser modificados institucionalmente.'
    });
  }

  const minutos = parseInt(minutos_max, 10);
  if (!minutos || minutos <= 0) {
    return res.status(400).json({ error: 'Los minutos máximos deben ser un entero positivo.' });
  }

  const row = db.prepare('SELECT * FROM niveles_triage WHERE nivel = ?').get(nivel);
  if (!row) {
    return res.status(404).json({ error: 'Nivel no encontrado.' });
  }

  try {
    db.prepare('UPDATE niveles_triage SET minutos_max = ? WHERE nivel = ?').run(minutos, nivel);

    registrarAuditoria(
      req.user.id,
      'MODIFICAR_TIEMPO_TRIAGE',
      'NIVELES_TRIAGE',
      nivel,
      `Modificación de tiempo máximo para ${row.nombre}: de ${row.minutos_max} min a ${minutos} min`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('config:niveles_actualizados', {
        nivel,
        minutos_max: minutos
      });
    }

    res.json({
      message: `Tiempo de espera para ${row.nombre} actualizado a ${minutos} minutos.`,
      nivel,
      minutos_max: minutos
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar nivel: ' + err.message });
  }
});

// GET /api/configuracion/emergencia (Estado del Modo Emergencia)
router.get('/emergencia', (req, res) => {
  const conf = db.prepare("SELECT valor, descripcion, actualizado_en FROM configuracion WHERE clave = 'modo_emergencia'").get();
  res.json({
    modo_emergencia: conf ? conf.valor === '1' : false,
    descripcion: conf ? conf.descripcion : '',
    actualizado_en: conf ? conf.actualizado_en : null
  });
});

// POST /api/configuracion/emergencia (Activar/Desactivar Modo Desastre/Múltiples Víctimas - Admin o Médico)
router.post('/emergencia', requireRole('ADMIN', 'MEDICO'), (req, res) => {
  const { activo } = req.body;
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
      `Modo Emergencia / Desastre con múltiples víctimas ${nuevoValor === '1' ? 'ACTIVADO' : 'DESACTIVADO'} por ${req.user.nombre}`,
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
    res.status(500).json({ error: 'Error al cambiar modo de emergencia: ' + err.message });
  }
});

// GET /api/configuracion/usuarios (Solo Admin)
router.get('/usuarios', requireRole('ADMIN'), (req, res) => {
  const usuarios = db.prepare('SELECT id, nombre, documento, rol, activo, creado_en FROM usuarios ORDER BY id ASC').all();
  res.json(usuarios);
});

// POST /api/configuracion/usuarios (Crear usuario - Solo Admin)
router.post('/usuarios', requireRole('ADMIN'), (req, res) => {
  const { nombre, documento, rol, password } = req.body;

  if (!nombre || !documento || !rol || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios (nombre, documento, rol, password).' });
  }

  const rolesPermitidos = ['ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'];
  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({ error: `Rol no válido. Permitidos: ${rolesPermitidos.join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM usuarios WHERE documento = ?').get(String(documento).trim());
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese documento.' });
  }

  try {
    const password_hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO usuarios (nombre, documento, rol, password_hash, activo)
      VALUES (?, ?, ?, ?, 1)
    `);

    const result = stmt.run(nombre.trim(), String(documento).trim(), rol, password_hash);

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
      nombre: nombre.trim(),
      documento: String(documento).trim(),
      rol,
      activo: 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario: ' + err.message });
  }
});

// GET /api/configuracion/auditoria (Solo Admin)
router.get('/auditoria', requireRole('ADMIN'), (req, res) => {
  const logs = db.prepare(`
    SELECT la.*, u.nombre as usuario_nombre, u.rol as usuario_rol
    FROM log_auditoria la
    LEFT JOIN usuarios u ON u.id = la.usuario_id
    ORDER BY la.id DESC LIMIT 200
  `).all();

  res.json(logs);
});

module.exports = router;

