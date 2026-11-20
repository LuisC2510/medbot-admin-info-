// ============================================================
// ARCHIVO: reset.js
// Script para reiniciar la base de datos a su estado original con datos semilla.
// ============================================================

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_DIR = path.resolve(__dirname);
const DB_PATH = path.join(DB_DIR, 'triage_urgencias.db');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const SEED_PATH = path.join(DB_DIR, 'seed.sql');

const filesToDelete = [
  DB_PATH,
  path.join(DB_DIR, 'triage_urgencias.db-wal'),
  path.join(DB_DIR, 'triage_urgencias.db-shm')
];

console.log('🔄 Reiniciando base de datos a estado inicial...');

let eliminadoFisicamente = true;

// Intentar borrar los archivos de base de datos directamente
for (const file of filesToDelete) {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log(`🗑️ Archivo eliminado: ${path.basename(file)}`);
    } catch (err) {
      eliminadoFisicamente = false;
      console.log(`ℹ️ Archivo en uso por el servidor (${path.basename(file)}). Se limpiará mediante SQL.`);
    }
  }
}

if (!eliminadoFisicamente) {
  // Si el servidor está activo y mantiene el archivo bloqueado (común en Windows),
  // nos conectamos y vaciamos/reconstruimos las tablas directamente por SQL.
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = OFF');

  // 1. Obtener y eliminar todas las tablas existentes
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  for (const t of tables) {
    db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  }

  // 2. Eliminar vistas si existen
  const views = db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all();
  for (const v of views) {
    db.exec(`DROP VIEW IF EXISTS "${v.name}"`);
  }

  // 3. Volver a activar llaves foráneas
  db.pragma('foreign_keys = ON');

  // 4. Ejecutar el esquema y las semillas
  console.log('📦 Recreando tablas desde schema.sql...');
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

  console.log('🌱 Sembrando datos iniciales desde seed.sql...');
  const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
  db.exec(seedSql);

  // Forzar checkpoint de WAL
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    // Si falla el checkpoint no es crítico
  }

  db.close();
} else {
  // Si se pudo borrar físicamente el archivo, cargamos db.js para que cree todo de cero
  delete require.cache[require.resolve('../backend/src/db')];
  require('../backend/src/db');
}

console.log('✨ Base de datos reiniciada con éxito y cargada con datos semilla iniciales.');
