// VISTA: PANEL MÉDICO (MIS PACIENTES, CONDUCTAS Y RECLASIFICACIÓN)

const MedicoView = {
  async renderMisPacientes(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Mis Pacientes Atendidos</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Pacientes que se encuentran actualmente bajo su atención o con conducta médica emitida en su turno.
            </p>
          </div>

          <button id="btn-refresh-mis-pacientes" class="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Actualizar</span>
          </button>
        </div>

        <div id="mis-pacientes-container" class="space-y-4">
          <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <i data-lucide="loader" class="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2"></i>
            <p class="text-sm">Cargando pacientes asignados...</p>
          </div>
        </div>
      </div>
    `;

    const btnRefresh = container.querySelector('#btn-refresh-mis-pacientes');
    if (btnRefresh) btnRefresh.onclick = () => this.loadMisPacientes();

    await this.loadMisPacientes();
  },

  async loadMisPacientes() {
    try {
      const pacientes = await API.get('/atencion/mis-pacientes');
      const container = document.getElementById('mis-pacientes-container');
      if (!container) return;

      if (!pacientes || pacientes.length === 0) {
        container.innerHTML = `
          <div class="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <i data-lucide="stethoscope" class="w-12 h-12 mx-auto text-blue-500 mb-3"></i>
            <h3 class="text-base font-semibold text-slate-700">No tiene pacientes en atención actualmente</h3>
            <p class="text-sm mt-1">Consulte el Tablero de Urgencias para iniciar la atención de pacientes en espera según prioridad de Triage.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      container.innerHTML = pacientes.map(p => {
        const isClosed = p.estado === 'CERRADO';
        return `
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-slate-300 transition-all">
            <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div class="space-y-2 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">${App.escapeHtml(p.consecutivo)}</span>
                  <h3 class="text-base font-bold text-slate-900">${App.escapeHtml(p.nombres)} ${App.escapeHtml(p.apellidos)}</h3>
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full badge-triage-${Number(p.triage_nivel) || 1}">
                    ${App.escapeHtml(p.triage_nombre || `Triage ${p.triage_nivel}`)}
                  </span>
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${isClosed ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'}">
                    ${isClosed ? 'Conducta Definida / Cerrado' : 'En Atención Médica Activa'}
                  </span>
                </div>

                <div class="text-xs text-slate-500 flex flex-wrap gap-4">
                  <span><strong>Documento:</strong> ${App.escapeHtml(p.tipo_documento)} ${App.escapeHtml(p.numero_documento)}</span>
                  <span><strong>EPS:</strong> ${App.escapeHtml(p.eps)}</span>
                  <span><strong>Llegada:</strong> ${App.escapeHtml(p.fecha_llegada ? p.fecha_llegada.substring(11, 16) : '')}</span>
                </div>

                <div class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <p><strong>Motivo:</strong> ${App.escapeHtml(p.motivo_consulta)}</p>
                  ${p.conducta_tipo ? `
                    <div class="mt-2 pt-2 border-t border-slate-200 text-slate-800">
                      <strong class="text-blue-700">Conducta:</strong> ${App.escapeHtml(p.conducta_tipo.replace('_', ' '))}
                      <p class="text-slate-600 mt-0.5">${App.escapeHtml(p.conducta_descripcion)}</p>
                      ${p.conducta_destino ? `<p class="text-slate-500 mt-0.5"><strong>Destino:</strong> ${App.escapeHtml(p.conducta_destino)}</p>` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                ${!isClosed ? `
                  <button onclick="App.abrirModalConducta(${p.id})" class="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
                    <i data-lucide="file-check" class="w-3.5 h-3.5"></i> Definir Conducta
                  </button>
                ` : ''}
                <button onclick="App.verFichaPaciente(${p.paciente_id})" class="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
                  Ver Historial
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      API.showToast('Error al cargar mis pacientes: ' + err.message, 'error');
    }
  },

  async renderHistorial(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Historial y Tiempos de Respuesta de Urgencias</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Registro retrospectivo de ingresos, nivel de triage, tiempo de espera hasta la atención y destino médico.
            </p>
          </div>

          <button id="btn-refresh-historial" class="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Actualizar</span>
          </button>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">Consecutivo</th>
                  <th class="px-4 py-3">Fecha / Hora</th>
                  <th class="px-4 py-3">Paciente</th>
                  <th class="px-4 py-3">Nivel Triage</th>
                  <th class="px-4 py-3">Tiempo Espera</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">Conducta Médica</th>
                  <th class="px-4 py-3">Médico</th>
                </tr>
              </thead>
              <tbody id="tabla-historial-body" class="divide-y divide-slate-100">
                <tr>
                  <td colspan="8" class="px-4 py-8 text-center text-slate-400">
                    <i data-lucide="loader" class="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"></i>
                    Cargando historial de atenciones...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const btnRefresh = container.querySelector('#btn-refresh-historial');
    if (btnRefresh) btnRefresh.onclick = () => this.loadHistorial();

    await this.loadHistorial();
  },

  async loadHistorial() {
    try {
      const historial = await API.get('/atencion/historial');
      const tbody = document.getElementById('tabla-historial-body');
      if (!tbody) return;

      if (!historial || historial.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400">No hay registros de atenciones pasadas.</td></tr>`;
        return;
      }

      tbody.innerHTML = historial.map(h => {
        const colors = {
          1: 'bg-red-600 text-white',
          2: 'bg-orange-500 text-white',
          3: 'bg-amber-500 text-white',
          4: 'bg-emerald-600 text-white',
          5: 'bg-blue-600 text-white'
        };

        const espera = h.minutos_espera_atencion !== null ? `${h.minutos_espera_atencion} min` : 'En curso';
        const limite = h.minutos_max || 0;
        const excedido = h.minutos_espera_atencion && limite > 0 && h.minutos_espera_atencion > limite;

        return `
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="px-4 py-3 font-mono font-bold text-slate-800 text-xs">${App.escapeHtml(h.consecutivo)}</td>
            <td class="px-4 py-3 text-xs text-slate-600">${App.escapeHtml(h.fecha_llegada ? h.fecha_llegada.substring(0, 16) : '')}</td>
            <td class="px-4 py-3">
              <strong class="text-slate-800 block text-xs">${App.escapeHtml(h.nombres)} ${App.escapeHtml(h.apellidos)}</strong>
              <span class="text-[11px] text-slate-400">${App.escapeHtml(h.tipo_documento)} ${App.escapeHtml(h.numero_documento)}</span>
            </td>
            <td class="px-4 py-3">
              ${h.triage_nivel ? `<span class="px-2 py-0.5 text-xs font-bold rounded ${colors[h.triage_nivel]}">${App.escapeHtml(h.triage_nombre)}</span>` : '<span class="text-slate-400 italic text-xs">Sin clasificar</span>'}
            </td>
            <td class="px-4 py-3 text-xs font-semibold ${excedido ? 'text-red-600' : 'text-slate-700'}">
              ${espera} ${excedido ? '<span class="text-[10px] block text-red-500 font-bold">(Excedió límite)</span>' : ''}
            </td>
            <td class="px-4 py-3 text-xs">
              <span class="px-2 py-0.5 rounded font-medium ${h.estado === 'CERRADO' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-800'}">
                ${App.escapeHtml(h.estado)}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-700">
              ${h.conducta_tipo ? `<strong>${App.escapeHtml(h.conducta_tipo.replace(/_/g, ' '))}</strong>` : '<span class="text-slate-400 italic">No definida</span>'}
            </td>
            <td class="px-4 py-3 text-xs text-slate-600">${h.atendido_por ? App.escapeHtml(h.atendido_por) : '<span class="text-slate-300">--</span>'}</td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      API.showToast('Error al cargar historial: ' + err.message, 'error');
    }
  }
};

