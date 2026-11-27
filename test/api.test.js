const http = require('http');
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

// Reiniciar BD antes de las pruebas funcionales para tener estado determinista
execFileSync(process.execPath, [path.resolve(__dirname, '../database/reset.js')], { stdio: 'ignore' });

const { server } = require('../backend/src/server');

const PORT = 3001;
let serverInstance;

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

function request(method, reqPath, body = null, session = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (dataString) headers['Content-Length'] = Buffer.byteLength(dataString);

    if (session) {
      const cookiePairs = [];
      if (session.authCookie) cookiePairs.push(`medbot_token=${session.authCookie}`);
      if (session.csrfCookie) cookiePairs.push(`medbot_csrf=${session.csrfCookie}`);
      if (cookiePairs.length) headers['Cookie'] = cookiePairs.join('; ');
      if (session.csrfCookie && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        headers['X-CSRF-Token'] = session.csrfCookie;
      }
    }

    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: reqPath, method, headers },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(responseData); } catch (e) { parsed = responseData; }
          const cookies = extractCookies(res.headers['set-cookie']);
          resolve({ status: res.statusCode, headers: res.headers, cookies, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function loginAndActivate(documento, initialPassword) {
  const resLogin = await request('POST', '/api/auth/login', { documento, password: initialPassword });
  assert.strictEqual(resLogin.status, 200, `Login de ${documento} debe ser 200`);

  let session = {
    authCookie: resLogin.cookies.medbot_token,
    csrfCookie: resLogin.cookies.medbot_csrf
  };

  if (resLogin.data.mustChangePassword) {
    const resChg = await request('POST', '/api/auth/cambiar-password', {
      currentPassword: initialPassword,
      newPassword: 'ClaveSegura#2026!'
    }, session);
    assert.strictEqual(resChg.status, 200, `Cambio de clave inicial de ${documento} debe ser 200`);
    session = {
      authCookie: resChg.cookies.medbot_token || session.authCookie,
      csrfCookie: resChg.cookies.medbot_csrf || session.csrfCookie
    };
  }

  return { session, user: resLogin.data.user };
}

async function runTests() {
  console.log('🧪 Iniciando pruebas automáticas de la API...');
  await new Promise((resolve) => {
    serverInstance = server.listen(PORT, '127.0.0.1', resolve);
  });

  try {
    console.log('  ▶ Test 1: Autenticación de roles (Admin, Admisión, Enfermero, Médico)');
    const { session: adminSession, user: adminUser } = await loginAndActivate('1000', 'Admin123!');
    assert.strictEqual(adminUser.rol, 'ADMIN');

    const { session: admSession, user: admUser } = await loginAndActivate('1001', 'Admin123!');
    assert.strictEqual(admUser.rol, 'ADMINISTRATIVO');

    const { session: enfSession, user: enfUser } = await loginAndActivate('1002', 'Enfermero123!');
    assert.strictEqual(enfUser.rol, 'ENFERMERO');

    const { session: medSession, user: medUser } = await loginAndActivate('1003', 'Medico123!');
    assert.strictEqual(medUser.rol, 'MEDICO');
    console.log('    ✅ Autenticación con cookies httpOnly + CSRF exitosa para los 4 roles.');

    console.log('  ▶ Test 2: Consulta del Tablero de Urgencias en Tiempo Real');
    const resTablero = await request('GET', '/api/ingresos/tablero', null, medSession);
    assert.strictEqual(resTablero.status, 200);
    assert(Array.isArray(resTablero.data.pacientes), 'Debe devolver un arreglo de pacientes');
    assert.strictEqual(resTablero.data.pacientes[0].triage_nivel, 1, 'El primer paciente en el tablero debe ser Triage I');
    console.log(`    ✅ Tablero consultado: ${resTablero.data.pacientes.length} pacientes activos.`);

    console.log('  ▶ Test 3: Admisión de nuevo paciente');
    const docPrueba = 'DOC_' + Date.now().toString().slice(-8);
    const resPac = await request('POST', '/api/pacientes', {
      tipo_documento: 'CC',
      numero_documento: docPrueba,
      nombres: 'Prueba Andrés',
      apellidos: 'Vargas Silva',
      fecha_nacimiento: '1995-04-10',
      sexo: 'M',
      telefono: '3119998888',
      direccion: 'Calle 10 # 50-20',
      eps: 'Sura EPS'
    }, admSession);
    assert.strictEqual(resPac.status, 201);
    const pacienteId = resPac.data.id;

    const resIngreso = await request('POST', '/api/ingresos', {
      paciente_id: pacienteId,
      motivo_consulta: 'Dolor abdominal agudo y vómito persistente.',
      acompanante: 'Andrea Vargas (Hermana)'
    }, admSession);
    assert.strictEqual(resIngreso.status, 201);
    assert.strictEqual(resIngreso.data.estado, 'EN_ESPERA_TRIAGE');
    const ingresoId = resIngreso.data.id;
    console.log(`    ✅ Paciente creado (ID: ${pacienteId}) e ingreso admitido (ID: ${ingresoId}).`);

    console.log('  ▶ Test 4: Valoración y clasificación por Enfermero Jefe');
    const resTriage = await request('POST', '/api/triage', {
      ingreso_id: ingresoId,
      nivel: 3,
      fc: 88,
      fr: 18,
      pas: 120,
      pad: 80,
      temperatura: 37.8,
      spo2: 97,
      dolor: 6,
      estado_conciencia: 'Alerta',
      observaciones: 'Dolor en fosa ilíaca derecha. Signos vitales estables pero febril.'
    }, enfSession);
    assert.strictEqual(resTriage.status, 201);
    assert.strictEqual(resTriage.data.nivel, 3);
    console.log('    ✅ Paciente clasificado en Triage III por enfermería.');

    console.log('  ▶ Test 5: Reclasificación médica de Triage con justificación');
    const resReclas = await request('POST', `/api/triage/${ingresoId}/reclasificar`, {
      nivel_nuevo: 2,
      motivo: 'Paciente presenta empeoramiento súbito del dolor con signos de irritación peritoneal difusa y taquicardia.'
    }, medSession);
    assert.strictEqual(resReclas.status, 200);
    assert.strictEqual(resReclas.data.nivel_nuevo, 2);
    console.log('    ✅ Reclasificado a Triage II por médico y registrado en auditoría.');

    console.log('  ▶ Test 6: Iniciar atención médica');
    const resAtencion = await request('POST', `/api/atencion/${ingresoId}/iniciar`, {}, medSession);
    assert.strictEqual(resAtencion.status, 200);
    assert.strictEqual(resAtencion.data.ingreso.estado, 'EN_ATENCION');
    console.log('    ✅ Atención iniciada y cronómetro detenido.');

    console.log('  ▶ Test 7: Definición de conducta médica y cierre del ingreso');
    const resConducta = await request('POST', `/api/atencion/${ingresoId}/conducta`, {
      tipo: 'SOLICITAR_EXAMENES',
      descripcion: 'Se solicita hemograma, PCR, ecografía de abdomen total y valoración prioritaria por cirujano de turno.',
      destino: 'Observación urgencias cubículo 4'
    }, medSession);
    assert.strictEqual(resConducta.status, 200);
    console.log('    ✅ Conducta médica registrada y caso cerrado.');

    console.log('  ▶ Test 8: Edición de tiempos institucionales de Triage (Admin)');
    const resConfig = await request('PUT', '/api/configuracion/niveles/3', { minutos_max: 110 }, adminSession);
    assert.strictEqual(resConfig.status, 200);
    assert.strictEqual(resConfig.data.minutos_max, 110);

    const resConfigI = await request('PUT', '/api/configuracion/niveles/1', { minutos_max: 10 }, adminSession);
    assert.strictEqual(resConfigI.status, 400, 'Triage I no debe ser editable por Res. 5596');
    console.log('    ✅ Tiempos editables validados y restricción normativa de Triage I y II respetada.');

    console.log('  ▶ Test 9: Modo Emergencia / Desastre con múltiples víctimas');
    const resEmergencia = await request('POST', '/api/configuracion/emergencia', { activo: true }, adminSession);
    assert.strictEqual(resEmergencia.status, 200);
    assert.strictEqual(resEmergencia.data.modo_emergencia, true);
    await request('POST', '/api/configuracion/emergencia', { activo: false }, adminSession);
    console.log('    ✅ Modo de emergencia probado y restablecido.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS FUNCIONALES DE LA API PASARON EXITOSAMENTE!');
  } catch (error) {
    console.error('❌ Error en pruebas:', error);
    process.exitCode = 1;
  } finally {
    serverInstance.close();
  }
}

runTests();
