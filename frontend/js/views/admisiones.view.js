// VISTA: ADMISIONES DE URGENCIAS Y REGISTRO DE INGRESOS (ROL ADMINISTRATIVO)

const AdmisionesView = {
  async render(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Encabezado de Admisiones -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Admisiones de Urgencias</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Recepción, apertura de ingresos y asignación a sala de espera de triage. Toda persona tiene derecho a su primera valoración.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button id="btn-modal-nuevo-ingreso" class="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Nueva Admisión / Ingreso</span>
            </button>
          </div>
        </div>

        <!-- Tabla de Ingresos del Día -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i data-lucide="clipboard-list" class="w-4 h-4 text-blue-600"></i>
              <span>Ingresos a Urgencias Hoy</span>
            </h2>
            <button id="btn-refresh-ingresos" class="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Actualizar
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">Consecutivo</th>
                  <th class="px-4 py-3">Hora Llegada</th>
                  <th class="px-4 py-3">Documento</th>
                  <th class="px-4 py-3">Paciente</th>
                  <th class="px-4 py-3">EPS</th>
                  <th class="px-4 py-3">Motivo de Consulta</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">Nivel Triage</th>
                  <th class="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody id="tabla-ingresos-body" class="divide-y divide-slate-100">
                <tr>
                  <td colspan="9" class="px-4 py-8 text-center text-slate-400">
                    <i data-lucide="loader" class="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"></i>
                    Cargando admisiones del día...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadIngresos();
  },

  bindEvents(container) {
    const btnNuevoIngreso = container.querySelector('#btn-modal-nuevo-ingreso');
    if (btnNuevoIngreso) {
      btnNuevoIngreso.onclick = () => this.abrirModalAdmision();
    }

    const btnRefresh = container.querySelector('#btn-refresh-ingresos');
    if (btnRefresh) {
      btnRefresh.onclick = () => this.loadIngresos();
    }
  },

  async loadIngresos() {
    try {
      const ingresos = await API.get('/ingresos/hoy');
      const tbody = document.getElementById('tabla-ingresos-body');
      if (!tbody) return;

      if (!ingresos || ingresos.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="px-4 py-8 text-center text-slate-400">
              No hay ingresos registrados en el turno de hoy.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = ingresos.map(ing => {
        let estadoBadge = '';
        if (ing.estado === 'EN_ESPERA_TRIAGE') {
          estadoBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">En espera de Triage</span>';
        } else if (ing.estado === 'CLASIFICADO') {
          estadoBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">Clasificado</span>';
        } else if (ing.estado === 'EN_ATENCION') {
          estadoBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800">En Atención</span>';
        } else {
          estadoBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700">Cerrado</span>';
        }

        let triageBadge = '<span class="text-xs text-slate-400 italic">Pendiente</span>';
        if (ing.triage_nivel) {
          triageBadge = `<span class="px-2 py-0.5 text-xs font-bold rounded badge-triage-${ing.triage_nivel}">${ing.triage_nombre}</span>`;
        }

        return `
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="px-4 py-3 font-mono font-bold text-slate-800 text-xs">${ing.consecutivo}</td>
            <td class="px-4 py-3 text-xs text-slate-600">${ing.fecha_llegada ? ing.fecha_llegada.substring(11, 16) : ''}</td>
            <td class="px-4 py-3 text-xs font-medium text-slate-800">${ing.tipo_documento} ${ing.numero_documento}</td>
            <td class="px-4 py-3 font-medium text-slate-900">${ing.nombres} ${ing.apellidos}</td>
            <td class="px-4 py-3 text-xs text-slate-600">${ing.eps}</td>
            <td class="px-4 py-3 text-xs text-slate-700 max-w-xs truncate" title="${ing.motivo_consulta}">${ing.motivo_consulta}</td>
            <td class="px-4 py-3">${estadoBadge}</td>
            <td class="px-4 py-3">${triageBadge}</td>
            <td class="px-4 py-3 text-right">
              <button onclick="App.verFichaPaciente(${ing.paciente_id})" class="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded">
                Ver Detalle
              </button>
            </td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      API.showToast('Error al cargar ingresos: ' + err.message, 'error');
    }
  },

  abrirModalAdmision() {
    App.abrirModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Nueva Admisión a Urgencias</h2>
            <p class="text-xs text-slate-500">Seleccione el paciente registrado y complete los datos de llegada.</p>
          </div>
          <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form id="form-nueva-admision" class="space-y-4 mt-4">
          <!-- Búsqueda y Selección de Paciente -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Buscar Paciente Registrado</label>
            <div class="flex gap-2">
              <input type="text" id="adm-busqueda-paciente" placeholder="Documento o apellido..." class="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <button type="button" id="btn-buscar-paciente-adm" class="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Buscar</button>
              <button type="button" onclick="App.abrirModalCrearPaciente()" class="px-3.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap">+ Crear Paciente</button>
            </div>
            <div id="adm-pacientes-resultados" class="mt-2 max-h-36 overflow-y-auto space-y-1"></div>
            <input type="hidden" id="adm-paciente-id" required>
            <div id="adm-paciente-seleccionado" class="mt-2 hidden p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium"></div>
          </div>

          <!-- Motivo de Consulta -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Motivo de Consulta (Síntomas principales) *</label>
            <textarea id="adm-motivo" rows="3" required placeholder="Describa el motivo por el cual acude a urgencias..." class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
          </div>

          <!-- Acompañante -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Acompañante o Acudiente (Opcional)</label>
            <input type="text" id="adm-acompanante" placeholder="Nombre completo y parentesco (ej. Carmen Torres - Madre)" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Generar Admisión</button>
          </div>
        </form>
      </div>
    `);

    const inputBusqueda = document.getElementById('adm-busqueda-paciente');
    const btnBuscar = document.getElementById('btn-buscar-paciente-adm');
    const containerResultados = document.getElementById('adm-pacientes-resultados');
    const hiddenId = document.getElementById('adm-paciente-id');
    const divSeleccionado = document.getElementById('adm-paciente-seleccionado');

    const doSearch = async () => {
      const q = inputBusqueda.value.trim();
      if (!q) return;
      try {
        const pacientes = await API.get(`/pacientes?q=${encodeURIComponent(q)}`);
        if (pacientes.length === 0) {
          containerResultados.innerHTML = '<p class="text-xs text-slate-400 p-2">No se encontraron pacientes. Puede crearlo con el botón "+ Crear Paciente".</p>';
          return;
        }
        containerResultados.innerHTML = pacientes.map(p => `
          <div data-id="${p.id}" class="item-paciente-res cursor-pointer p-2.5 rounded border border-slate-200 hover:bg-blue-50 text-xs flex justify-between items-center transition-colors">
            <div>
              <strong class="text-slate-800">${p.nombres} ${p.apellidos}</strong> (${p.tipo_documento} ${p.numero_documento})
              <span class="text-slate-500 block text-[11px]">EPS: ${p.eps}</span>
            </div>
            <span class="text-blue-600 font-bold">Seleccionar &rarr;</span>
          </div>
        `).join('');

        containerResultados.querySelectorAll('.item-paciente-res').forEach(el => {
          el.onclick = () => {
            const pId = el.getAttribute('data-id');
            const p = pacientes.find(x => String(x.id) === String(pId));
            hiddenId.value = p.id;
            divSeleccionado.classList.remove('hidden');
            divSeleccionado.innerHTML = `<strong>Paciente Seleccionado:</strong> ${p.nombres} ${p.apellidos} (${p.tipo_documento} ${p.numero_documento}) - EPS: ${p.eps}`;
            containerResultados.innerHTML = '';
          };
        });
      } catch (e) {
        API.showToast('Error al buscar paciente: ' + e.message, 'error');
      }
    };

    btnBuscar.onclick = doSearch;
    inputBusqueda.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    };

    const form = document.getElementById('form-nueva-admision');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const paciente_id = hiddenId.value;
      const motivo_consulta = document.getElementById('adm-motivo').value;
      const acompanante = document.getElementById('adm-acompanante').value;

      if (!paciente_id) {
        API.showToast('Debe buscar y seleccionar un paciente antes de admitir.', 'warning');
        return;
      }

      try {
        const nuevo = await API.post('/ingresos', {
          paciente_id: parseInt(paciente_id, 10),
          motivo_consulta,
          acompanante
        });
        API.showToast(`Admisión creada exitosamente: Consecutivo ${nuevo.consecutivo}`, 'success');
        App.cerrarModal();
        this.loadIngresos();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  }
};

