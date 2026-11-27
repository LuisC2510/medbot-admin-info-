// VISTA: ENFERMERÍA Y CLASIFICACIÓN DE TRIAGE (RESOLUCIÓN 5596 DE 2015)

const EnfermeriaView = {
  async render(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Encabezado de Enfermería -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Cola de Valoración de Triage</h1>
              <span id="badge-cola-total" class="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">0 pendientes</span>
            </div>
            <p class="text-sm text-slate-500 mt-0.5">
              Pacientes admitidos en espera de examen clínico inicial y asignación de nivel de triage.
            </p>
          </div>

          <button id="btn-refresh-cola" class="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Actualizar Cola</span>
          </button>
        </div>

        <!-- Lista de Pacientes en Espera de Triage -->
        <div id="cola-triage-container" class="space-y-3">
          <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <i data-lucide="loader" class="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2"></i>
            <p class="text-sm">Consultando cola de espera...</p>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadCola();
  },

  bindEvents(container) {
    const btnRefresh = container.querySelector('#btn-refresh-cola');
    if (btnRefresh) btnRefresh.onclick = () => this.loadCola();
  },

  async loadCola() {
    try {
      const cola = await API.get('/ingresos/cola-triage');
      const container = document.getElementById('cola-triage-container');
      const badgeTotal = document.getElementById('badge-cola-total');
      if (!container) return;

      if (badgeTotal) {
        badgeTotal.textContent = `${cola.length} pendientes`;
        badgeTotal.className = cola.length > 0 ? 'px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' : 'px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200';
      }

      if (!cola || cola.length === 0) {
        container.innerHTML = `
          <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <i data-lucide="check-circle" class="w-12 h-12 mx-auto text-emerald-500 mb-3"></i>
            <h3 class="text-base font-semibold text-slate-700">No hay pacientes esperando valoración de Triage</h3>
            <p class="text-sm mt-1">Todos los pacientes admitidos han sido clasificados oportunamente.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      container.innerHTML = cola.map(ing => {
        const edad = ing.fecha_nacimiento ? Math.floor((new Date() - new Date(ing.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000)) : 'N/A';
        const esperaMin = ing.minutos_espera_triage || 0;

        return `
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1.5 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  ${App.escapeHtml(ing.consecutivo)}
                </span>
                <h3 class="text-base font-bold text-slate-900">${App.escapeHtml(ing.nombres)} ${App.escapeHtml(ing.apellidos)}</h3>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  ${App.escapeHtml(ing.tipo_documento)} ${App.escapeHtml(ing.numero_documento)}
                </span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${esperaMin > 20 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}">
                  Espera valoración: ${esperaMin} min
                </span>
              </div>

              <div class="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                <span><strong>Edad/Sexo:</strong> ${edad} años • ${ing.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
                <span><strong>EPS:</strong> ${App.escapeHtml(ing.eps)}</span>
                <span><strong>Hora Llegada:</strong> ${App.escapeHtml(ing.fecha_llegada ? ing.fecha_llegada.substring(11, 16) : '')}</span>
                <span><strong>Acompañante:</strong> ${App.escapeHtml(ing.acompanante || 'Ninguno')}</span>
              </div>

              <div class="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-slate-800">
                <strong>Motivo de Ingreso:</strong> ${App.escapeHtml(ing.motivo_consulta)}
              </div>
            </div>

            <div class="flex items-center gap-3 self-end md:self-auto flex-shrink-0">
              <button onclick="EnfermeriaView.abrirModalClasificar(${ing.id})" class="px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors">
                <i data-lucide="clipboard-check" class="w-4 h-4"></i>
                <span>Valorar y Clasificar</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      API.showToast('Error al cargar cola de triage: ' + err.message, 'error');
    }
  },

  async abrirModalClasificar(ingresoId) {
    try {
      const ing = await API.get(`/ingresos/${ingresoId}`);

      App.abrirModal(`
        <div class="p-6 max-w-3xl">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">${App.escapeHtml(ing.consecutivo)}</span>
                <h2 class="text-xl font-bold text-slate-800">Valoración Clínica de Triage</h2>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Paciente: <strong>${App.escapeHtml(ing.nombres)} ${App.escapeHtml(ing.apellidos)}</strong> (${App.escapeHtml(ing.tipo_documento)} ${App.escapeHtml(ing.numero_documento)}) • EPS: ${App.escapeHtml(ing.eps)}
              </p>
            </div>
            <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>

          <form id="form-valorar-triage" class="space-y-5 mt-4">
            <!-- Motivo de Consulta Reportado en Admisión -->
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span class="font-bold text-slate-700 uppercase block mb-0.5">Motivo de Consulta Reportado:</span>
              <p class="text-slate-800">${ing.motivo_consulta}</p>
            </div>

            <!-- Signos Vitales -->
            <div>
              <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i data-lucide="activity" class="w-4 h-4 text-rose-500"></i> Registro de Signos Vitales
              </h3>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">FC (lpm)</label>
                  <input type="number" id="tri-fc" placeholder="60-100" min="20" max="250" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">FR (rpm)</label>
                  <input type="number" id="tri-fr" placeholder="12-20" min="5" max="60" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">PAS (mmHg)</label>
                  <input type="number" id="tri-pas" placeholder="120" min="40" max="300" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">PAD (mmHg)</label>
                  <input type="number" id="tri-pad" placeholder="80" min="20" max="200" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">Temp (°C)</label>
                  <input type="number" id="tri-temp" step="0.1" placeholder="36.5" min="30" max="43" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 mb-1">SpO2 (%)</label>
                  <input type="number" id="tri-spo2" placeholder="95-100" min="40" max="100" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500">
                </div>
              </div>
            </div>

            <!-- Escala de Dolor (EVA) y Estado de Conciencia -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Escala Visual Analógica de Dolor (EVA): <span id="label-valor-dolor" class="text-blue-600 font-extrabold text-sm">0/10 (Sin dolor)</span>
                </label>
                <input type="range" id="tri-dolor" min="0" max="10" value="0" class="w-full accent-blue-600 cursor-pointer">
                <div class="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>0: Sin dolor</span>
                  <span>5: Moderado</span>
                  <span>10: Insuperable</span>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Estado Neurológico / Conciencia</label>
                <select id="tri-conciencia" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  <option value="Alerta" selected>Alerta (Consciente y orientado)</option>
                  <option value="Responde a voz">Responde a estímulos verbales</option>
                  <option value="Responde a dolor">Responde únicamente a estímulos dolorosos</option>
                  <option value="Inconsciente">Inconsciente / No responde</option>
                </select>
              </div>
            </div>

            <!-- Asistente Clínico Inteligente de Signos Vitales (UX Interactiva) -->
            <div id="panel-asistente-triage" class="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 transition-all">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-base">💡</span>
                  <strong class="text-xs text-blue-900 font-bold uppercase tracking-wider">Asistente Clínico de Triage</strong>
                </div>
                <button type="button" id="btn-aplicar-sugerencia" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 hover:opacity-90 transition-opacity">
                  <span id="badge-sugerencia-triage">Completar datos</span>
                </button>
              </div>
              <p id="texto-sugerencia-triage" class="text-xs text-blue-800 mt-1">
                Ingresa los signos vitales para obtener una sugerencia clínica orientativa según la Resolución 5596.
              </p>
            </div>

            <!-- Selección de Nivel de Triage (Res. 5596/2015) -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-2">
                Clasificación de Nivel de Triage (Resolución 5596 de 2015) *
              </label>
              
              <div class="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <label class="cursor-pointer border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center text-center hover:border-red-500 transition-all has-[:checked]:border-red-600 has-[:checked]:bg-red-50">
                  <input type="radio" name="nivel_triage" value="1" required class="sr-only">
                  <span class="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center mb-1">I</span>
                  <span class="text-xs font-extrabold text-red-700">Triage I</span>
                  <span class="text-[10px] font-semibold text-slate-500">Inmediato</span>
                  <span class="text-[9px] text-slate-400 mt-1">Riesgo vital</span>
                </label>

                <label class="cursor-pointer border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center text-center hover:border-orange-500 transition-all has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50">
                  <input type="radio" name="nivel_triage" value="2" class="sr-only">
                  <span class="w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center mb-1">II</span>
                  <span class="text-xs font-extrabold text-orange-700">Triage II</span>
                  <span class="text-[10px] font-semibold text-slate-500">Hasta 30 min</span>
                  <span class="text-[9px] text-slate-400 mt-1">Deterioro rápido</span>
                </label>

                <label class="cursor-pointer border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center text-center hover:border-amber-500 transition-all has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                  <input type="radio" name="nivel_triage" value="3" class="sr-only">
                  <span class="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center mb-1">III</span>
                  <span class="text-xs font-extrabold text-amber-700">Triage III</span>
                  <span class="text-[10px] font-semibold text-slate-500">Hasta 120 min</span>
                  <span class="text-[9px] text-slate-400 mt-1">Estable / Exámenes</span>
                </label>

                <label class="cursor-pointer border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center text-center hover:border-emerald-500 transition-all has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                  <input type="radio" name="nivel_triage" value="4" class="sr-only">
                  <span class="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-1">IV</span>
                  <span class="text-xs font-extrabold text-emerald-700">Triage IV</span>
                  <span class="text-[10px] font-semibold text-slate-500">Hasta 240 min</span>
                  <span class="text-[9px] text-slate-400 mt-1">Sin riesgo vital</span>
                </label>

                <label class="cursor-pointer border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center text-center hover:border-blue-500 transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <input type="radio" name="nivel_triage" value="5" class="sr-only">
                  <span class="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-1">V</span>
                  <span class="text-xs font-extrabold text-blue-700">Triage V</span>
                  <span class="text-[10px] font-semibold text-slate-500">Hasta 360 min</span>
                  <span class="text-[9px] text-slate-400 mt-1">Sin deterioro</span>
                </label>
              </div>
            </div>

            <!-- Observaciones Clínicas -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Observaciones y Justificación de Triage *</label>
              <textarea id="tri-observaciones" rows="3" required placeholder="Describa los hallazgos semiológicos y la razón de priorización..." class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

            <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" class="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
                Guardar e Iniciar Cronómetro
              </button>
            </div>
          </form>
        </div>
      `);

      const sliderDolor = document.getElementById('tri-dolor');
      const labelDolor = document.getElementById('label-valor-dolor');

      // Evaluador fisiológico en tiempo real (Asistente de Triage)
      let sugerenciaActual = 3;
      const evaluarSignosEnTiempoReal = () => {
        const fc = parseInt(document.getElementById('tri-fc')?.value || 0, 10);
        const fr = parseInt(document.getElementById('tri-fr')?.value || 0, 10);
        const pas = parseInt(document.getElementById('tri-pas')?.value || 0, 10);
        const pad = parseInt(document.getElementById('tri-pad')?.value || 0, 10);
        const temp = parseFloat(document.getElementById('tri-temp')?.value || 0);
        const spo2 = parseInt(document.getElementById('tri-spo2')?.value || 0, 10);
        const dolor = parseInt(sliderDolor?.value || 0, 10);
        const conciencia = document.getElementById('tri-conciencia')?.value || 'Alerta';

        const alertas = [];
        let nivel = 3;

        // Criterios Triage I: Paro, Inconsciencia, Hipoxia extrema, Shock severo
        if (conciencia === 'Inconsciente' || (spo2 > 0 && spo2 < 85) || (pas > 0 && pas < 70) || (fc > 0 && (fc < 35 || fc > 180))) {
          nivel = 1;
          if (conciencia === 'Inconsciente') alertas.push('Inconsciente / No responde');
          if (spo2 > 0 && spo2 < 85) alertas.push(`Hipoxia severa crítica (SpO2 ${spo2}%)`);
          if (pas > 0 && pas < 70) alertas.push(`Shock / Hipotensión extrema (PAS ${pas})`);
          if (fc > 0 && (fc < 35 || fc > 180)) alertas.push(`Frecuencia cardíaca extrema (${fc} lpm)`);
        }
        // Criterios Triage II: Deterioro rápido, dolor insoportable, estupor, hipoxia moderada
        else if (conciencia === 'Responde a dolor' || (spo2 > 0 && spo2 < 92) || (pas > 0 && pas > 180) || (fc > 0 && (fc < 50 || fc > 130)) || dolor >= 8) {
          nivel = 2;
          if (conciencia === 'Responde a dolor') alertas.push('Estupor / Responde solo a dolor');
          if (spo2 > 0 && spo2 < 92) alertas.push(`Hipoxia moderada-severa (SpO2 ${spo2}%)`);
          if (pas > 0 && pas > 180) alertas.push(`Crisis hipertensiva (PAS ${pas})`);
          if (fc > 0 && (fc < 50 || fc > 130)) alertas.push(`Alteración del pulso (${fc} lpm)`);
          if (dolor >= 8) alertas.push(`Dolor severo EVA ${dolor}/10`);
        } else if (temp >= 38.5) {
          nivel = 3;
          alertas.push(`Síndrome febril agudo (${temp}°C)`);
        } else if (dolor >= 4) {
          nivel = 3;
          alertas.push(`Dolor moderado EVA ${dolor}/10`);
        } else if (dolor <= 3 && dolor > 0) {
          nivel = 4;
        }

        sugerenciaActual = nivel;
        const panel = document.getElementById('panel-asistente-triage');
        const badge = document.getElementById('badge-sugerencia-triage');
        const texto = document.getElementById('texto-sugerencia-triage');

        if (!panel || !badge || !texto) return;

        if (nivel === 1) {
          panel.className = 'p-3.5 rounded-xl border border-red-300 bg-red-50 transition-all';
          badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse';
          badge.textContent = '🚨 Sugerencia: Triage I (Inmediato)';
          texto.innerHTML = `<strong class="text-red-800">Riesgo vital detectado:</strong> ${alertas.join(' • ')}. Atención médica inmediata requerida.`;
        } else if (nivel === 2) {
          panel.className = 'p-3.5 rounded-xl border border-orange-300 bg-orange-50 transition-all';
          badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white';
          badge.textContent = '⚠️ Sugerencia: Triage II (Hasta 30 min)';
          texto.innerHTML = `<strong class="text-orange-800">Condición de alto riesgo:</strong> ${alertas.join(' • ')}. Puede deteriorarse con rapidez.`;
        } else if (alertas.length > 0) {
          panel.className = 'p-3.5 rounded-xl border border-amber-300 bg-amber-50 transition-all';
          badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white';
          badge.textContent = '⚡ Sugerencia: Triage III (Hasta 120 min)';
          texto.innerHTML = `<strong class="text-amber-800">Hallazgos clínicos:</strong> ${alertas.join(' • ')}. Paciente estable para exámenes/tratamiento.`;
        } else {
          panel.className = 'p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 transition-all';
          badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white';
          badge.textContent = '✅ Signos en Rango Estable';
          texto.textContent = 'Parámetros vitales en rango normal. Seleccione Triage III, IV o V según el motivo de consulta del paciente.';
        }
      };

      // Botón para aplicar la sugerencia con un clic
      const btnAplicar = document.getElementById('btn-aplicar-sugerencia');
      if (btnAplicar) {
        btnAplicar.onclick = () => {
          const radio = document.querySelector(`input[name="nivel_triage"][value="${sugerenciaActual}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
            API.showToast(`Sugerencia aplicada: Triage ${sugerenciaActual}`, 'info');
          }
        };
      }

      // Escuchar cambios en todos los campos fisiológicos
      ['tri-fc', 'tri-fr', 'tri-pas', 'tri-pad', 'tri-temp', 'tri-spo2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = evaluarSignosEnTiempoReal;
      });

      const selConciencia = document.getElementById('tri-conciencia');
      if (selConciencia) selConciencia.onchange = evaluarSignosEnTiempoReal;

      sliderDolor.oninput = () => {
        const val = sliderDolor.value;
        let desc = 'Sin dolor';
        if (val > 0 && val <= 3) desc = 'Leve';
        else if (val >= 4 && val <= 6) desc = 'Moderado';
        else if (val >= 7 && val <= 9) desc = 'Severo';
        else if (val == 10) desc = 'Insuperable';
        labelDolor.textContent = `${val}/10 (${desc})`;
        evaluarSignosEnTiempoReal();
      };

      const form = document.getElementById('form-valorar-triage');
      form.onsubmit = async (e) => {
        e.preventDefault();

        const nivelRadio = document.querySelector('input[name="nivel_triage"]:checked');
        if (!nivelRadio) {
          API.showToast('Debe seleccionar el nivel de triage (1 al 5).', 'warning');
          return;
        }

        try {
          await API.post('/triage', {
            ingreso_id: ingresoId,
            nivel: parseInt(nivelRadio.value, 10),
            fc: document.getElementById('tri-fc').value || null,
            fr: document.getElementById('tri-fr').value || null,
            pas: document.getElementById('tri-pas').value || null,
            pad: document.getElementById('tri-pad').value || null,
            temperatura: document.getElementById('tri-temp').value || null,
            spo2: document.getElementById('tri-spo2').value || null,
            dolor: parseInt(sliderDolor.value, 10),
            estado_conciencia: document.getElementById('tri-conciencia').value,
            observaciones: document.getElementById('tri-observaciones').value
          });

          API.showToast(`Paciente clasificado exitosamente en Triage ${nivelRadio.value}. Cronómetro activado.`, 'success');
          App.cerrarModal();
          this.loadCola();
        } catch (err) {
          API.showToast(err.message, 'error');
        }
      };

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      API.showToast('Error al abrir valoración: ' + err.message, 'error');
    }
  }
};

