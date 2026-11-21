// VISTA: TABLERO DE URGENCIAS EN TIEMPO REAL (PIEZA CENTRAL)

const TableroView = {
  currentFilterNivel: 'ALL',
  currentFilterAlerta: 'ALL',
  searchTerm: '',
  data: [],

  async render(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Encabezado del Tablero y Controles de Filtro -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Tablero de Urgencias en Tiempo Real</h1>
                <span id="socket-status-badge"></span>
              </div>
              <p class="text-sm text-slate-500 mt-0.5">
                Monitor clínico continuo según Resolución 5596 de 2015 (MinSalud Colombia). Priorización estricta por riesgo vital.
              </p>
            </div>
            
            <div class="flex flex-wrap items-center gap-2">
              <!-- Buscador en tiempo real -->
              <div class="relative w-full sm:w-64">
                <input 
                  type="text" 
                  id="input-buscar-tablero" 
                  placeholder="🔍 Buscar paciente o cédula..." 
                  value="${App.escapeHtml(this.searchTerm)}"
                  class="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                <button id="btn-clear-search-tablero" class="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs ${this.searchTerm ? '' : 'hidden'}">&times;</button>
              </div>

              <button id="btn-refresh-tablero" class="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          <!-- Métricas Resumen de Sala (Pills interactivas) -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4" id="tablero-stats-bar">
            <!-- Inyectado dinámicamente -->
          </div>

          <!-- Barra de Filtros -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtrar Nivel:</span>
              <button data-filter-nivel="ALL" class="btn-filter-nivel px-2.5 py-1 text-xs font-bold rounded bg-blue-600 text-white">Todos</button>
              <button data-filter-nivel="1" class="btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800 hover:bg-red-200">Triage I (Rojo)</button>
              <button data-filter-nivel="2" class="btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md bg-orange-100 text-orange-800 hover:bg-orange-200">Triage II (Naranja)</button>
              <button data-filter-nivel="3" class="btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200">Triage III (Amarillo)</button>
              <button data-filter-nivel="4" class="btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200">Triage IV (Verde)</button>
              <button data-filter-nivel="5" class="btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200">Triage V (Azul)</button>
            </div>

            <div class="flex items-center gap-3">
              <span id="tablero-contador-visibles" class="text-xs font-medium text-slate-500"></span>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado:</span>
                <select id="select-filter-alerta" class="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500">
                  <option value="ALL">Todas las Alertas</option>
                  <option value="POR_VENCER">Por Vencer (>75%)</option>
                  <option value="VENCIDO">Tiempo Vencido (>100%)</option>
                  <option value="EN_ATENCION">En Atención Médica</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Contenedor de Tarjetas de Pacientes en Espera / Atención -->
        <div id="tablero-cards-container" class="space-y-4">
          <div class="text-center py-12 text-slate-400">
            <i data-lucide="loader" class="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2"></i>
            <p class="text-sm">Cargando pacientes del servicio de urgencias...</p>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadData();
  },

  bindEvents(container) {
    const refreshBtn = container.querySelector('#btn-refresh-tablero');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.loadData();
    }

    const inputBuscar = container.querySelector('#input-buscar-tablero');
    const btnClearSearch = container.querySelector('#btn-clear-search-tablero');

    if (inputBuscar) {
      inputBuscar.oninput = (e) => {
        this.searchTerm = e.target.value.trim();
        if (btnClearSearch) {
          btnClearSearch.classList.toggle('hidden', !this.searchTerm);
        }
        this.renderCards();
      };
    }

    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        this.searchTerm = '';
        if (inputBuscar) inputBuscar.value = '';
        btnClearSearch.classList.add('hidden');
        this.renderCards();
      };
    }

    const filterNivelBtns = container.querySelectorAll('.btn-filter-nivel');
    filterNivelBtns.forEach(btn => {
      btn.onclick = () => {
        filterNivelBtns.forEach(b => {
          b.className = 'btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200';
        });
        btn.className = 'btn-filter-nivel px-2.5 py-1 text-xs font-bold rounded bg-blue-600 text-white';
        this.currentFilterNivel = btn.getAttribute('data-filter-nivel');
        this.renderCards();
      };
    });

    const selectAlerta = container.querySelector('#select-filter-alerta');
    if (selectAlerta) {
      selectAlerta.onchange = (e) => {
        this.currentFilterAlerta = e.target.value;
        this.renderCards();
      };
    }
  },

  async loadData() {
    try {
      const res = await API.get('/ingresos/tablero');
      this.data = res.pacientes || [];
      if (window.App && res.modo_emergencia !== undefined) {
        window.App.setEmergencyModeBanner(res.modo_emergencia);
      }
      this.renderStats();
      this.renderCards();
    } catch (err) {
      API.showToast('Error al cargar datos del tablero: ' + err.message, 'error');
    }
  },

  filtrarRapido(tipo, valor) {
    if (tipo === 'nivel') {
      this.currentFilterNivel = valor;
      this.currentFilterAlerta = 'ALL';
    } else if (tipo === 'alerta') {
      this.currentFilterAlerta = valor;
      this.currentFilterNivel = 'ALL';
    }
    const selectAlerta = document.getElementById('select-filter-alerta');
    if (selectAlerta) selectAlerta.value = this.currentFilterAlerta;

    const filterNivelBtns = document.querySelectorAll('.btn-filter-nivel');
    filterNivelBtns.forEach(btn => {
      if (btn.getAttribute('data-filter-nivel') === String(this.currentFilterNivel)) {
        btn.className = 'btn-filter-nivel px-2.5 py-1 text-xs font-bold rounded bg-blue-600 text-white shadow-sm';
      } else {
        btn.className = 'btn-filter-nivel px-2.5 py-1 text-xs font-medium rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200';
      }
    });
    this.renderCards();
  },

  renderStats() {
    const bar = document.getElementById('tablero-stats-bar');
    if (!bar) return;

    const total = this.data.length;
    const t1 = this.data.filter(p => p.triage_nivel === 1).length;
    const t2 = this.data.filter(p => p.triage_nivel === 2).length;
    const t3 = this.data.filter(p => p.triage_nivel === 3).length;
    const t4t5 = this.data.filter(p => p.triage_nivel >= 4).length;
    const vencidos = this.data.filter(p => p.alerta_estado === 'VENCIDO').length;

    bar.innerHTML = `
      <div onclick="TableroView.filtrarRapido('nivel', 'ALL')" class="cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 rounded-lg border border-slate-200 text-center transition-all hover:scale-[1.02]">
        <span class="text-xs font-bold text-slate-400 block uppercase">Total Activos</span>
        <span class="text-xl font-extrabold text-slate-800">${total}</span>
      </div>
      <div onclick="TableroView.filtrarRapido('nivel', '1')" class="cursor-pointer bg-red-50 hover:bg-red-100 p-3 rounded-lg border border-red-200 text-center transition-all hover:scale-[1.02]">
        <span class="text-xs font-bold text-red-600 block uppercase">Triage I (Rojo)</span>
        <span class="text-xl font-extrabold text-red-700">${t1}</span>
      </div>
      <div onclick="TableroView.filtrarRapido('nivel', '2')" class="cursor-pointer bg-orange-50 hover:bg-orange-100 p-3 rounded-lg border border-orange-200 text-center transition-all hover:scale-[1.02]">
        <span class="text-xs font-bold text-orange-600 block uppercase">Triage II</span>
        <span class="text-xl font-extrabold text-orange-700">${t2}</span>
      </div>
      <div onclick="TableroView.filtrarRapido('nivel', '3')" class="cursor-pointer bg-amber-50 hover:bg-amber-100 p-3 rounded-lg border border-amber-200 text-center transition-all hover:scale-[1.02]">
        <span class="text-xs font-bold text-amber-600 block uppercase">Triage III</span>
        <span class="text-xl font-extrabold text-amber-700">${t3}</span>
      </div>
      <div onclick="TableroView.filtrarRapido('nivel', '4')" class="cursor-pointer bg-emerald-50 hover:bg-emerald-100 p-3 rounded-lg border border-emerald-200 text-center transition-all hover:scale-[1.02]">
        <span class="text-xs font-bold text-emerald-600 block uppercase">Triage IV & V</span>
        <span class="text-xl font-extrabold text-emerald-700">${t4t5}</span>
      </div>
      <div onclick="TableroView.filtrarRapido('alerta', 'VENCIDO')" class="cursor-pointer bg-rose-50 hover:bg-rose-100 p-3 rounded-lg border border-rose-200 text-center transition-all hover:scale-[1.02]">
        <span class="text-xs font-bold text-rose-600 block uppercase">Tiempo Vencido</span>
        <span class="text-xl font-extrabold text-rose-700">${vencidos}</span>
      </div>
    `;
  },

  renderCards() {
    const container = document.getElementById('tablero-cards-container');
    if (!container) return;

    TimerEngine.clearAll();

    let filtered = [...this.data];

    // Filtrar por término de búsqueda en vivo
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const nombreCompleto = `${p.nombres || ''} ${p.apellidos || ''}`.toLowerCase();
        const doc = String(p.numero_documento || '').toLowerCase();
        const consecutivo = String(p.consecutivo || '').toLowerCase();
        const motivo = String(p.motivo_consulta || '').toLowerCase();
        return nombreCompleto.includes(q) || doc.includes(q) || consecutivo.includes(q) || motivo.includes(q);
      });
    }

    // Filtrar por nivel
    if (this.currentFilterNivel !== 'ALL') {
      const n = parseInt(this.currentFilterNivel, 10);
      if (n === 4) {
        // Triage IV & V juntos si se seleccionó la tarjeta combinada o 4
        filtered = filtered.filter(p => p.triage_nivel === 4 || p.triage_nivel === 5);
      } else {
        filtered = filtered.filter(p => p.triage_nivel === n);
      }
    }

    // Filtrar por alerta/estado
    if (this.currentFilterAlerta === 'POR_VENCER') {
      filtered = filtered.filter(p => p.alerta_estado === 'POR_VENCER');
    } else if (this.currentFilterAlerta === 'VENCIDO') {
      filtered = filtered.filter(p => p.alerta_estado === 'VENCIDO');
    } else if (this.currentFilterAlerta === 'EN_ATENCION') {
      filtered = filtered.filter(p => p.estado === 'EN_ATENCION');
    }

    const contadorEl = document.getElementById('tablero-contador-visibles');
    if (contadorEl) {
      contadorEl.textContent = `Mostrando ${filtered.length} de ${this.data.length}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <i data-lucide="check-circle" class="w-12 h-12 mx-auto text-emerald-500 mb-3"></i>
          <h3 class="text-base font-semibold text-slate-700">No hay pacientes con el filtro seleccionado</h3>
          <p class="text-sm mt-1">El servicio de urgencias se encuentra al día en este criterio de clasificación.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const user = API.getUser();
    const isDoctor = user && (user.rol === 'MEDICO' || user.rol === 'ADMIN');

    container.innerHTML = filtered.map(p => {
      const calc = TimerEngine.calculateStatus(p);
      const borderClass = `card-triage-${p.triage_nivel}`;
      const badgeClass = `badge-triage-${p.triage_nivel}`;
      const alertClass = calc.alertState === 'VENCIDO' ? 'alerta-vencido' : (calc.alertState === 'POR_VENCER' ? 'alerta-por-vencer' : '');

      // Calcular edad
      let edadTexto = '';
      if (p.fecha_nacimiento) {
        const edadAnos = Math.floor((new Date() - new Date(p.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000));
        edadTexto = `${edadAnos} años`;
      }

      return `
        <div id="card-paciente-${p.ingreso_id}" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${borderClass} ${alertClass}">
          <div class="p-5">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              <!-- Columna 1: Nivel de Triage e Identificación del Paciente -->
              <div class="flex items-start gap-4 flex-1">
                <div class="flex flex-col items-center justify-center w-20 h-20 rounded-xl ${badgeClass} text-white shadow-md flex-shrink-0">
                  <span class="text-xs uppercase font-extrabold tracking-wider">Nivel</span>
                  <span class="text-3xl font-black">${p.triage_nivel}</span>
                  <span class="text-[10px] font-semibold uppercase tracking-tight">${p.triage_color_nombre}</span>
                </div>

                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      ${p.consecutivo}
                    </span>
                    <h3 class="text-lg font-bold text-slate-900">${p.nombres} ${p.apellidos}</h3>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      ${p.tipo_documento} ${p.numero_documento}
                    </span>
                    ${p.total_reclasificaciones > 0 ? `
                      <button onclick="App.verHistorialReclasificaciones(${p.ingreso_id})" class="text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 flex items-center gap-1">
                        <i data-lucide="history" class="w-3 h-3"></i> Reclasificado (${p.total_reclasificaciones})
                      </button>
                    ` : ''}
                  </div>

                  <div class="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                    <span><strong>Edad/Sexo:</strong> ${edadTexto || 'N/A'} • ${p.sexo === 'M' ? 'Masculino' : (p.sexo === 'F' ? 'Femenino' : 'Otro')}</span>
                    <span><strong>EPS:</strong> ${p.eps}</span>
                    <span><strong>Llegada:</strong> ${p.fecha_llegada ? p.fecha_llegada.substring(11, 16) : ''}</span>
                    <span><strong>Clasificado por:</strong> ${p.clasificado_por_nombre || 'Enfermería'}</span>
                  </div>

                  <div class="mt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                    <p><strong>Motivo de Consulta:</strong> ${p.motivo_consulta}</p>
                    <p class="mt-1 text-slate-600"><strong>Observación Triage:</strong> ${p.triage_observaciones}</p>
                  </div>
                </div>
              </div>

              <!-- Columna 2: Cronómetro en Vivo y Estado de Tiempo -->
              <div class="lg:w-80 flex flex-col justify-between bg-slate-50/80 p-4 rounded-xl border border-slate-200 flex-shrink-0">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-slate-500 uppercase">Tiempo Transcurrido</span>
                  <div id="badge-status-${p.ingreso_id}">
                    <!-- Inyectado por TimerEngine -->
                  </div>
                </div>

                <!-- Gran Reloj Digital -->
                <div class="text-center py-1">
                  <div id="clock-${p.ingreso_id}" class="digital-clock text-3xl font-extrabold text-slate-900 tracking-wider">
                    ${calc.elapsedFormatted}
                  </div>
                  <div id="remaining-${p.ingreso_id}" class="text-xs font-semibold text-slate-500 mt-1">
                    ${p.triage_nivel === 1 ? 'ATENCIÓN INMEDIATA' : (calc.remainingSeconds < 0 ? `VENCIDO ${calc.remainingFormatted}` : `Restante: ${calc.remainingFormatted}`)}
                  </div>
                </div>

                <!-- Barra de Progreso de Tiempo -->
                <div class="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                  <div id="progress-${p.ingreso_id}" class="h-2 rounded-full transition-all duration-500 ${calc.alertState === 'VENCIDO' ? 'bg-red-600' : (calc.alertState === 'POR_VENCER' ? 'bg-amber-500' : 'bg-emerald-500')}" style="width: ${calc.percent}%"></div>
                </div>

                <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>0 min</span>
                  <span>Máx: ${p.triage_minutos_max} min</span>
                </div>
              </div>

            </div>

            <!-- Fila Inferior: Signos Vitales y Acciones Médicas -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-100">
              
              <!-- Mini Grid de Signos Vitales -->
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="font-bold text-slate-400 text-[10px] uppercase">Signos Vitales:</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">FC: <strong>${p.fc || '--'}</strong> lpm</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">FR: <strong>${p.fr || '--'}</strong> rpm</span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">PA: <strong>${p.pas && p.pad ? `${p.pas}/${p.pad}` : '--'}</strong></span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">Temp: <strong>${p.temperatura ? `${p.temperatura}°C` : '--'}</strong></span>
                <span class="px-2 py-0.5 rounded ${p.spo2 && p.spo2 < 92 ? 'bg-red-100 text-red-700 font-bold' : 'bg-slate-100 text-slate-700 font-medium'}">SpO2: <strong>${p.spo2 ? `${p.spo2}%` : '--'}</strong></span>
                <span class="px-2 py-0.5 rounded ${p.dolor >= 8 ? 'bg-orange-100 text-orange-800 font-bold' : 'bg-slate-100 text-slate-700 font-medium'}">Dolor EVA: <strong>${p.dolor !== null ? `${p.dolor}/10` : '--'}</strong></span>
                <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">Conciencia: <strong>${p.estado_conciencia || 'Alerta'}</strong></span>
              </div>

              <!-- Botones de Acción Contextual por Rol -->
              <div class="flex items-center gap-2 self-end sm:self-auto">
                ${isDoctor ? `
                  ${p.estado !== 'EN_ATENCION' ? `
                    <button onclick="App.iniciarAtencion(${p.ingreso_id})" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors">
                      <i data-lucide="stethoscope" class="w-3.5 h-3.5"></i>
                      <span>Iniciar Atención</span>
                    </button>
                  ` : `
                    <span class="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1">
                      <i data-lucide="check" class="w-3.5 h-3.5"></i> En Atención
                    </span>
                  `}

                  <button onclick="App.abrirModalReclasificar(${p.ingreso_id}, ${p.triage_nivel})" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 transition-colors">
                    <i data-lucide="sliders" class="w-3.5 h-3.5"></i>
                    <span>Reclasificar</span>
                  </button>

                  <button onclick="App.abrirModalConducta(${p.ingreso_id})" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-colors">
                    <i data-lucide="file-check" class="w-3.5 h-3.5"></i>
                    <span>Definir Conducta</span>
                  </button>
                ` : `
                  <button onclick="App.verFichaPaciente(${p.paciente_id})" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Ver Ficha</span>
                  </button>
                `}
              </div>

            </div>

          </div>
        </div>
      `;
    }).join('');

    // Registrar los cronómetros en el motor TimerEngine
    filtered.forEach(p => {
      const card = document.getElementById(`card-paciente-${p.ingreso_id}`);
      const elapsed = document.getElementById(`clock-${p.ingreso_id}`);
      const remaining = document.getElementById(`remaining-${p.ingreso_id}`);
      const progressBar = document.getElementById(`progress-${p.ingreso_id}`);
      const badge = document.getElementById(`badge-status-${p.ingreso_id}`);

      TimerEngine.registerPatient(p, {
        card,
        elapsed,
        remaining,
        progressBar,
        badge
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }
};

