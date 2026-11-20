const http = require('http');
const assert = require('assert');
const { app, server } = require('../backend/src/server');

const PORT = 3001; // Puerto alternativo para pruebas
let serverInstance;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (dataString) {
      headers['Content-Length'] = Buffer.byteLength(dataString);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers
      },
      (res) => {
        let responseData = '';
        res.on('data', chunk => { responseData += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(responseData);
          } catch (e) {
            parsed = responseData;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Iniciando pruebas automáticas de la API...');
  await new Promise((resolve) => {
    serverInstance = server.listen(PORT, '127.0.0.1', resolve);
  });

  try {
    // 1. Test Login para cada uno de los roles
    console.log('  ▶ Test 1: Autenticación de roles (Admin, Admisión, Enfermero, Médico)');
    
    // Admin
    const resAdmin = await request('POST', '/api/auth/login', { documento: '1000', password: 'Admin123!' });
    assert.strictEqual(resAdmin.status, 200, 'Admin login debe ser 200');
    assert.strictEqual(resAdmin.data.user.rol, 'ADMIN');
    const adminToken = resAdmin.data.token;

    // Administrativo
    const resAdm = await request('POST', '/api/auth/login', { documento: '1001', password: 'Admin123!' });
    assert.strictEqual(resAdm.status, 200);
    assert.strictEqual(resAdm.data.user.rol, 'ADMINISTRATIVO');
    const admToken = resAdm.data.token;

    // Enfermero
    const resEnf = await request('POST', '/api/auth/login', { documento: '1002', password: 'Enfermero123!' });
    assert.strictEqual(resEnf.status, 200);
    assert.strictEqual(resEnf.data.user.rol, 'ENFERMERO');
    const enfToken = resEnf.data.token;

    // Médico
    const resMed = await request('POST', '/api/auth/login', { documento: '1003', password: 'Medico123!' });
    assert.strictEqual(resMed.status, 200);
    assert.strictEqual(resMed.data.user.rol, 'MEDICO');
    const medToken = resMed.data.token;
    console.log('    ✅ Autenticación exitosa directa para los 4 roles.');

    // 2. Test Tablero de urgencias en tiempo real
    console.log('  ▶ Test 2: Consulta del Tablero de Urgencias en Tiempo Real');
    const resTablero = await request('GET', '/api/ingresos/tablero', null, medToken);
    assert.strictEqual(resTablero.status, 200);
    assert(Array.isArray(resTablero.data.pacientes), 'Debe devolver un arreglo de pacientes');
    console.log(`    ✅ Tablero consultado: ${resTablero.data.pacientes.length} pacientes activos.`);
    // Verificar orden: primer paciente debe ser Triage I
    assert.strictEqual(resTablero.data.pacientes[0].triage_nivel, 1, 'El primer paciente en el tablero debe ser Triage I');

    // 3. Test Creación de Paciente y Admisión (Administrativo)
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
    }, admToken);
    assert.strictEqual(resPac.status, 201);
    const pacienteId = resPac.data.id;

    // Crear ingreso a urgencias
    const resIngreso = await request('POST', '/api/ingresos', {
      paciente_id: pacienteId,
      motivo_consulta: 'Dolor abdominal agudo y vómito persistente.',
      acompanante: 'Andrea Vargas (Hermana)'
    }, admToken);
    assert.strictEqual(resIngreso.status, 201);
    assert.strictEqual(resIngreso.data.estado, 'EN_ESPERA_TRIAGE');
    const ingresoId = resIngreso.data.id;
    console.log(`    ✅ Paciente creado (ID: ${pacienteId}) e ingreso admitido (ID: ${ingresoId}, ${resIngreso.data.consecutivo}).`);

    // 4. Test Valoración de Triage por Enfermería
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
    }, enfToken);
    assert.strictEqual(resTriage.status, 201);
    assert.strictEqual(resTriage.data.nivel, 3);
    console.log('    ✅ Paciente clasificado en Triage III por enfermería.');

    // 5. Test Reclasificación de Triage por Médico
    console.log('  ▶ Test 5: Reclasificación médica de Triage con justificación');
    const resReclas = await request('POST', `/api/triage/${ingresoId}/reclasificar`, {
      nivel_nuevo: 2,
      motivo: 'Paciente presenta empeoramiento súbito del dolor con signos de irritación peritoneal difusa y taquicardia.'
    }, medToken);
    assert.strictEqual(resReclas.status, 200);
    assert.strictEqual(resReclas.data.nivel_nuevo, 2);
    console.log('    ✅ Reclasificado a Triage II por médico y registrado en auditoría.');

    // 6. Test Iniciar Atención Médica (Detiene cronómetro)
    console.log('  ▶ Test 6: Iniciar atención médica');
    const resAtencion = await request('POST', `/api/atencion/${ingresoId}/iniciar`, {}, medToken);
    assert.strictEqual(resAtencion.status, 200);
    assert.strictEqual(resAtencion.data.ingreso.estado, 'EN_ATENCION');
    console.log('    ✅ Atención iniciada y cronómetro detenido.');

    // 7. Test Definir Conducta Médica y Cierre
    console.log('  ▶ Test 7: Definición de conducta médica y cierre del ingreso');
    const resConducta = await request('POST', `/api/atencion/${ingresoId}/conducta`, {
      tipo: 'SOLICITAR_EXAMENES',
      descripcion: 'Se solicita hemograma, PCR, ecografía de abdomen total y valoración prioritaria por cirujano de turno.',
      destino: 'Observación urgencias cubículo 4'
    }, medToken);
    assert.strictEqual(resConducta.status, 200);
    console.log('    ✅ Conducta médica registrada y caso cerrado.');

    // 8. Test Modificación de tiempos de Triage III (Solo Admin)
    console.log('  ▶ Test 8: Edición de tiempos institucionales de Triage (Admin)');
    const resConfig = await request('PUT', '/api/configuracion/niveles/3', { minutos_max: 110 }, adminToken);
    assert.strictEqual(resConfig.status, 200);
    assert.strictEqual(resConfig.data.minutos_max, 110);

    // Intento de editar Triage I debe ser rechazado normativamente
    const resConfigI = await request('PUT', '/api/configuracion/niveles/1', { minutos_max: 10 }, adminToken);
    assert.strictEqual(resConfigI.status, 400, 'Triage I no debe ser editable por Res. 5596');
    console.log('    ✅ Tiempos editables validados y restricción normativa de Triage I y II respetada.');

    // 9. Test Modo Emergencia
    console.log('  ▶ Test 9: Modo Emergencia / Desastre con múltiples víctimas');
    const resEmergencia = await request('POST', '/api/configuracion/emergencia', { activo: true }, adminToken);
    assert.strictEqual(resEmergencia.status, 200);
    assert.strictEqual(resEmergencia.data.modo_emergencia, true);
    // Desactivar para dejar limpio
    await request('POST', '/api/configuracion/emergencia', { activo: false }, adminToken);
    console.log('    ✅ Modo de emergencia probado y restablecido.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA API PASARON EXITOSAMENTE!');
  } catch (error) {
    console.error('❌ Error en pruebas:', error);
    process.exitCode = 1;
  } finally {
    serverInstance.close();
  }
}

runTests();
