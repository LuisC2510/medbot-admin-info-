// VISTA: GESTIÓN DE PACIENTES (CREAR, BUSCAR, EDITAR Y VER HISTORIAL)

const PacientesView = {
  async render(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Encabezado de Pacientes -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Directorio de Pacientes</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Gestión de historias clínicas base, afiliación a EPS y datos de contacto de pacientes.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button id="btn-crear-paciente-main" class="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Nuevo Paciente</span>
            </button>
          </div>
        </div>

        <!-- Barra de Búsqueda -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div class="flex gap-3">
            <div class="relative flex-1">
              <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-3 text-slate-400"></i>
              <input type="text" id="input-buscar-pacientes" placeholder="Buscar por número de documento o apellidos..." class="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <button id="btn-ejecutar-busqueda" class="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Buscar
            </button>
          </div>
        </div>

        <!-- Tabla de Pacientes -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">Tipo / Documento</th>
                  <th class="px-4 py-3">Nombre Completo</th>
                  <th class="px-4 py-3">Edad / Sexo</th>
                  <th class="px-4 py-3">EPS / Aseguradora</th>
                  <th class="px-4 py-3">Teléfono</th>
                  <th class="px-4 py-3">Acudiente</th>
                  <th class="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody id="tabla-pacientes-body" class="divide-y divide-slate-100">
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                    <i data-lucide="loader" class="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500"></i>
                    Cargando listado de pacientes...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadPacientes();
  },

  bindEvents(container) {
    const btnCrear = container.querySelector('#btn-crear-paciente-main');
    if (btnCrear) {
      btnCrear.onclick = () => App.abrirModalCrearPaciente(() => this.loadPacientes());
    }

    const inputBuscar = container.querySelector('#input-buscar-pacientes');
    const btnBuscar = container.querySelector('#btn-ejecutar-busqueda');

    const handleSearch = () => {
      this.loadPacientes(inputBuscar.value.trim());
    };

    if (btnBuscar) btnBuscar.onclick = handleSearch;
    if (inputBuscar) {
      inputBuscar.onkeydown = (e) => {
        if (e.key === 'Enter') handleSearch();
      };
    }
  },

  async loadPacientes(q = '') {
    try {
      const endpoint = q ? `/pacientes?q=${encodeURIComponent(q)}` : '/pacientes';
      const pacientes = await API.get(endpoint);
      const tbody = document.getElementById('tabla-pacientes-body');
      if (!tbody) return;

      if (!pacientes || pacientes.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="px-4 py-8 text-center text-slate-400">
              No se encontraron pacientes registrados con el criterio especificado.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = pacientes.map(p => {
        const edad = p.fecha_nacimiento ? Math.floor((new Date() - new Date(p.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000)) : 'N/A';
        const sexoTxt = p.sexo === 'M' ? 'Masc' : (p.sexo === 'F' ? 'Fem' : 'Otro');

        return `
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="px-4 py-3 font-medium text-slate-900 text-xs">
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold mr-1.5">${p.tipo_documento}</span>
              ${p.numero_documento}
            </td>
            <td class="px-4 py-3 font-semibold text-slate-800">${p.nombres} ${p.apellidos}</td>
            <td class="px-4 py-3 text-xs text-slate-600">${edad} años • ${sexoTxt}</td>
            <td class="px-4 py-3 text-xs font-medium text-slate-700">${p.eps}</td>
            <td class="px-4 py-3 text-xs text-slate-600">${p.telefono || '<span class="text-slate-300">--</span>'}</td>
            <td class="px-4 py-3 text-xs text-slate-600">${p.acudiente_nombre ? `${p.acudiente_nombre} (${p.acudiente_telefono || ''})` : '<span class="text-slate-300">Ninguno</span>'}</td>
            <td class="px-4 py-3 text-right space-x-2">
              <button onclick="App.verFichaPaciente(${p.id})" class="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded">
                Ver Ficha
              </button>
              <button onclick="PacientesView.editarPaciente(${p.id})" class="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded">
                Editar
              </button>
            </td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      API.showToast('Error al cargar pacientes: ' + err.message, 'error');
    }
  },

  async editarPaciente(pacienteId) {
    try {
      const p = await API.get(`/pacientes/${pacienteId}`);
      App.abrirModal(`
        <div class="p-6">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-xl font-bold text-slate-800">Editar Paciente</h2>
              <p class="text-xs text-slate-500">Actualice la información de contacto o afiliación.</p>
            </div>
            <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>

          <form id="form-editar-paciente" class="space-y-4 mt-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Documento</label>
                <select id="edit-tipo-doc" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  <option value="CC" ${p.tipo_documento === 'CC' ? 'selected' : ''}>Cédula de Ciudadanía (CC)</option>
                  <option value="TI" ${p.tipo_documento === 'TI' ? 'selected' : ''}>Tarjeta de Identidad (TI)</option>
                  <option value="RC" ${p.tipo_documento === 'RC' ? 'selected' : ''}>Registro Civil (RC)</option>
                  <option value="CE" ${p.tipo_documento === 'CE' ? 'selected' : ''}>Cédula de Extranjería (CE)</option>
                  <option value="PA" ${p.tipo_documento === 'PA' ? 'selected' : ''}>Pasaporte (PA)</option>
                  <option value="PPT" ${p.tipo_documento === 'PPT' ? 'selected' : ''}>Permiso Protección Temporal (PPT)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Número de Documento</label>
                <input type="text" id="edit-num-doc" value="${p.numero_documento}" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nombres</label>
                <input type="text" id="edit-nombres" value="${p.nombres}" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Apellidos</label>
                <input type="text" id="edit-apellidos" value="${p.apellidos}" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha de Nacimiento</label>
                <input type="date" id="edit-fecha-nac" value="${p.fecha_nacimiento}" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Sexo</label>
                <select id="edit-sexo" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  <option value="M" ${p.sexo === 'M' ? 'selected' : ''}>Masculino</option>
                  <option value="F" ${p.sexo === 'F' ? 'selected' : ''}>Femenino</option>
                  <option value="OTRO" ${p.sexo === 'OTRO' ? 'selected' : ''}>Otro</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">EPS / Aseguradora</label>
                <input type="text" id="edit-eps" value="${p.eps}" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                <input type="text" id="edit-telefono" value="${p.telefono || ''}" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Guardar Cambios</button>
            </div>
          </form>
        </div>
      `);

      const form = document.getElementById('form-editar-paciente');
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await API.put(`/pacientes/${p.id}`, {
            tipo_documento: document.getElementById('edit-tipo-doc').value,
            numero_documento: document.getElementById('edit-num-doc').value,
            nombres: document.getElementById('edit-nombres').value,
            apellidos: document.getElementById('edit-apellidos').value,
            fecha_nacimiento: document.getElementById('edit-fecha-nac').value,
            sexo: document.getElementById('edit-sexo').value,
            eps: document.getElementById('edit-eps').value,
            telefono: document.getElementById('edit-telefono').value
          });
          API.showToast('Datos del paciente actualizados con éxito.', 'success');
          App.cerrarModal();
          this.loadPacientes();
        } catch (err) {
          API.showToast(err.message, 'error');
        }
      };
    } catch (err) {
      API.showToast('Error al cargar datos del paciente: ' + err.message, 'error');
    }
  }
};

