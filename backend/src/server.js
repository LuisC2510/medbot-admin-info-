const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { PORT } = require('./config');
const db = require('./db');

const authRoutes = require('./routes/auth.routes');
const pacientesRoutes = require('./routes/pacientes.routes');
const ingresosRoutes = require('./routes/ingresos.routes');
const triageRoutes = require('./routes/triage.routes');
const atencionRoutes = require('./routes/atencion.routes');
const configuracionRoutes = require('./routes/configuracion.routes');

const app = express();
const server = http.createServer(app);

// Inicializar Socket.IO para comunicación bidireccional en tiempo real
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Guardar instancia de io en la app de Express para uso en rutas
app.set('io', io);

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend estático
const frontendPath = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/ingresos', ingresosRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/atencion', atencionRoutes);
app.use('/api/configuracion', configuracionRoutes);

// Manejador de eventos de Socket.IO
io.on('connection', (socket) => {
  // console.log(`🔌 Cliente conectado al socket: ${socket.id}`);

  socket.on('disconnect', () => {
    // console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// Ruta comodín para SPA frontend (rutas no API devuelven index.html)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(frontendPath, 'index.html');
    if (require('fs').existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado en servidor:', err);
  res.status(500).json({
    error: 'Error interno en el servidor.',
    details: err.message
  });
});

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`
========================================================================
🏥 SISTEMA DE CLASIFICACIÓN DE TRIAGE DE URGENCIAS (Res. 5596/2015)
   Universidad Santiago de Cali - Administración de la Información
========================================================================
🚀 Servidor ejecutándose en: http://localhost:${PORT}
💾 Base de Datos: SQLite (database/triage_urgencias.db)
⚡ WebSockets: Socket.IO Activo
========================================================================
    `);
  });
}

module.exports = { app, server };
