const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname);
const filesToDelete = [
  path.join(DB_DIR, 'triage_urgencias.db'),
  path.join(DB_DIR, 'triage_urgencias.db-wal'),
  path.join(DB_DIR, 'triage_urgencias.db-shm')
];

console.log('🔄 Reiniciando base de datos a estado inicial...');

filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log(`🗑️ Eliminado: ${path.basename(file)}`);
    } catch (err) {
      console.warn(`No se pudo eliminar ${path.basename(file)}: ${err.message}`);
    }
  }
});

// Forzar recarga de db.js
delete require.cache[require.resolve('../backend/src/db')];
require('../backend/src/db');

console.log('✨ Base de datos reseteada con datos semilla.');

