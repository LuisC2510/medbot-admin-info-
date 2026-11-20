// ============================================================
// ARCHIVO: config.js
// Configuración básica del servidor y variables
// ============================================================

require('dotenv').config();

module.exports = {
  // Puerto donde se ejecuta la app (3000 por defecto)
  PORT: process.env.PORT || 3000,

  // Clave secreta para firmar los tokens JWT
  JWT_SECRET: process.env.JWT_SECRET || 'secreto_triage_usc_2026',

  // Tiempo de duración de la sesión (7 días para que no expire rápido en pruebas)
  JWT_EXPIRES_IN: '7d'
};
