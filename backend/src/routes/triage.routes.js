const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');
const {
  triageCreateSchema,
  reclasificarSchema,
  validateBody,
  validateIdParam
} = require('../middleware/validate');

const router = express.Router();
router.use(authenticateToken);

function getIo(req) {
  return req.app.get('io');
}

// POST /api/triage (Clasificar paciente - Rol: ENFERMERO, MEDICO, ADMIN)
router.post('/', requireRole('ENFERMERO', 'MEDICO', 'ADMIN'), validateBody(triageCreateSchema), (req, res) => {
  const data = req.validatedBody;

  const ingreso = db.prepare('SELECT * FROM ingresos WHERE id = ?').get(data.ingreso_id);
  if (!ingreso) {
    return res.status(404).json({ error: 'Ingreso no encontrado.' });
  }

  if (ingreso.estado !== 'EN_ESPERA_TRIAGE') {
    return res.status(400).json({ error: `El ingreso ya fue clasificado previamente (Estado actual: ${ingreso.estado}).` });
  }

  const classifyTx = db.transaction(() => {
    const insertTriage = db.prepare(`
      INSERT INTO triage (
        ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertTriage.run(
      ingreso.id,
      data.nivel,
      data.fc,
      data.fr,
      data.pas,
      data.pad,
      data.temperatura,
      data.spo2,
      data.dolor,
      data.estado_conciencia,
      data.observaciones,
      req.user.id
    );

    db.prepare(`UPDATE ingresos SET estado = 'CLASIFICADO' WHERE id = ?`).run(ingreso.id);

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
      `Clasificación asignada: Triage ${data.nivel} (${createdTriage.consecutivo})`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('triage:clasificado', {
        ingreso_id: ingreso.id,
        triage: createdTriage
      });
    }

    res.status(201).json(createdTriage);
  } catch (err) {
    console.error('Error al registrar triage:', err);
    res.status(500).json({ error: 'Error interno al registrar valoración de triage.' });
  }
});

// POST /api/triage/:ingresoId/reclasificar (Solo Médico o Admin)
router.post('/:ingresoId/reclasificar', requireRole('MEDICO', 'ADMIN'), validateIdParam('ingresoId'), validateBody(reclasificarSchema), (req, res) => {
  const ingresoId = req.validatedParams.ingresoId;
  const { nivel_nuevo, motivo } = req.validatedBody;

  const currentTriage = db.prepare('SELECT * FROM triage WHERE ingreso_id = ?').get(ingresoId);
  if (!currentTriage) {
    return res.status(404).json({ error: 'No existe una clasificación previa de triage para este ingreso.' });
  }

  if (currentTriage.nivel === nivel_nuevo) {
    return res.status(400).json({ error: `El paciente ya se encuentra clasificado en Triage ${nivel_nuevo}.` });
  }

  const nivelAnterior = currentTriage.nivel;

  const reclassifyTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO historial_reclasificaciones (
        triage_id, ingreso_id, nivel_anterior, nivel_nuevo, motivo, reclasificado_por
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(currentTriage.id, ingresoId, nivelAnterior, nivel_nuevo, motivo, req.user.id);

    db.prepare(`
      UPDATE triage
      SET nivel = ?,
          observaciones = observaciones || ' | [RECLASIFICADO por ' || ? || ' a Triage ' || ? || ': ' || ? || ']'
      WHERE id = ?
    `).run(nivel_nuevo, req.user.nombre, nivel_nuevo, motivo, currentTriage.id);
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
      `Reclasificación de Triage ${nivelAnterior} -> Triage ${nivel_nuevo}. Motivo: ${motivo}`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('triage:reclasificado', {
        ingreso_id: ingresoId,
        nivel_anterior: nivelAnterior,
        nivel_nuevo,
        motivo,
        triage: updated
      });
    }

    res.json({
      message: 'Paciente reclasificado exitosamente.',
      nivel_anterior: nivelAnterior,
      nivel_nuevo,
      triage: updated
    });
  } catch (err) {
    console.error('Error al reclasificar triage:', err);
    res.status(500).json({ error: 'Error interno al reclasificar triage.' });
  }
});

module.exports = router;
