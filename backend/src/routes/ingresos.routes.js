const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole, registrarAuditoria } = require('../middleware/auth');
const { ingresoCreateSchema, validateBody, validateIdParam } = require('../middleware/validate');

const router = express.Router();
router.use(authenticateToken);

function getIo(req) {
  return req.app.get('io');
}

// POST /api/ingresos (Solo Administrativo o Admin)
router.post('/', requireRole('ADMINISTRATIVO', 'ADMIN'), validateBody(ingresoCreateSchema), (req, res) => {
  const { paciente_id, motivo_consulta, acompanante } = req.validatedBody;

  const paciente = db.prepare('SELECT id, nombres, apellidos, tipo_documento, numero_documento FROM pacientes WHERE id = ?').get(paciente_id);
  if (!paciente) {
    return res.status(404).json({ error: 'Paciente no encontrado.' });
  }

  const activo = db.prepare(`
    SELECT id, consecutivo, estado FROM ingresos
    WHERE paciente_id = ? AND estado != 'CERRADO'
  `).get(paciente_id);

  if (activo) {
    return res.status(409).json({
      error: `El paciente ya tiene un ingreso activo (${activo.consecutivo}) en estado ${activo.estado}.`
    });
  }

  try {
    const currentYear = new Date().getFullYear();
    const countRow = db.prepare('SELECT COUNT(*) as total FROM ingresos WHERE consecutivo LIKE ?').get(`URG-${currentYear}-%`);
    const nextNumber = String(countRow.total + 1).padStart(4, '0');
    const consecutivo = `URG-${currentYear}-${nextNumber}`;

    const stmt = db.prepare(`
      INSERT INTO ingresos (consecutivo, paciente_id, motivo_consulta, acompanante, estado, admisionado_por)
      VALUES (?, ?, ?, ?, 'EN_ESPERA_TRIAGE', ?)
    `);

    const result = stmt.run(
      consecutivo,
      paciente_id,
      motivo_consulta,
      acompanante,
      req.user.id
    );

    const nuevoIngreso = db.prepare(`
      SELECT i.id, i.consecutivo, i.paciente_id, i.fecha_llegada, i.motivo_consulta, i.acompanante, i.estado,
             p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.fecha_nacimiento, p.sexo, p.eps,
             u.nombre as admisionado_por_nombre
      FROM ingresos i
      JOIN pacientes p ON p.id = i.paciente_id
      JOIN usuarios u ON u.id = i.admisionado_por
      WHERE i.id = ?
    `).get(result.lastInsertRowid);

    registrarAuditoria(req.user.id, 'CREAR_INGRESO', 'INGRESOS', nuevoIngreso.id, `Admisión creada: ${consecutivo}`, req);

    const io = getIo(req);
    if (io) {
      io.emit('ingreso:creado', nuevoIngreso);
    }

    res.status(201).json(nuevoIngreso);
  } catch (err) {
    console.error('Error al registrar ingreso:', err);
    res.status(500).json({ error: 'Error interno al registrar ingreso.' });
  }
});

// GET /api/ingresos/hoy
router.get('/hoy', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const ingresos = db.prepare(`
    SELECT i.id, i.consecutivo, i.paciente_id, i.fecha_llegada, i.motivo_consulta, i.estado,
           p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.sexo, p.fecha_nacimiento, p.eps,
           t.nivel as triage_nivel,
           nt.nombre as triage_nombre,
           nt.codigo_color as triage_color,
           u.nombre as admisionado_por_nombre
    FROM ingresos i
    JOIN pacientes p ON p.id = i.paciente_id
    JOIN usuarios u ON u.id = i.admisionado_por
    LEFT JOIN triage t ON t.ingreso_id = i.id
    LEFT JOIN niveles_triage nt ON nt.nivel = t.nivel
    WHERE date(i.fecha_llegada) = date('now', 'localtime')
    ORDER BY i.fecha_llegada DESC
  `).all();

  res.json(ingresos);
});

