const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function getIo(req) {
  return req.app.get('io');
}

// POST /api/atencion/:ingresoId/iniciar (Iniciar atención médica - DETIENE EL CRONÓMETRO)
router.post('/:ingresoId/iniciar', requireRole('MEDICO', 'ADMIN'), (req, res) => {
  const ingresoId = req.params.ingresoId;

  const ingreso = db.prepare('SELECT * FROM ingresos WHERE id = ?').get(ingresoId);
  if (!ingreso) {
    return res.status(404).json({ error: 'Ingreso no encontrado.' });
  }

  if (ingreso.estado !== 'CLASIFICADO') {
    return res.status(400).json({ error: `El ingreso se encuentra en estado ${ingreso.estado}, no puede iniciarse atención.` });
  }

  try {
    db.prepare(`
      UPDATE ingresos 
      SET estado = 'EN_ATENCION',
          fecha_inicio_atencion = datetime('now', 'localtime')
      WHERE id = ?
    `).run(ingresoId);

    const updated = db.prepare(`
      SELECT i.*, p.nombres, p.apellidos, p.tipo_documento, p.numero_documento,
             t.nivel, nt.nombre as nivel_nombre, nt.codigo_color
      FROM ingresos i
      JOIN pacientes p ON p.id = i.paciente_id
      LEFT JOIN triage t ON t.ingreso_id = i.id
      LEFT JOIN niveles_triage nt ON nt.nivel = t.nivel
      WHERE i.id = ?
    `).get(ingresoId);

    registrarAuditoria(
      req.user.id,
      'INICIO_ATENCION_MEDICA',
      'INGRESOS',
      ingresoId,
      `Inicio de atención por médico ${req.user.nombre}. Cronómetro de espera detenido.`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('atencion:iniciada', {
        ingreso_id: ingresoId,
        fecha_inicio_atencion: updated.fecha_inicio_atencion,
        medico: req.user.nombre,
        ingreso: updated
      });
    }

    res.json({
      message: 'Atención médica iniciada. El cronómetro de espera ha sido detenido.',
      ingreso: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar atención médica: ' + err.message });
  }
});

// POST /api/atencion/:ingresoId/conducta (Definir conducta médica y cerrar ingreso)
router.post('/:ingresoId/conducta', requireRole('MEDICO', 'ADMIN'), (req, res) => {
  const ingresoId = req.params.ingresoId;
  const { tipo, descripcion, destino } = req.body;

  const tiposPermitidos = [
    'ATENDER_URGENCIAS',
    'SOLICITAR_EXAMENES',
    'HOSPITALIZAR',
    'REMITIR',
    'DERIVAR_CONSULTA',
    'ALTA_MEDICA'
  ];

  if (!tipo || !tiposPermitidos.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo de conducta médica inválido. Permitidos: ${tiposPermitidos.join(', ')}`
    });
  }

  if (!descripcion || descripcion.trim().length === 0) {
    return res.status(400).json({ error: 'La descripción clínica y justificación de la conducta son obligatorias.' });
  }

  const ingreso = db.prepare('SELECT * FROM ingresos WHERE id = ?').get(ingresoId);
  if (!ingreso) {
    return res.status(404).json({ error: 'Ingreso no encontrado.' });
  }

  if (ingreso.estado === 'CERRADO') {
    return res.status(400).json({ error: 'Este ingreso ya se encuentra cerrado con conducta médica previa.' });
  }

  const conductaTx = db.transaction(() => {
    // Si no se había marcado inicio de atención, se registra ahora
    const fechaInicio = ingreso.fecha_inicio_atencion || db.prepare("SELECT datetime('now', 'localtime') as now").get().now;

    // 1. Insertar la conducta
    const insertConducta = db.prepare(`
      INSERT INTO conductas (ingreso_id, tipo, descripcion, destino, medico_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertConducta.run(
      ingresoId,
      tipo,
      descripcion.trim(),
      destino ? destino.trim() : null,
      req.user.id
    );

    // 2. Cerrar el ingreso
    db.prepare(`
      UPDATE ingresos 
      SET estado = 'CERRADO',
          fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, ?),
          fecha_cierre = datetime('now', 'localtime')
      WHERE id = ?
    `).run(fechaInicio, ingresoId);
  });

  try {
    conductaTx();

    const conductaRegistrada = db.prepare(`
      SELECT c.*, u.nombre as medico_nombre,
             i.consecutivo, p.nombres, p.apellidos
      FROM conductas c
      JOIN usuarios u ON u.id = c.medico_id
      JOIN ingresos i ON i.id = c.ingreso_id
      JOIN pacientes p ON p.id = i.paciente_id
      WHERE c.ingreso_id = ?
    `).get(ingresoId);

    registrarAuditoria(
      req.user.id,
      'DEFINIR_CONDUCTA_MEDICA',
      'CONDUCTAS',
      ingresoId,
      `Conducta médica: ${tipo} para paciente ${conductaRegistrada.nombres} ${conductaRegistrada.apellidos}. ${descripcion.trim()}`,
      req
    );

    const io = getIo(req);
    if (io) {
      io.emit('atencion:cerrada', {
        ingreso_id: ingresoId,
        conducta: conductaRegistrada
      });
    }

    res.json({
      message: 'Conducta médica definida exitosamente y el ingreso ha sido cerrado.',
      conducta: conductaRegistrada
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al definir conducta médica: ' + err.message });
  }
});

// GET /api/atencion/mis-pacientes (Pacientes atendidos por el médico actual)
router.get('/mis-pacientes', requireRole('MEDICO', 'ADMIN'), (req, res) => {
  const pacientes = db.prepare(`
    SELECT i.*, 
           p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.sexo, p.eps,
           t.nivel as triage_nivel, nt.nombre as triage_nombre, nt.codigo_color as triage_color,
           c.tipo as conducta_tipo, c.descripcion as conducta_descripcion, c.destino as conducta_destino, c.fecha_conducta
    FROM ingresos i
    JOIN pacientes p ON p.id = i.paciente_id
    LEFT JOIN triage t ON t.ingreso_id = i.id
    LEFT JOIN niveles_triage nt ON nt.nivel = t.nivel
    LEFT JOIN conductas c ON c.ingreso_id = i.id
    WHERE (c.medico_id = ? OR i.estado = 'EN_ATENCION')
    ORDER BY i.fecha_llegada DESC
  `).all(req.user.id);

  res.json(pacientes);
});

// GET /api/atencion/historial (Historial general de atenciones y tiempos de respuesta)
router.get('/historial', (req, res) => {
  const historial = db.prepare(`
    SELECT i.id, i.consecutivo, i.fecha_llegada, i.fecha_inicio_atencion, i.fecha_cierre, i.estado,
           p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.eps,
           t.nivel as triage_nivel, nt.nombre as triage_nombre, nt.codigo_color as triage_color, nt.minutos_max,
           t.fecha_clasificacion,
           u_enf.nombre as clasificado_por,
           c.tipo as conducta_tipo, c.descripcion as conducta_descripcion, c.destino as conducta_destino,
           u_med.nombre as atendido_por,
           -- Tiempo total de espera en minutos desde triage hasta inicio de atención
           CAST(
             (julianday(COALESCE(i.fecha_inicio_atencion, i.fecha_cierre, 'now', 'localtime')) - 
              julianday(t.fecha_clasificacion)) * 24 * 60 AS INTEGER
           ) as minutos_espera_atencion
    FROM ingresos i
    JOIN pacientes p ON p.id = i.paciente_id
    LEFT JOIN triage t ON t.ingreso_id = i.id
    LEFT JOIN niveles_triage nt ON nt.nivel = t.nivel
    LEFT JOIN usuarios u_enf ON u_enf.id = t.clasificado_por
    LEFT JOIN conductas c ON c.ingreso_id = i.id
    LEFT JOIN usuarios u_med ON u_med.id = c.medico_id
    ORDER BY i.fecha_llegada DESC LIMIT 100
  `).all();

  res.json(historial);
});

module.exports = router;

