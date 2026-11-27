const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');
const {
  pacienteCreateSchema,
  pacienteUpdateSchema,
  validateBody,
  validateIdParam
} = require('../middleware/validate');

const router = express.Router();
router.use(authenticateToken);

// GET /api/pacientes?q=...
router.get('/', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';

  if (rawQ.length > 0) {
    const term = `%${rawQ}%`;
    const patients = db.prepare(`
      SELECT id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo, eps
      FROM pacientes
      WHERE numero_documento LIKE ?
         OR nombres LIKE ?
         OR apellidos LIKE ?
      ORDER BY id DESC LIMIT 50
    `).all(term, term, term);
    return res.json(patients);
  }

  const patients = db.prepare(`
    SELECT id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo, eps
    FROM pacientes
    ORDER BY id DESC LIMIT 50
  `).all();
  res.json(patients);
});

// GET /api/pacientes/:id
router.get('/:id', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), validateIdParam('id'), (req, res) => {
  const patientId = req.validatedParams.id;
  const patient = db.prepare(`
    SELECT id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo,
           telefono, direccion, eps, acudiente_nombre, acudiente_telefono, creado_en
    FROM pacientes
    WHERE id = ?
  `).get(patientId);

  if (!patient) {
    return res.status(404).json({ error: 'Paciente no encontrado.' });
  }

  const ingresos = db.prepare(`
    SELECT i.id, i.consecutivo, i.fecha_llegada, i.motivo_consulta, i.estado,
           t.nivel as triage_nivel,
           nt.nombre as triage_nombre,
           nt.codigo_color as triage_color,
           t.fecha_clasificacion,
           c.tipo as conducta_tipo,
           c.descripcion as conducta_descripcion,
           u.nombre as admisionado_por_nombre
    FROM ingresos i
    LEFT JOIN triage t ON t.ingreso_id = i.id
    LEFT JOIN niveles_triage nt ON nt.nivel = t.nivel
    LEFT JOIN conductas c ON c.ingreso_id = i.id
    LEFT JOIN usuarios u ON u.id = i.admisionado_por
    WHERE i.paciente_id = ?
    ORDER BY i.fecha_llegada DESC
  `).all(patient.id);

  res.json({ ...patient, ingresos });
});

// POST /api/pacientes (Solo Administrativo o Admin)
router.post('/', requireRole('ADMINISTRATIVO', 'ADMIN'), validateBody(pacienteCreateSchema), (req, res) => {
  const data = req.validatedBody;

  const existing = db.prepare('SELECT id FROM pacientes WHERE numero_documento = ?').get(data.numero_documento);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un paciente registrado con ese documento.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO pacientes (
        tipo_documento, numero_documento, nombres, apellidos,
        fecha_nacimiento, sexo, telefono, direccion, eps,
        acudiente_nombre, acudiente_telefono
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.tipo_documento,
      data.numero_documento,
      data.nombres,
      data.apellidos,
      data.fecha_nacimiento,
      data.sexo,
      data.telefono,
      data.direccion,
      data.eps,
      data.acudiente_nombre,
      data.acudiente_telefono
    );

    const newPatient = db.prepare(`
      SELECT id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo,
             telefono, direccion, eps, acudiente_nombre, acudiente_telefono
      FROM pacientes WHERE id = ?
    `).get(result.lastInsertRowid);

    registrarAuditoria(
      req.user.id,
      'CREAR_PACIENTE',
      'PACIENTES',
      newPatient.id,
      `Creación de paciente ID ${newPatient.id}`,
      req
    );

    res.status(201).json(newPatient);
  } catch (err) {
    console.error('Error al registrar paciente:', err);
    res.status(500).json({ error: 'Error interno al registrar el paciente.' });
  }
});

// PUT /api/pacientes/:id (Solo Administrativo o Admin)
router.put('/:id', requireRole('ADMINISTRATIVO', 'ADMIN'), validateIdParam('id'), validateBody(pacienteUpdateSchema), (req, res) => {
  const patientId = req.validatedParams.id;
  const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(patientId);
  if (!patient) {
    return res.status(404).json({ error: 'Paciente no encontrado.' });
  }

  const data = req.validatedBody;

  if (data.numero_documento && data.numero_documento !== patient.numero_documento) {
    const existing = db.prepare('SELECT id FROM pacientes WHERE numero_documento = ? AND id != ?').get(data.numero_documento, patient.id);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe otro paciente con ese documento.' });
    }
  }

  try {
    db.prepare(`
      UPDATE pacientes SET
        tipo_documento = COALESCE(?, tipo_documento),
        numero_documento = COALESCE(?, numero_documento),
        nombres = COALESCE(?, nombres),
        apellidos = COALESCE(?, apellidos),
        fecha_nacimiento = COALESCE(?, fecha_nacimiento),
        sexo = COALESCE(?, sexo),
        telefono = ?,
        direccion = ?,
        eps = COALESCE(?, eps),
        acudiente_nombre = ?,
        acudiente_telefono = ?
      WHERE id = ?
    `).run(
      data.tipo_documento ?? null,
      data.numero_documento ?? null,
      data.nombres ?? null,
      data.apellidos ?? null,
      data.fecha_nacimiento ?? null,
      data.sexo ?? null,
      data.telefono !== undefined ? data.telefono : patient.telefono,
      data.direccion !== undefined ? data.direccion : patient.direccion,
      data.eps ?? null,
      data.acudiente_nombre !== undefined ? data.acudiente_nombre : patient.acudiente_nombre,
      data.acudiente_telefono !== undefined ? data.acudiente_telefono : patient.acudiente_telefono,
      patient.id
    );

    const updated = db.prepare(`
      SELECT id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo,
             telefono, direccion, eps, acudiente_nombre, acudiente_telefono
      FROM pacientes WHERE id = ?
    `).get(patient.id);

    registrarAuditoria(req.user.id, 'ACTUALIZAR_PACIENTE', 'PACIENTES', patient.id, `Actualización de paciente ID ${patient.id}`, req);

    res.json(updated);
  } catch (err) {
    console.error('Error al actualizar paciente:', err);
    res.status(500).json({ error: 'Error interno al actualizar paciente.' });
  }
});

module.exports = router;
