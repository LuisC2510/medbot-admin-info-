const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname, '../../database');
const DB_PATH = path.join(DB_DIR, 'triage_urgencias.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const SEED_PATH = path.join(DB_DIR, 'seed.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Habilitar claves foráneas y modo WAL para mejor concurrencia
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

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
  }
}

// Ejecutar inicialización al cargar
initDb();

module.exports = db;

