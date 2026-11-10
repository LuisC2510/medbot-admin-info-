const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/pacientes?q=...
router.get('/', (req, res) => {
  const { q } = req.query;

  if (q && q.trim().length > 0) {
    const term = `%${q.trim()}%`;
    const patients = db.prepare(`
      SELECT * FROM pacientes 
      WHERE numero_documento LIKE ? 
         OR nombres LIKE ? 
         OR apellidos LIKE ?
      ORDER BY id DESC LIMIT 50
    `).all(term, term, term);
    return res.json(patients);
  }

  const patients = db.prepare('SELECT * FROM pacientes ORDER BY id DESC LIMIT 50').all();
  res.json(patients);
});

// GET /api/pacientes/:id
router.get('/:id', (req, res) => {
  const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: 'Paciente no encontrado.' });
  }

  // Obtener historial de ingresos con su triage correspondiente
  const ingresos = db.prepare(`
    SELECT i.*, 
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

// POST /api/pacientes (Crear nuevo paciente - Administrativo o Admin)
router.post('/', requireRole('ADMINISTRATIVO', 'ADMIN'), (req, res) => {
  const {
    tipo_documento,
    numero_documento,
    nombres,
    apellidos,
    fecha_nacimiento,
    sexo,
    telefono,
    direccion,
    eps,
    acudiente_nombre,
    acudiente_telefono
  } = req.body;

  // Validaciones
  const tiposPermitidos = ['CC', 'TI', 'RC', 'CE', 'PA', 'PEP', 'PPT'];
  if (!tipo_documento || !tiposPermitidos.includes(tipo_documento)) {
    return res.status(400).json({ error: 'Tipo de documento no válido.' });
  }

  if (!numero_documento || String(numero_documento).trim().length === 0) {
    return res.status(400).json({ error: 'El número de documento es obligatorio.' });
  }

  if (!nombres || !apellidos) {
    return res.status(400).json({ error: 'Los nombres y apellidos son obligatorios.' });
  }

  if (!fecha_nacimiento) {
    return res.status(400).json({ error: 'La fecha de nacimiento es obligatoria.' });
  }

  if (!['M', 'F', 'OTRO'].includes(sexo)) {
    return res.status(400).json({ error: 'El sexo debe ser M, F u OTRO.' });
  }

  if (!eps || String(eps).trim().length === 0) {
    return res.status(400).json({ error: 'La EPS o aseguradora es obligatoria.' });
  }

  // Verificar si ya existe el paciente por número de documento
  const existing = db.prepare('SELECT id FROM pacientes WHERE numero_documento = ?').get(String(numero_documento).trim());
  if (existing) {
    return res.status(409).json({ error: `Ya existe un paciente registrado con el documento ${numero_documento}.` });
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
      tipo_documento,
      String(numero_documento).trim(),
      String(nombres).trim(),
      String(apellidos).trim(),
      fecha_nacimiento,
      sexo,
      telefono ? String(telefono).trim() : null,
      direccion ? String(direccion).trim() : null,
      String(eps).trim(),
      acudiente_nombre ? String(acudiente_nombre).trim() : null,
      acudiente_telefono ? String(acudiente_telefono).trim() : null
    );

    const newPatient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(result.lastInsertRowid);

    registrarAuditoria(req.user.id, 'CREAR_PACIENTE', 'PACIENTES', newPatient.id, `Creación de paciente: ${newPatient.nombres} ${newPatient.apellidos} (${newPatient.tipo_documento} ${newPatient.numero_documento})`, req);

    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar el paciente: ' + err.message });
  }
});

// PUT /api/pacientes/:id (Editar paciente)
router.put('/:id', requireRole('ADMINISTRATIVO', 'ADMIN'), (req, res) => {
  const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: 'Paciente no encontrado.' });
  }

  const {
    tipo_documento,
    numero_documento,
    nombres,
    apellidos,
    fecha_nacimiento,
    sexo,
    telefono,
    direccion,
    eps,
    acudiente_nombre,
    acudiente_telefono
  } = req.body;

  // Si cambia el documento, verificar que no colisione
  if (numero_documento && numero_documento !== patient.numero_documento) {
    const existing = db.prepare('SELECT id FROM pacientes WHERE numero_documento = ? AND id != ?').get(numero_documento, patient.id);
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
      tipo_documento,
      numero_documento,
      nombres,
      apellidos,
      fecha_nacimiento,
      sexo,
      telefono !== undefined ? telefono : patient.telefono,
      direccion !== undefined ? direccion : patient.direccion,
      eps,
      acudiente_nombre !== undefined ? acudiente_nombre : patient.acudiente_nombre,
      acudiente_telefono !== undefined ? acudiente_telefono : patient.acudiente_telefono,
      patient.id
    );

    const updated = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(patient.id);

    registrarAuditoria(req.user.id, 'ACTUALIZAR_PACIENTE', 'PACIENTES', patient.id, `Actualización de datos del paciente ID ${patient.id}`, req);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar paciente: ' + err.message });
  }
});

module.exports = router;