// GET /api/ingresos/cola-triage (Enfermero, Médico o Admin)
router.get('/cola-triage', requireRole('ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const cola = db.prepare(`
    SELECT i.id, i.consecutivo, i.paciente_id, i.fecha_llegada, i.motivo_consulta, i.acompanante, i.estado,
           p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.fecha_nacimiento, p.sexo, p.eps, p.telefono,
           u.nombre as admisionado_por_nombre,
           CAST((julianday('now', 'localtime') - julianday(i.fecha_llegada)) * 24 * 60 AS INTEGER) as minutos_espera_triage
    FROM ingresos i
    JOIN pacientes p ON p.id = i.paciente_id
    JOIN usuarios u ON u.id = i.admisionado_por
    WHERE i.estado = 'EN_ESPERA_TRIAGE'
    ORDER BY i.fecha_llegada ASC
  `).all();

  res.json(cola);
});

// GET /api/ingresos/tablero
router.get('/tablero', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), (req, res) => {
  const confEmergencia = db.prepare("SELECT valor FROM configuracion WHERE clave = 'modo_emergencia'").get();
  const modoEmergencia = confEmergencia && confEmergencia.valor === '1';

  const filas = db.prepare(`
    SELECT i.id as ingreso_id,
           i.consecutivo,
           i.fecha_llegada,
           i.estado,
           i.motivo_consulta,
           i.fecha_inicio_atencion,
           p.id as paciente_id,
           p.nombres,
           p.apellidos,
           p.tipo_documento,
           p.numero_documento,
           p.fecha_nacimiento,
           p.sexo,
           p.eps,
           t.id as triage_id,
           t.nivel as triage_nivel,
           nt.nombre as triage_nombre,
           nt.color as triage_color_nombre,
           nt.codigo_color as triage_color,
           nt.minutos_max as triage_minutos_max,
           t.fc, t.fr, t.pas, t.pad, t.temperatura, t.spo2, t.dolor, t.estado_conciencia,
           t.observaciones as triage_observaciones,
           t.fecha_clasificacion,
           u_enf.nombre as clasificado_por_nombre,
           u_med.nombre as atendido_por_nombre,
           CAST(
             (
               julianday(COALESCE(i.fecha_inicio_atencion, 'now', 'localtime')) -
               julianday(t.fecha_clasificacion)
             ) * 86400 AS INTEGER
           ) as segundos_transcurridos,
           (SELECT COUNT(*) FROM historial_reclasificaciones hr WHERE hr.ingreso_id = i.id) as total_reclasificaciones
    FROM ingresos i
    JOIN pacientes p ON p.id = i.paciente_id
    JOIN triage t ON t.ingreso_id = i.id
    JOIN niveles_triage nt ON nt.nivel = t.nivel
    LEFT JOIN usuarios u_enf ON u_enf.id = t.clasificado_por
    LEFT JOIN conductas c ON c.ingreso_id = i.id
    LEFT JOIN usuarios u_med ON u_med.id = c.medico_id
    WHERE i.estado IN ('CLASIFICADO', 'EN_ATENCION')
    ORDER BY
      t.nivel ASC,
      t.fecha_clasificacion ASC
  `).all();

  const items = filas.map((item) => {
    const segundos = Math.max(0, item.segundos_transcurridos || 0);
    const maxSegundos = (item.triage_minutos_max || 0) * 60;

    let alerta = 'NORMAL';
    let porcentaje = 0;

    if (item.triage_nivel === 1) {
      alerta = 'INMEDIATA';
      porcentaje = 100;
    } else if (maxSegundos > 0) {
      porcentaje = Math.min(100, Math.round((segundos / maxSegundos) * 100));
      if (segundos > maxSegundos) {
        alerta = 'VENCIDO';
      } else if (segundos >= maxSegundos * 0.75) {
        alerta = 'POR_VENCER';
      }
    }

    return {
      ...item,
      segundos_transcurridos: segundos,
      porcentaje_tiempo: porcentaje,
      alerta_estado: alerta,
      detenido: item.estado === 'EN_ATENCION'
    };
  });

  res.json({
    modo_emergencia: modoEmergencia,
    timestamp_servidor: new Date().toISOString(),
    total: items.length,
    pacientes: items
  });
});

// GET /api/ingresos/:id
router.get('/:id', requireRole('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN'), validateIdParam('id'), (req, res) => {
  const ingresoId = req.validatedParams.id;

  const ingreso = db.prepare(`
    SELECT i.id, i.consecutivo, i.paciente_id, i.fecha_llegada, i.motivo_consulta, i.acompanante, i.estado,
           i.fecha_inicio_atencion, i.fecha_cierre,
           p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.fecha_nacimiento, p.sexo, p.eps, p.telefono, p.direccion,
           u_adm.nombre as admisionado_por_nombre
    FROM ingresos i
    JOIN pacientes p ON p.id = i.paciente_id
    JOIN usuarios u_adm ON u_adm.id = i.admisionado_por
    WHERE i.id = ?
  `).get(ingresoId);

  if (!ingreso) {
    return res.status(404).json({ error: 'Ingreso no encontrado.' });
  }

  const triage = db.prepare(`
    SELECT t.*, nt.nombre as nivel_nombre, nt.color, nt.codigo_color, nt.minutos_max,
           u.nombre as clasificado_por_nombre
    FROM triage t
    JOIN niveles_triage nt ON nt.nivel = t.nivel
    JOIN usuarios u ON u.id = t.clasificado_por
    WHERE t.ingreso_id = ?
  `).get(ingreso.id);

  const reclasificaciones = db.prepare(`
    SELECT hr.*,
           nt_ant.nombre as nivel_anterior_nombre, nt_ant.codigo_color as color_anterior,
           nt_nue.nombre as nivel_nuevo_nombre, nt_nue.codigo_color as color_nuevo,
           u.nombre as reclasificado_por_nombre
    FROM historial_reclasificaciones hr
    JOIN niveles_triage nt_ant ON nt_ant.nivel = hr.nivel_anterior
    JOIN niveles_triage nt_nue ON nt_nue.nivel = hr.nivel_nuevo
    JOIN usuarios u ON u.id = hr.reclasificado_por
    WHERE hr.ingreso_id = ?
    ORDER BY hr.fecha_reclasificacion DESC
  `).all(ingreso.id);

  const conducta = db.prepare(`
    SELECT c.*, u.nombre as medico_nombre
    FROM conductas c
    JOIN usuarios u ON u.id = c.medico_id
    WHERE c.ingreso_id = ?
  `).get(ingreso.id);

  res.json({
    ...ingreso,
    triage: triage || null,
    reclasificaciones,
    conducta: conducta || null
  });
});

module.exports = router;
