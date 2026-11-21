// ============================================================
// ARCHIVO: security.test.js
// SUITE DE PRUEBAS AUTOMATIZADAS DE SEGURIDAD Y CONTROL DE ACCESO (RBAC)
// ============================================================

const assert = require('node:assert');
const http = require('node:http');
const { app, server } = require('../backend/src/server');

const TEST_PORT = 3002;

// Función auxiliar para realizar peticiones HTTP de prueba
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: path,
        method: method,
        headers: headers
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
            data: data
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSecurityTests() {
  console.log('🛡️  INICIANDO SUITE DE PRUEBAS DE SEGURIDAD (OWASP + RBAC)...');
  console.log('================================================================');

  // Iniciar servidor en puerto de pruebas
  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: Prevención de Inyección SQL (SQL Injection - SQLi)
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 1: Protección contra Inyección SQL (SQLi)');

    // 1.1 Intentar bypass de login con inyección clásica
    const loginSQLi = await request('POST', '/api/auth/login', {
      documento: "' OR '1'='1",
      password: "' OR '1'='1"
    });
    assert.strictEqual(loginSQLi.status, 401, 'Bypass con SQLi debe ser rechazado con 401');
    console.log('    ✅ Intento de bypass de login con SQLi bloqueado exitosamente.');

    // 1.2 Inyección en búsqueda de pacientes
    // Primero obtenemos un token válido de Administrativo
    const loginAdm = await request('POST', '/api/auth/login', { documento: '1001', password: 'Admin123!' });
    const admToken = loginAdm.data.token;

    const busquedaSQLi = await request('GET', '/api/pacientes?q=%27%20UNION%20SELECT%20*%20FROM%20usuarios%20--', null, admToken);
    assert.strictEqual(busquedaSQLi.status, 200, 'La consulta debe ejecutarse como texto plano parametrizado');
    assert.ok(Array.isArray(busquedaSQLi.data), 'Retorna lista sin corromperse por la inyección');
    console.log('    ✅ Parámetros de búsqueda sanitizados contra consultas UNION.');

    // -------------------------------------------------------------
    // PRUEBA 2: Sanitización y Protección contra XSS (Cross-Site Scripting)
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 2: Protección contra Ataques XSS (Cross-Site Scripting)');

    // Crear un paciente con payloads de script malicioso en nombre y motivo
    const docPruebaXSS = 'XSS_' + Date.now().toString().slice(-6);
    const nuevoPaciente = await request('POST', '/api/pacientes', {
      tipo_documento: 'CC',
      numero_documento: docPruebaXSS,
      nombres: "<script>alert('Ataque XSS')</script>Carlos",
      apellidos: 'Prueba Seguridad',
      fecha_nacimiento: '1995-05-10',
      sexo: 'M',
      telefono: '3150000000',
      eps: 'SURA EPS'
    }, admToken);

    assert.strictEqual(nuevoPaciente.status, 201, 'Paciente creado correctamente');
    const pacienteCreado = nuevoPaciente.data;
    
    // Validar que el script fue neutralizado por el middleware
    assert.ok(!pacienteCreado.nombres.includes('<script>'), 'El payload <script> debe ser removido o neutralizado');
    console.log(`    ✅ Payload XSS neutralizado en backend: "${pacienteCreado.nombres}"`);

    // Crear un ingreso con motivo sospechoso
    const nuevoIngreso = await request('POST', '/api/ingresos', {
      paciente_id: pacienteCreado.id,
      motivo_consulta: "<img src=x onerror=alert('xss')> Dolor torácico severo"
    }, admToken);
    assert.strictEqual(nuevoIngreso.status, 201);
    assert.ok(!nuevoIngreso.data.motivo_consulta.includes('<img'), 'Etiquetas HTML peligrosas deben ser desarmadas');
    console.log(`    ✅ Payload HTML/XSS en motivo de consulta sanitizado: "${nuevoIngreso.data.motivo_consulta}"`);

    // -------------------------------------------------------------
    // PRUEBA 3: Control de Acceso Basado en Roles (RBAC Negativo)
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 3: Control de Acceso Basado en Roles (RBAC)');

    // Obtenemos tokens de los otros roles
    const loginEnf = await request('POST', '/api/auth/login', { documento: '1002', password: 'Enfermero123!' });
    const enfToken = loginEnf.data.token;

    const loginMed = await request('POST', '/api/auth/login', { documento: '1003', password: 'Medico123!' });
    const medToken = loginMed.data.token;

    const ingresoId = nuevoIngreso.data.id;

    // 3.1 ADMINISTRATIVO intentando clasificar triage (Prohibido -> 403)
    const admClasifica = await request('POST', '/api/triage', {
      ingreso_id: ingresoId,
      nivel: 2,
      observaciones: 'Intento de clasificación indebida por administrativo'
    }, admToken);
    assert.strictEqual(admClasifica.status, 403, 'Administrativo no puede clasificar Triage');
    console.log('    ✅ Administrativo bloqueado con 403 al intentar clasificar Triage.');

    // 3.2 ADMINISTRATIVO intentando iniciar atención médica (Prohibido -> 403)
    const admAtencion = await request('POST', `/api/atencion/${ingresoId}/iniciar`, {}, admToken);
    assert.strictEqual(admAtencion.status, 403, 'Administrativo no puede iniciar atención médica');
    console.log('    ✅ Administrativo bloqueado con 403 al intentar iniciar atención médica.');

    // 3.3 ENFERMERO clasificando válidamente (Permitido -> 201)
    const enfClasifica = await request('POST', '/api/triage', {
      ingreso_id: ingresoId,
      nivel: 3,
      fc: 80,
      fr: 18,
      pas: 120,
      pad: 80,
      temperatura: 36.5,
      spo2: 98,
      dolor: 4,
      observaciones: 'Valoración inicial adecuada por enfermería'
    }, enfToken);
    assert.strictEqual(enfClasifica.status, 201, 'Enfermero sí puede clasificar Triage');
    console.log('    ✅ Enfermero clasificó el ingreso en Triage III exitosamente.');

    // 3.4 ENFERMERO intentando definir conducta médica (Prohibido -> 403)
    const enfConducta = await request('POST', `/api/atencion/${ingresoId}/conducta`, {
      tipo: 'ALTA',
      descripcion: 'Alta médica emitida indebidamente por enfermero'
    }, enfToken);
    assert.strictEqual(enfConducta.status, 403, 'Enfermero no puede emitir conductas médicas');
    console.log('    ✅ Enfermero bloqueado con 403 al intentar definir conducta médica.');

    // 3.5 MÉDICO intentando alterar configuración de tiempos institucionales (Prohibido -> 403)
    const medConfig = await request('PUT', '/api/configuracion/niveles/3', {
      minutos_max: 90
    }, medToken);
    assert.strictEqual(medConfig.status, 403, 'Médico no puede alterar tiempos institucionales');
    console.log('    ✅ Médico bloqueado con 403 al intentar modificar tiempos de triage.');

    // -------------------------------------------------------------
    // PRUEBA 4: Seguridad de Autenticación y Manejo de Tokens
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 4: Seguridad de Tokens y Autenticación');

    // 4.1 Petición sin token
    const sinToken = await request('GET', '/api/pacientes', null, null);
    assert.strictEqual(sinToken.status, 401, 'Petición sin token debe ser 401');
    console.log('    ✅ Petición anónima rechazada con 401 Unauthorized.');

    // 4.2 Petición con token adulterado
    const tokenFalso = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5LCJyb2wiOiJBRE1JTiJ9.firmaInvalida123';
    const conTokenFalso = await request('GET', '/api/pacientes', null, tokenFalso);
    assert.strictEqual(conTokenFalso.status, 401, 'Token manipulado debe ser 401');
    console.log('    ✅ Token con firma falsificada rechazado con 401.');

    // -------------------------------------------------------------
    // PRUEBA 5: Protección de Datos Sensibles (No exponer hashes)
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 5: Protección de Datos Sensibles (Hashes de contraseñas)');

    // Login Admin
    const loginAdmin = await request('POST', '/api/auth/login', { documento: '1000', password: 'Admin123!' });
    const adminToken = loginAdmin.data.token;

    // Verificar que en la respuesta de login no viaje password_hash
    assert.strictEqual(loginAdmin.data.user.password_hash, undefined, 'Login no debe incluir password_hash');

    // Listar usuarios en configuración
    const usuariosList = await request('GET', '/api/configuracion/usuarios', null, adminToken);
    assert.strictEqual(usuariosList.status, 200);
    for (const u of usuariosList.data) {
      assert.strictEqual(u.password_hash, undefined, `Usuario ${u.documento} no debe exponer su hash`);
    }
    console.log('    ✅ Ninguna consulta expone contraseñas con hash al cliente.');

    // -------------------------------------------------------------
    // PRUEBA 6: Cabeceras de Seguridad HTTP (OWASP)
    // -------------------------------------------------------------
    console.log('\n  ▶ Prueba 6: Cabeceras de Seguridad HTTP');
    const resHeaders = loginSQLi.headers;

    assert.strictEqual(resHeaders['x-content-type-options'], 'nosniff', 'Falta X-Content-Type-Options');
    assert.strictEqual(resHeaders['x-frame-options'], 'SAMEORIGIN', 'Falta X-Frame-Options');
    assert.strictEqual(resHeaders['x-xss-protection'], '1; mode=block', 'Falta X-XSS-Protection');
    assert.strictEqual(resHeaders['x-powered-by'], undefined, 'X-Powered-By debe estar oculto');
    console.log('    ✅ Cabeceras X-Content-Type-Options, X-Frame-Options y X-XSS-Protection activas.');
    console.log('    ✅ Cabecera tecnológica X-Powered-By oculta exitosamente.');

    console.log('\n================================================================');
    console.log('🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD (OWASP + RBAC) PASARON CON ÉXITO!');
    console.log('================================================================\n');

  } finally {
    // Cerrar servidor de pruebas
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
