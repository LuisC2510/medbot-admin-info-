require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'triage_usc_2026_secreto_urgencias_colombia',
  JWT_EXPIRES_IN: '12h'
};

