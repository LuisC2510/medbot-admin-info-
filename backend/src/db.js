const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname, '../../database');
const DB_PATH = path.join(DB_DIR, 'triage_urgencias.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const SEED_PATH = path.join(DB_DIR, 'seed.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true, mode: 0o700 });
}

const db = new Database(DB_PATH);

// Restringir permisos del archivo de base de datos (lectura/escritura solo propietario)
try {
  fs.chmodSync(DB_PATH, 0o600);
} catch (err) {
  // En Windows NTFS los permisos POSIX pueden ser ignorados; se documenta ACL en SECURITY.md
}

// Habilitar claves foráneas y modo WAL para mejor concurrencia
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function ensureSecuritySchema() {
  const userCols = db.prepare("PRAGMA table_info('usuarios')").all().map((c) => c.name);
  if (!userCols.includes('intentos_fallidos')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0');
  }
  if (!userCols.includes('bloqueado_hasta')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN bloqueado_hasta DATETIME');
  }
  if (!userCols.includes('debe_cambiar_password')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN debe_cambiar_password INTEGER NOT NULL DEFAULT 0');
  }
  if (!userCols.includes('token_version')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1');
  }

  const ingresoCols = db.prepare("PRAGMA table_info('ingresos')").all().map((c) => c.name);
  if (!ingresoCols.includes('medico_id')) {
    db.exec('ALTER TABLE ingresos ADD COLUMN medico_id INTEGER REFERENCES usuarios(id)');
  }

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_audit_update
    BEFORE UPDATE ON log_auditoria
    BEGIN
      SELECT RAISE(ABORT, 'Los registros de auditoría son inmutables y no pueden modificarse');
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
    BEFORE DELETE ON log_auditoria
    BEGIN
      SELECT RAISE(ABORT, 'Los registros de auditoría son inmutables y no pueden eliminarse');
    END;
  `);
}

function initDb() {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'").get();

  if (!tableCheck) {
    console.log('📦 Inicializando base de datos desde schema.sql...');
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);

    console.log('🌱 Sembrando datos iniciales desde seed.sql...');
    const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
    db.exec(seedSql);
    console.log('✅ Base de datos inicializada y sembrada con éxito.');
  } else {
    ensureSecuritySchema();
  }
}

initDb();

module.exports = db;
