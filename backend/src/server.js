const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const {
  PORT,
  HTTPS_PORT,
  HTTPS_ENABLED,
  SSL_KEY_PATH,
  SSL_CERT_PATH,
  IS_PRODUCTION,
  ALLOWED_ORIGINS
} = require('./config');
require('./db');

const { sanitizarEntradas } = require('./middleware/sanitize');
const { csrfProtection } = require('./middleware/csrf');
const { AUTH_COOKIE_NAME, verifyTokenAndLoadUser, registrarAuditoria } = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const pacientesRoutes = require('./routes/pacientes.routes');
const ingresosRoutes = require('./routes/ingresos.routes');
const triageRoutes = require('./routes/triage.routes');
const atencionRoutes = require('./routes/atencion.routes');
const configuracionRoutes = require('./routes/configuracion.routes');

const app = express();

let server;
let redirectServer = null;

if (HTTPS_ENABLED && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  const sslOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };
  server = https.createServer(sslOptions, app);

  // Servidor HTTP de redirección a HTTPS
  redirectServer = http.createServer((req, res) => {
    const host = (req.headers.host || 'localhost').split(':')[0];
    const targetPort = HTTPS_PORT === 443 ? '' : `:${HTTPS_PORT}`;
    res.writeHead(301, { Location: `https://${host}${targetPort}${req.url}` });
    res.end();
  });
} else {
  server = http.createServer(app);
}

// Límites contra Slowloris / DoS
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.maxConnections = 200;

// Ocultar cabecera Express
app.disable('x-powered-by');

// Cabeceras de seguridad con Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.tailwindcss.com', 'https://unpkg.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    frameguard: { action: 'sameorigin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true } : false
  })
);

// CORS restringido a orígenes permitidos
const corsOptions = {
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Sanitización automática contra XSS y prototype pollution
app.use(sanitizarEntradas);

// Rate limiting global sobre /api
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP. Intente más tarde.' }
});
app.use('/api', globalApiLimiter);

// Protección CSRF en peticiones que modifican estado
app.use(csrfProtection);

// Socket.IO con autenticación JWT en handshake y CORS restringido
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (!key) return;
    list[key] = decodeURIComponent(parts.join('='));
  });
  return list;
}

io.use((socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies[AUTH_COOKIE_NAME] || socket.handshake.auth?.token;

    if (!token || typeof token !== 'string') {
      return next(new Error('No autorizado'));
    }

    const user = verifyTokenAndLoadUser(token);
    if (!user) {
      return next(new Error('No autorizado'));
    }

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('No autorizado'));
  }
});

io.on('connection', (socket) => {
  let eventCount = 0;
  const resetTimer = setInterval(() => {
    eventCount = 0;
  }, 60 * 1000);

  socket.onAny((eventName) => {
    eventCount += 1;
    if (eventCount > 30) {
      socket.disconnect(true);
      return;
    }
    // El cliente no tiene permitido emitir eventos clínicos arbitrarios al servidor
    registrarAuditoria(
      socket.user?.id || null,
      'SOCKET_EVENTO_NO_PERMITIDO',
      'SEGURIDAD',
      null,
      `Evento no permitido recibido por socket: ${String(eventName).slice(0, 60)}`,
      null
    );
  });

  socket.on('disconnect', () => {
    clearInterval(resetTimer);
  });
});

app.set('io', io);

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

// 404 genérico para rutas /api desconocidas
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

// Ruta comodín para SPA frontend
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Manejador global de errores (sin filtrar detalles internos ni stack traces)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El tamaño de la solicitud excede el límite permitido.' });
  }
  if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado en el cuerpo de la petición.' });
  }
  if (err && err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  console.error('❌ Error interno no controlado:', err);
  res.status(500).json({ error: 'Error interno en el servidor.' });
});

if (require.main === module) {
  const listenPort = HTTPS_ENABLED && redirectServer ? HTTPS_PORT : PORT;
  const protocol = HTTPS_ENABLED && redirectServer ? 'https' : 'http';

  server.listen(listenPort, () => {
    console.log(`
========================================================================
🏥 SISTEMA DE CLASIFICACIÓN DE TRIAGE DE URGENCIAS (Res. 5596/2015)
   Universidad Santiago de Cali - Administración de la Información
========================================================================
🚀 Servidor ejecutándose en: ${protocol}://localhost:${listenPort}
💾 Base de Datos: SQLite (database/triage_urgencias.db)
⚡ WebSockets: Socket.IO Activo (Autenticado)
🔒 Seguridad: Helmet + CSP + httpOnly Cookie + CSRF + RateLimit
========================================================================
    `);
  });

  if (redirectServer) {
    redirectServer.listen(PORT, () => {
      console.log(`↪️  Redirección HTTP -> HTTPS activa en puerto ${PORT}`);
    });
  }
}

module.exports = { app, server, io, redirectServer };
