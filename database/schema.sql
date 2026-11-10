-- ============================================================================
-- SISTEMA DE CLASIFICACIÓN DE TRIAGE PARA SERVICIOS DE URGENCIAS HOSPITALARIAS
-- Basado en la Resolución 5596 de 2015 - Ministerio de Salud y Protección Social (Colombia)
-- Universidad Santiago de Cali - Administración de la Información
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. TABLA DE USUARIOS Y ROLES DEL SISTEMA
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    documento TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK(rol IN ('ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN')),
    password_hash TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
    creado_en DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 2. TABLA DE PACIENTES
CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_documento TEXT NOT NULL CHECK(tipo_documento IN ('CC', 'TI', 'RC', 'CE', 'PA', 'PEP', 'PPT')),
    numero_documento TEXT UNIQUE NOT NULL,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    sexo TEXT NOT NULL CHECK(sexo IN ('M', 'F', 'OTRO')),
    telefono TEXT,
    direccion TEXT,
    eps TEXT NOT NULL,
    acudiente_nombre TEXT,
    acudiente_telefono TEXT,
    creado_en DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 3. TABLA DE NIVELES DE TRIAGE (RESOLUCIÓN 5596 DE 2015)
CREATE TABLE IF NOT EXISTS niveles_triage (
    nivel INTEGER PRIMARY KEY CHECK(nivel BETWEEN 1 AND 5),
    nombre TEXT NOT NULL,
    color TEXT NOT NULL,
    codigo_color TEXT NOT NULL,
    minutos_max INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    editable INTEGER NOT NULL DEFAULT 0 CHECK(editable IN (0, 1))
);

-- 4. TABLA DE CONFIGURACIÓN GLOBAL INSTITUCIONAL
CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    actualizado_en DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 5. TABLA DE INGRESOS A URGENCIAS (ADMISIÓN)
CREATE TABLE IF NOT EXISTS ingresos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consecutivo TEXT UNIQUE NOT NULL,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    fecha_llegada DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
    motivo_consulta TEXT NOT NULL,
    acompanante TEXT,
    estado TEXT NOT NULL CHECK(estado IN ('EN_ESPERA_TRIAGE', 'CLASIFICADO', 'EN_ATENCION', 'CERRADO')) DEFAULT 'EN_ESPERA_TRIAGE',
    admisionado_por INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_inicio_atencion DATETIME,
    fecha_cierre DATETIME,
    creado_en DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 6. TABLA DE VALORACIÓN CLÍNICA DE TRIAGE
CREATE TABLE IF NOT EXISTS triage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingreso_id INTEGER UNIQUE NOT NULL REFERENCES ingresos(id) ON DELETE CASCADE,
    nivel INTEGER NOT NULL REFERENCES niveles_triage(nivel),
    fc INTEGER,              -- Frecuencia Cardíaca (latidos por minuto)
    fr INTEGER,              -- Frecuencia Respiratoria (respiraciones por minuto)
    pas INTEGER,             -- Presión Arterial Sistólica (mmHg)
    pad INTEGER,             -- Presión Arterial Diastólica (mmHg)
    temperatura REAL,        -- Temperatura Corporal (°C)
    spo2 INTEGER,            -- Saturación de Oxígeno (%)
    dolor INTEGER CHECK(dolor BETWEEN 0 AND 10), -- Escala Visual Analógica (EVA)
    estado_conciencia TEXT DEFAULT 'Alerta',
    observaciones TEXT NOT NULL,
    clasificado_por INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_clasificacion DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 7. TABLA DE HISTORIAL DE RECLASIFICACIONES DE TRIAGE
CREATE TABLE IF NOT EXISTS historial_reclasificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    triage_id INTEGER NOT NULL REFERENCES triage(id) ON DELETE CASCADE,
    ingreso_id INTEGER NOT NULL REFERENCES ingresos(id) ON DELETE CASCADE,
    nivel_anterior INTEGER NOT NULL REFERENCES niveles_triage(nivel),
    nivel_nuevo INTEGER NOT NULL REFERENCES niveles_triage(nivel),
    motivo TEXT NOT NULL,
    reclasificado_por INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_reclasificacion DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 8. TABLA DE CONDUCTA MÉDICA / DESTINO DEL PACIENTE
CREATE TABLE IF NOT EXISTS conductas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingreso_id INTEGER UNIQUE NOT NULL REFERENCES ingresos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK(tipo IN ('ATENDER_URGENCIAS', 'SOLICITAR_EXAMENES', 'HOSPITALIZAR', 'REMITIR', 'DERIVAR_CONSULTA', 'ALTA_MEDICA')),
    descripcion TEXT NOT NULL,
    destino TEXT,
    medico_id INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_conducta DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 9. TABLA DE LOG Y AUDITORÍA DE ACCIONES
CREATE TABLE IF NOT EXISTS log_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id),
    accion TEXT NOT NULL,
    entidad TEXT NOT NULL,
    entidad_id INTEGER,
    detalles TEXT,
    ip TEXT,
    fecha DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================================
-- ÍNDICES DE RENDIMIENTO Y CONSULTA FRECUENTE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pacientes_documento ON pacientes(tipo_documento, numero_documento);
CREATE INDEX IF NOT EXISTS idx_ingresos_paciente ON ingresos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_estado ON ingresos(estado);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha_llegada);
CREATE INDEX IF NOT EXISTS idx_triage_ingreso ON triage(ingreso_id);
CREATE INDEX IF NOT EXISTS idx_triage_nivel ON triage(nivel);
CREATE INDEX IF NOT EXISTS idx_triage_fecha ON triage(fecha_clasificacion);
CREATE INDEX IF NOT EXISTS idx_historial_ingreso ON historial_reclasificaciones(ingreso_id);
CREATE INDEX IF NOT EXISTS idx_conductas_ingreso ON conductas(ingreso_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON log_auditoria(fecha);

