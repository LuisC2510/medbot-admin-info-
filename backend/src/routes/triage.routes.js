const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function getIo(req) {
  return req.app.get('io');
}

// POST /api/triage (Clasificar paciente - Rol: ENFERMERO, MEDICO, ADMIN)
router.post('/', requireRole('ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const {
    ingreso_id,
    nivel,
    fc,
    fr,
    pas,
    pad,
    temperatura,
    spo2,
    dolor,
    estado_conciencia,
    observaciones
  } = req.body;

  if (!ingreso_id) {
    return res.status(400).json({ error: 'El ID de ingreso es obligatorio.' });
  }

  const ingreso = db.prepare('SELECT * FROM ingresos WHERE id = ?').get(ingreso_id);
  if (!ingreso) {
    return res.status(404).json({ error: 'Ingreso no encontrado.' });
  }

  if (ingreso.estado !== 'EN_ESPERA_TRIAGE') {
    return res.status(400).json({ error: `El ingreso ya fue clasificado previamente (Estado actual: ${ingreso.estado}).` });
  }

  const nivelNum = parseInt(nivel, 10);
  if (!nivelNum || nivelNum < 1 || nivelNum > 5) {
    return res.status(400).json({ error: 'El nivel de triage debe ser un número entre 1 y 5 según Resolución 5596/2015.' });
  }

  if (!observaciones || observaciones.trim().length === 0) {
    return res.status(400).json({ error: 'Las observaciones clínicas de la valoración son obligatorias.' });
  }

  // Validación de dolor 0-10
  if (dolor !== undefined && dolor !== null && (dolor < 0 || dolor > 10)) {
    return res.status(400).json({ error: 'La escala de dolor EVA debe estar entre 0 y 10.' });
  }

  // Transacción para garantizar atomicidad
  const classifyTx = db.transaction(() => {
    // 1. Insertar valoración de triage con timestamp actual
    const insertTriage = db.prepare(`
      INSERT INTO triage (
        ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertTriage.run(
      ingreso.id,
      nivelNum,
      fc ? parseInt(fc, 10) : null,
      fr ? parseInt(fr, 10) : null,
      pas ? parseInt(pas, 10) : null,
      pad ? parseInt(pad, 10) : null,
      temperatura ? parseFloat(temperatura) : null,
      spo2 ? parseInt(spo2, 10) : null,
      dolor !== undefined && dolor !== '' ? parseInt(dolor, 10) : null,
      estado_conciencia || 'Alerta',
      observaciones.trim(),
      req.user.id
    );

    // 2. Actualizar estado del ingreso a CLASIFICADO
    db.prepare(`
      UPDATE ingresos 
      SET estado = 'CLASIFICADO'
      WHERE id = ?
    `).run(ingreso.id);

    return result.lastInsertRowid;
  });

  try {
    const triageId = classifyTx();

    const createdTriage = db.prepare(`
      SELECT t.*, nt.nombre as nivel_nombre, nt.color, nt.codigo_color, nt.minutos_max,
             u.nombre as clasificado_por_nombre,
             i.consecutivo, p.nombres, p.apellidos
      FROM triage t
      JOIN niveles_triage nt ON nt.nivel = t.nivel
      JOIN usuarios u ON u.id = t.clasificado_por
      JOIN ingresos i ON i.id = t.ingreso_id
      JOIN pacientes p ON p.id = i.paciente_id
      WHERE t.id = ?
    `).get(triageId);

    registrarAuditoria(
      req.user.id,
      'CLASIFICACION_TRIAGE',
      'TRIAGE',
      triageId,
      `Clasificación asignada: Triage ${nivelNum} a paciente ${createdTriage.nombres} ${createdTriage.apellidos} (${createdTriage.consecutivo})`,
      req
    );

    // Emitir por WebSocket para refrescar cola de enfermería y tablero en tiempo real
    const io = getIo(req);
    if (io) {
      io.emit('triage:clasificado', {
        ingreso_id: ingreso.id,
        triage: createdTriage
      });
    }

    res.status(201).json(createdTriage);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar valoración de triage: ' + err.message });
  }
});

// POST /api/triage/:ingresoId/reclasificar (Reclasificar Triage - Solo Médico o Admin)
router.post('/:ingresoId/reclasificar', requireRole('MEDICO', 'ADMIN'), (req, res) => {
  const ingresoId = req.params.ingresoId;
  const { nivel_nuevo, motivo } = req.body;

  const nuevoNivelNum = parseInt(nivel_nuevo, 10);
  if (!nuevoNivelNum || nuevoNivelNum < 1 || nuevoNivelNum > 5) {
    return res.status(400).json({ error: 'El nuevo nivel de triage debe estar entre 1 y 5.' });
  }

  if (!motivo || motivo.trim().length === 0) {
    return res.status(400).json({ error: 'El motivo clínico de la reclasificación es estrictamente obligatorio.' });
  }

  const currentTriage = db.prepare('SELECT * FROM triage WHERE ingreso_id = ?').get(ingresoId);
  if (!currentTriage) {
    return res.status(404).json({ error: 'No existe una clasificación previa de triage para este ingreso.' });
  }

  if (currentTriage.nivel === nuevoNivelNum) {
    return res.status(400).json({ error: `El paciente ya se encuentra clasificado en Triage ${nuevoNivelNum}.` });
  }

  const nivelAnterior = currentTriage.nivel;

  const reclassifyTx = db.transaction(() => {
    // 1. Registrar en historial de reclasificaciones
    const histStmt = db.prepare(`
      INSERT INTO historial_reclasificaciones (
        triage_id, ingreso_id, nivel_anterior, nivel_nuevo, motivo, reclasificado_por
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    histStmt.run(
      currentTriage.id,
      ingresoId,
      nivelAnterior,
      nuevoNivelNum,
      motivo.trim(),
      req.user.id
    );

    // 2. Actualizar el nivel actual en la tabla triage
    db.prepare(`
      UPDATE triage 
      SET nivel = ?,
          observaciones = observaciones || ' | [RECLASIFICADO por ' || ? || ' a Triage ' || ? || ': ' || ? || ']'
      WHERE id = ?
    `).run(
      nuevoNivelNum,
      req.user.nombre,
      nuevoNivelNum,
      motivo.trim(),
      currentTriage.id
    );
  });

  try {
    reclassifyTx();

    const updated = db.prepare(`
      SELECT t.*, nt.nombre as nivel_nombre, nt.codigo_color as color, nt.minutos_max,
             i.consecutivo, p.nombres, p.apellidos
      FROM triage t
      JOIN niveles_triage nt ON nt.nivel = t.nivel
      JOIN ingresos i ON i.id = t.ingreso_id
      JOIN pacientes p ON p.id = i.paciente_id
      WHERE t.id = ?
    `).get(currentTriage.id);

    registrarAuditoria(
      req.user.id,
      'RECLASIFICACION_TRIAGE',
      'TRIAGE',
      currentTriage.id,
      `Reclasificación de Triage ${nivelAnterior} -> Triage ${nuevoNivelNum}. Motivo: ${motivo.trim()}`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('triage:reclasificado', {
        ingreso_id: ingresoId,
        nivel_anterior: nivelAnterior,
        nivel_nuevo: nuevoNivelNum,
        motivo: motivo.trim(),
        triage: updated
      });
    }

    res.json({
      message: 'Paciente reclasificado exitosamente.',
      nivel_anterior: nivelAnterior,
      nivel_nuevo: nuevoNivelNum,
      triage: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al reclasificar triage: ' + err.message });
  }
});

module.exports = router;

