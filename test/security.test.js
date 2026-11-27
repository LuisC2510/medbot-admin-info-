// ============================================================
// ARCHIVO: security.test.js
// SUITE DE PRUEBAS DE ATAQUE Y SEGURIDAD (OWASP Top 10 + RBAC + Socket.IO)
// ============================================================

const assert = require('node:assert');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

// Reiniciar BD para pruebas deterministas
execFileSync(process.execPath, [path.resolve(__dirname, '../database/reset.js')], { stdio: 'ignore' });

const { JWT_SECRET } = require('../backend/src/config');
const db = require('../backend/src/db');
const { server } = require('../backend/src/server');

const TEST_PORT = 3002;

function extractCookies(setCookieHeaders = []) {
  const jar = {};
  for (const header of setCookieHeaders) {
    const firstPart = header.split(';')[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx > 0) {
      jar[firstPart.slice(0, eqIdx).trim()] = firstPart.slice(eqIdx + 1).trim();
    }
  }
  return jar;
}

function request(method, reqPath, body = null, session = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : (body ? JSON.stringify(body) : null);
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (session) {
      const cookiePairs = [];
      if (session.authCookie) cookiePairs.push(`medbot_token=${session.authCookie}`);
      if (session.csrfCookie) cookiePairs.push(`medbot_csrf=${session.csrfCookie}`);
      if (cookiePairs.length) headers['Cookie'] = cookiePairs.join('; ');
      if (session.csrfCookie && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !session.omitCsrfHeader) {
        headers['X-CSRF-Token'] = session.csrfCookie;
      }
      if (session.bearerToken) {
        headers['Authorization'] = `Bearer ${session.bearerToken}`;
      }
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: reqPath,
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(rawData);
          } catch (e) {
            data = rawData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            cookies: extractCookies(res.headers['set-cookie']),
            data
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function loginAndChangeSeedPassword(documento, initialPassword, newPassword) {
  const res = await request('POST', '/api/auth/login', { documento, password: initialPassword });
  assert.strictEqual(res.status, 200, `Login de ${documento} debe ser 200`);
  assert.strictEqual(res.data.token, undefined, 'No debe devolver JWT en el body JSON');
  assert.ok(res.cookies.medbot_token, 'Debe emitir cookie httpOnly medbot_token');
  assert.ok(res.cookies.medbot_csrf, 'Debe emitir cookie medbot_csrf');

  const session = {
    authCookie: res.cookies.medbot_token,
    csrfCookie: res.cookies.medbot_csrf
  };

  if (res.data.mustChangePassword) {
    // Verificar que antes de cambiar la clave semilla, las rutas clínicas devuelven 403
    const blocked = await request('GET', '/api/ingresos/tablero', null, session);
    assert.strictEqual(blocked.status, 403, 'Debe bloquear acceso hasta cambiar contraseña semilla');

    const chg = await request('POST', '/api/auth/cambiar-password', {
      currentPassword: initialPassword,
      newPassword
    }, session);
    assert.strictEqual(chg.status, 200, 'Cambio de contraseña inicial debe ser 200');
    session.authCookie = chg.cookies.medbot_token || session.authCookie;
    session.csrfCookie = chg.cookies.medbot_csrf || session.csrfCookie;
  }

  return session;
}

async function runSecurityTests() {
  console.log('🛡️  INICIANDO SUITE DE PRUEBAS DE ATAQUE Y SEGURIDAD...');
  console.log('================================================================');

  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  try {
    // -------------------------------------------------------------
    // 1. INYECCIÓN SQL (SQLi) EN LOGIN Y BUSCADORES
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 1: Inyección SQL en login y buscadores');
    const sqliLogin1 = await request('POST', '/api/auth/login', {
      documento: "' OR 1=1 --",
      password: "' OR '1'='1"
    });
    assert.strictEqual(sqliLogin1.status, 401);
    assert.strictEqual(sqliLogin1.data.error, 'Credenciales inválidas.');

    const admSession = await loginAndChangeSeedPassword('1001', 'Admin123!', 'AdmClave#2026!');

    const sqliSearch = await request('GET', `/api/pacientes?q=${encodeURIComponent("' OR 1=1 --")}`, null, admSession);
    assert.strictEqual(sqliSearch.status, 200);
    assert.ok(Array.isArray(sqliSearch.data));
    assert.strictEqual(sqliSearch.data.length, 0, 'SQLi en buscador no debe devolver registros');

    const sqliUnion = await request('GET', `/api/pacientes?q=${encodeURIComponent("' UNION SELECT 1,2,3,4,5,6,7,8 FROM usuarios --")}`, null, admSession);
    assert.strictEqual(sqliUnion.status, 200);
    assert.strictEqual(sqliUnion.data.length, 0);
    console.log('    ✅ SQLi bloqueado en login y buscadores.');

    // -------------------------------------------------------------
    // 2. XSS ALMACENADO EN NOMBRE DE PACIENTE Y OBSERVACIONES
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 2: XSS almacenado en paciente y observaciones');
    const docXSS = 'XSS' + Date.now().toString().slice(-6);
    const pacXSS = await request('POST', '/api/pacientes', {
      tipo_documento: 'CC',
      numero_documento: docXSS,
      nombres: "<script>alert('XSS')</script>Carlos",
      apellidos: 'Prueba',
      fecha_nacimiento: '1995-05-10',
      sexo: 'M',
      eps: 'Sura EPS'
    }, admSession);
    assert.strictEqual(pacXSS.status, 201);
    assert.ok(!pacXSS.data.nombres.includes('<script>'), 'Etiqueta <script> debe ser eliminada');

    const ingXSS = await request('POST', '/api/ingresos', {
      paciente_id: pacXSS.data.id,
      motivo_consulta: 'Dolor torácico agudo'
    }, admSession);
    assert.strictEqual(ingXSS.status, 201);

    const enfSession = await loginAndChangeSeedPassword('1002', 'Enfermero123!', 'EnfClave#2026!');
    const triageXSS = await request('POST', '/api/triage', {
      ingreso_id: ingXSS.data.id,
      nivel: 3,
      fc: 85,
      fr: 18,
      pas: 120,
      pad: 80,
      temperatura: 36.7,
      spo2: 98,
      dolor: 4,
      observaciones: '<img src=x onerror=alert(1)> Paciente estable'
    }, enfSession);
    assert.strictEqual(triageXSS.status, 201);
    assert.ok(!triageXSS.data.observaciones.includes('<img'), 'HTML peligroso en observaciones debe neutralizarse');
    console.log('    ✅ XSS almacenado neutralizado en paciente y observaciones.');

    // Iniciar sesión con médico y admin antes de disparar el rate-limit global de /login en la prueba de fuerza bruta
    const medSession = await loginAndChangeSeedPassword('1003', 'Medico123!', 'MedClave#2026!');
    const adminSession = await loginAndChangeSeedPassword('1000', 'Admin123!', 'AdminClave#2026!');

    // -------------------------------------------------------------
    // 3. FUERZA BRUTA CONTRA LOGIN (BLOQUEO DE CUENTA + RATE LIMIT)
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 3: Fuerza bruta contra login');
    // Crear usuario dedicado para probar bloqueo de 5 intentos
    const docBrute = '999001';
    const createBrute = await request('POST', '/api/configuracion/usuarios', {
      nombre: 'Usuario Prueba Bloqueo',
      documento: docBrute,
      rol: 'ADMINISTRATIVO',
      password: 'ClaveFuerte#2026!'
    }, adminSession);
    assert.strictEqual(createBrute.status, 201);

    for (let i = 1; i <= 5; i++) {
      const fail = await request('POST', '/api/auth/login', {
        documento: docBrute,
        password: 'PasswordIncorrecta1!'
      });
      assert.strictEqual(fail.status, 401);
      assert.strictEqual(fail.data.error, 'Credenciales inválidas.');
    }

    // El intento #6 debe responder 423 (cuenta bloqueada)
    const lockedRes = await request('POST', '/api/auth/login', {
      documento: docBrute,
      password: 'ClaveFuerte#2026!'
    });
    assert.strictEqual(lockedRes.status, 423, 'Cuenta debe quedar bloqueada tras 5 intentos fallidos');

    // Seguir golpeando /api/auth/login hasta disparar express-rate-limit (429)
    let rateLimited = false;
    for (let i = 0; i < 15; i++) {
      const r = await request('POST', '/api/auth/login', {
        documento: 'no_existe_999',
        password: 'PasswordIncorrecta1!'
      });
      if (r.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert.ok(rateLimited, 'express-rate-limit debe responder 429 ante fuerza bruta');
    console.log('    ✅ Bloqueo tras 5 intentos (423) y rate limiting estricto (429) verificados.');

    // -------------------------------------------------------------
    // 4. IDOR Y ESCALADA DE PRIVILEGIOS ENTRE ROLES
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 4: IDOR, RBAC y escalada de privilegios');

    // Administrativo intentando clasificar triage
    const admTriage = await request('POST', '/api/triage', {
      ingreso_id: ingXSS.data.id,
      nivel: 2,
      observaciones: 'Intento no autorizado'
    }, admSession);
    assert.strictEqual(admTriage.status, 403);

    // Administrativo intentando definir conducta
    const admConducta = await request('POST', `/api/atencion/${ingXSS.data.id}/conducta`, {
      tipo: 'ALTA_MEDICA',
      descripcion: 'Intento no autorizado de alta'
    }, admSession);
    assert.strictEqual(admConducta.status, 403);

    // Enfermero intentando crear usuario / cambiar credenciales
    const enfCreateUser = await request('POST', '/api/configuracion/usuarios', {
      nombre: 'Hacker',
      documento: '888888',
      rol: 'ADMIN',
      password: 'ClaveFuerte#2026!'
    }, enfSession);
    assert.strictEqual(enfCreateUser.status, 403);

    // Enfermero intentando reclasificar
    const enfReclas = await request('POST', `/api/triage/${ingXSS.data.id}/reclasificar`, {
      nivel_nuevo: 1,
      motivo: 'Intento de reclasificación por enfermero'
    }, enfSession);
    assert.strictEqual(enfReclas.status, 403);

    // Médico intentando modificar tiempos institucionales
    const medConfig = await request('PUT', '/api/configuracion/niveles/3', { minutos_max: 90 }, medSession);
    assert.strictEqual(medConfig.status, 403);

    // IDOR: Médico 1 inicia atención y Médico 2 intenta definir conducta sobre el mismo ingreso
    const med2Create = await request('POST', '/api/configuracion/usuarios', {
      nombre: 'Dr. Segundo',
      documento: '1004',
      rol: 'MEDICO',
      password: 'Med2Clave#2026!'
    }, adminSession);
    assert.strictEqual(med2Create.status, 201);
    // Reset rate limit no aplica porque ya disparamos 429 en /login; usamos token firmado válido para probar IDOR directo
    const med2Row = db.prepare('SELECT id, rol, token_version FROM usuarios WHERE documento = ?').get('1004');
    const med2Token = jwt.sign({ id: med2Row.id, rol: med2Row.rol, tv: med2Row.token_version }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '10m'
    });
    db.prepare('UPDATE usuarios SET debe_cambiar_password = 0 WHERE id = ?').run(med2Row.id);

    const startMed1 = await request('POST', `/api/atencion/${ingXSS.data.id}/iniciar`, {}, medSession);
    assert.strictEqual(startMed1.status, 200);

    const idorConducta = await request('POST', `/api/atencion/${ingXSS.data.id}/conducta`, {
      tipo: 'ALTA_MEDICA',
      descripcion: 'Intento IDOR de otro médico'
    }, { authCookie: med2Token, csrfCookie: medSession.csrfCookie });
    assert.strictEqual(idorConducta.status, 403, 'Otro médico no debe poder cerrar ingreso en atención de Médico 1');
    console.log('    ✅ RBAC e IDOR bloqueados con 403.');

    // -------------------------------------------------------------
    // 5. JWT MANIPULADO, EXPIRADO, ALG "none" Y LOGOUT
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 5: JWT manipulado, expirado, alg="none" y logout');
    const fakeSigToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sIjoiQURNSU4iLCJ0diI6MX0.invalida';
    const resFakeSig = await request('GET', '/api/pacientes', null, { bearerToken: fakeSigToken });
    assert.strictEqual(resFakeSig.status, 401);

    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payloadNone = Buffer.from(JSON.stringify({ id: 1, rol: 'ADMIN', tv: 1 })).toString('base64url');
    const algNoneToken = `${headerNone}.${payloadNone}.`;
    const resAlgNone = await request('GET', '/api/pacientes', null, { bearerToken: algNoneToken });
    assert.strictEqual(resAlgNone.status, 401, 'JWT con algoritmo none debe ser rechazado');

    const expiredToken = jwt.sign({ id: 1, rol: 'ADMIN', tv: 1 }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10
    });
    const resExpired = await request('GET', '/api/pacientes', null, { bearerToken: expiredToken });
    assert.strictEqual(resExpired.status, 401, 'JWT expirado debe ser rechazado');

    // Logout debe invalidar el token en el servidor
    const logoutRes = await request('POST', '/api/auth/logout', {}, enfSession);
    assert.strictEqual(logoutRes.status, 200);
    const afterLogout = await request('GET', '/api/ingresos/cola-triage', null, enfSession);
    assert.strictEqual(afterLogout.status, 401, 'Token previo al logout debe quedar invalidado');
    console.log('    ✅ JWT inválido, alg=none, expirado y post-logout rechazados con 401.');

    // -------------------------------------------------------------
    // 6. ACCESO SIN TOKEN A CADA RUTA Y A SOCKET.IO
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 6: Acceso sin token a rutas API y Socket.IO');
    const protectedEndpoints = [
      ['GET', '/api/auth/me'],
      ['GET', '/api/pacientes'],
      ['GET', '/api/ingresos/hoy'],
      ['GET', '/api/ingresos/cola-triage'],
      ['GET', '/api/ingresos/tablero'],
      ['POST', '/api/triage'],
      ['GET', '/api/atencion/historial'],
      ['GET', '/api/atencion/mis-pacientes'],
      ['GET', '/api/configuracion/usuarios'],
      ['GET', '/api/configuracion/auditoria'],
      ['GET', '/api/configuracion/niveles']
    ];
    for (const [m, p] of protectedEndpoints) {
      const r = await request(m, p, m === 'POST' ? {} : null, null);
      assert.strictEqual(r.status, 401, `Ruta ${m} ${p} sin token debe responder 401`);
    }

    // Socket.IO sin token debe ser rechazado
    await new Promise((resolve, reject) => {
      const s = ioClient(`http://127.0.0.1:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: false
      });
      s.on('connect', () => {
        s.close();
        reject(new Error('Socket.IO permitió conexión sin autenticar'));
      });
      s.on('connect_error', (err) => {
        assert.ok(err.message.includes('No autorizado'));
        s.close();
        resolve();
      });
    });

    // Socket.IO con cookie válida debe conectar
    await new Promise((resolve, reject) => {
      const s = ioClient(`http://127.0.0.1:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: {
          Cookie: `medbot_token=${medSession.authCookie}`
        }
      });
      s.on('connect', () => {
        s.close();
        resolve();
      });
      s.on('connect_error', (err) => {
        s.close();
        reject(err);
      });
    });
    console.log('    ✅ Todas las rutas API y Socket.IO rechazan acceso sin token.');

    // -------------------------------------------------------------
    // 7. PAYLOADS GIGANTES, CAMPOS INESPERADOS, CSRF E INMUTABILIDAD AUDITORÍA
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 7: Payloads gigantes, campos inesperados, CSRF y auditoría inmutable');
    const bigPayload = JSON.stringify({ motivo_consulta: 'A'.repeat(15000) });
    const resBig = await request('POST', '/api/ingresos', bigPayload, admSession);
    assert.strictEqual(resBig.status, 413, 'Payload > 10kb debe ser rechazado con 413');

    const resExtraField = await request('POST', '/api/pacientes', {
      tipo_documento: 'CC',
      numero_documento: '777888999',
      nombres: 'Test',
      apellidos: 'MassAssign',
      fecha_nacimiento: '1990-01-01',
      sexo: 'M',
      eps: 'Sura',
      rol: 'ADMIN'
    }, admSession);
    assert.strictEqual(resExtraField.status, 400, 'Campos inesperados deben ser rechazados por Zod .strict()');

    const resNoCsrf = await request('POST', '/api/configuracion/emergencia', { activo: true }, {
      authCookie: adminSession.authCookie,
      csrfCookie: adminSession.csrfCookie,
      omitCsrfHeader: true
    });
    assert.strictEqual(resNoCsrf.status, 403, 'Petición mutante sin X-CSRF-Token debe responder 403');

    // Cabeceras Helmet y ausencia de password_hash
    assert.strictEqual(resNoCsrf.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(resNoCsrf.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(resNoCsrf.headers['content-security-policy']);
    assert.strictEqual(resNoCsrf.headers['x-powered-by'], undefined);

    // Inmutabilidad de auditoría
    assert.throws(() => {
      db.prepare("DELETE FROM log_auditoria WHERE id = 1").run();
    }, /inmutables/);

    console.log('    ✅ Payloads >10kb (413), campos inesperados (400), CSRF (403) y auditoría inmutable verificados.');

    console.log('\n================================================================');
    console.log('🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD Y ATAQUE PASARON CON ÉXITO!');
    console.log('================================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (require.main === module) {
  runSecurityTests().catch((err) => {
    console.error('❌ Error en pruebas de seguridad:', err);
    process.exit(1);
  });
}

module.exports = { runSecurityTests };
