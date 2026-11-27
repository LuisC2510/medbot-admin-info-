// VISTA: ADMINISTRACIÓN DEL SISTEMA (CONFIGURACIÓN DE TIEMPOS, AUDITORÍA Y USUARIOS)

const AdminView = {
  async render(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Encabezado de Administración -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Administración y Parámetros del Sistema</h1>
            <p class="text-sm text-slate-500 mt-0.5">
              Configuración institucional conforme a la Resolución 5596 de 2015, control de contingencias y auditoría.
            </p>
          </div>
        </div>

        <!-- 1. MODO DE EMERGENCIA / DESASTRE CON MÚLTIPLES VÍCTIMAS -->
        <div class="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <i data-lucide="alert-octagon" class="w-5 h-5 text-red-600"></i>
                <h2 class="text-base font-bold text-red-900">Modo Emergencia / Desastre con Múltiples Víctimas</h2>
              </div>
              <p class="text-xs text-red-700 mt-1 max-w-2xl leading-relaxed">
                Según la Resolución 5596/2015, los tiempos máximos normativos no aplican en situaciones de emergencia o desastre con víctimas masivas. Al activar este modo, el sistema indicará a todas las pantallas que rige protocolo de contingencia.
              </p>
            </div>

            <div class="flex items-center gap-3">
              <span id="label-estado-emergencia" class="text-xs font-bold uppercase text-slate-600">Inactivo</span>
              <button id="btn-toggle-emergencia" class="px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-900 text-white shadow transition-all">
                Cambiar Estado
              </button>
            </div>
          </div>
        </div>

        <!-- 2. TABLA DE CONFIGURACIÓN DE TIEMPOS POR NIVEL DE TRIAGE -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="p-5 border-b border-slate-100">
            <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i data-lucide="clock" class="w-4 h-4 text-blue-600"></i>
              <span>Tiempos Máximos de Espera por Nivel (Resolución 5596 de 2015)</span>
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Los tiempos de Triage I y II son de estricto cumplimiento legal. Los niveles III, IV y V pueden ser ajustados según la capacidad técnico-científica institucional.
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">Nivel</th>
                  <th class="px-4 py-3">Denominación</th>
                  <th class="px-4 py-3">Color Oficial</th>
                  <th class="px-4 py-3">Tiempo Máx (Minutos)</th>
                  <th class="px-4 py-3">Modificable</th>
                  <th class="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody id="tabla-niveles-body" class="divide-y divide-slate-100">
                <!-- Inyectado dinámicamente -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. GESTIÓN DE USUARIOS DEL SISTEMA -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="users" class="w-4 h-4 text-blue-600"></i>
                <span>Usuarios y Roles Autorizados</span>
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">Control de acceso y credenciales por rol operativo.</p>
            </div>
            <button id="btn-crear-usuario-modal" class="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Nuevo Usuario
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">ID</th>
                  <th class="px-4 py-3">Nombre</th>
                  <th class="px-4 py-3">Documento (Usuario)</th>
                  <th class="px-4 py-3">Rol</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">Fecha Registro</th>
                </tr>
              </thead>
              <tbody id="tabla-usuarios-body" class="divide-y divide-slate-100">
                <!-- Inyectado dinámicamente -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. LOG DE AUDITORÍA -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
              <span>Registro de Auditoría y Trazabilidad (Últimos 100 eventos)</span>
            </h2>
            <button id="btn-refresh-auditoria" class="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Actualizar
            </button>
          </div>

          <div class="overflow-x-auto max-h-96">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 font-semibold text-slate-500 uppercase border-b border-slate-200 sticky top-0">
                <tr>
                  <th class="px-3 py-2.5">Fecha / Hora</th>
                  <th class="px-3 py-2.5">Usuario</th>
                  <th class="px-3 py-2.5">Acción</th>
                  <th class="px-3 py-2.5">Entidad</th>
                  <th class="px-3 py-2.5">Detalles</th>
                  <th class="px-3 py-2.5">IP</th>
                </tr>
              </thead>
              <tbody id="tabla-auditoria-body" class="divide-y divide-slate-100 font-mono">
                <!-- Inyectado dinámicamente -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.bindEvents(container);
    await Promise.all([
      this.loadEmergencia(),
      this.loadNiveles(),
      this.loadUsuarios(),
      this.loadAuditoria()
    ]);
  },

  bindEvents(container) {
    const btnEmergencia = container.querySelector('#btn-toggle-emergencia');
    if (btnEmergencia) {
      btnEmergencia.onclick = async () => {
        try {
          const actual = await API.get('/configuracion/emergencia');
          const nuevo = !actual.modo_emergencia;
          const mensajeConfirm = nuevo
            ? '⚠️ ¿Confirmas activar el MODO EMERGENCIA / DESASTRE CON MÚLTIPLES VÍCTIMAS?\n\nSegún la Resolución 5596 de 2015, los tiempos máximos normativos quedarán suspendidos y se notificará en tiempo real a todas las pantallas de urgencias.'
            : 'ℹ️ ¿Deseas DESACTIVAR el Modo Emergencia y restablecer el control de tiempos ordinarios de Triage?';

          if (!confirm(mensajeConfirm)) return;

          const res = await API.post('/configuracion/emergencia', { activo: nuevo });
          API.showToast(res.message, nuevo ? 'warning' : 'info');
          this.loadEmergencia();
        } catch (err) {
          API.showToast('Error al cambiar modo de emergencia: ' + err.message, 'error');
        }
      };
    }

    const btnCrearUsuario = container.querySelector('#btn-crear-usuario-modal');
    if (btnCrearUsuario) {
      btnCrearUsuario.onclick = () => this.abrirModalNuevoUsuario();
    }

    const btnRefreshAuditoria = container.querySelector('#btn-refresh-auditoria');
    if (btnRefreshAuditoria) {
      btnRefreshAuditoria.onclick = () => this.loadAuditoria();
    }
  },

  async loadEmergencia() {
    try {
      const res = await API.get('/configuracion/emergencia');
      const label = document.getElementById('label-estado-emergencia');
      const btn = document.getElementById('btn-toggle-emergencia');
      if (!label || !btn) return;

      if (res.modo_emergencia) {
        label.textContent = 'ACTIVADO (Límites suspendidos)';
        label.className = 'text-xs font-black uppercase text-red-700 bg-red-100 px-3 py-1 rounded-full animate-pulse border border-red-300';
        btn.textContent = 'Desactivar Modo Emergencia';
        btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-red-700 hover:bg-red-800 text-white shadow transition-all';
      } else {
        label.textContent = 'Inactivo (Tiempos ordinarios)';
        label.className = 'text-xs font-bold uppercase text-slate-600 bg-slate-200 px-3 py-1 rounded-full';
        btn.textContent = 'Activar Modo Emergencia';
        btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-900 text-white shadow transition-all';
      }

      if (window.App) {
        window.App.setEmergencyModeBanner(res.modo_emergencia);
      }
    } catch (err) {
      console.error(err);
    }
  },

  async loadNiveles() {
    try {
      const niveles = await API.get('/configuracion/niveles');
      const tbody = document.getElementById('tabla-niveles-body');
      if (!tbody) return;

      tbody.innerHTML = niveles.map(n => {
        const isEditable = n.editable === 1;

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-bold text-slate-800">Nivel ${n.nivel}</td>
            <td class="px-4 py-3 font-semibold text-slate-900">${n.nombre}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold text-white" style="background-color: ${n.codigo_color}">
                ${n.color}
              </span>
            </td>
            <td class="px-4 py-3">
              ${isEditable ? `
                <div class="flex items-center gap-2">
                  <input type="number" id="input-tiempo-nivel-${n.nivel}" value="${n.minutos_max}" min="5" max="1440" class="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-bold">
                  <span class="text-xs text-slate-500">min</span>
                </div>
              ` : `
                <span class="font-bold text-slate-800 text-sm">${n.minutos_max === 0 ? 'Inmediato (0 min)' : `${n.minutos_max} min`}</span>
              `}
            </td>
            <td class="px-4 py-3">
              ${isEditable ? `
                <span class="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800">Institucional</span>
              ` : `
                <span class="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-100 text-slate-600">Legal Estricto (Res. 5596)</span>
              `}
            </td>
            <td class="px-4 py-3 text-right">
              ${isEditable ? `
                <button onclick="AdminView.guardarTiempo(${n.nivel})" class="px-3 py-1 text-xs font-semibold rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors">
                  Guardar
                </button>
              ` : `
                <span class="text-xs text-slate-400 italic">No modificable</span>
              `}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      API.showToast('Error al cargar niveles de triage: ' + err.message, 'error');
    }
  },

  async guardarTiempo(nivel) {
    const input = document.getElementById(`input-tiempo-nivel-${nivel}`);
    if (!input) return;
    const minutos = parseInt(input.value, 10);
    if (!minutos || minutos <= 0) {
      API.showToast('Debe ingresar un tiempo válido en minutos.', 'warning');
      return;
    }

    try {
      const res = await API.put(`/configuracion/niveles/${nivel}`, { minutos_max: minutos });
      API.showToast(res.message, 'success');
      this.loadNiveles();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  },

  async loadUsuarios() {
    try {
      const usuarios = await API.get('/configuracion/usuarios');
      const tbody = document.getElementById('tabla-usuarios-body');
      if (!tbody) return;

      tbody.innerHTML = usuarios.map(u => {
        const rolesBadge = {
          ADMIN: 'bg-purple-100 text-purple-800',
          ADMINISTRATIVO: 'bg-blue-100 text-blue-800',
          ENFERMERO: 'bg-amber-100 text-amber-800',
          MEDICO: 'bg-emerald-100 text-emerald-800'
        };

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-mono text-xs text-slate-400">#${u.id}</td>
            <td class="px-4 py-3 font-bold text-slate-800">${App.escapeHtml(u.nombre)}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-700">${App.escapeHtml(u.documento)}</td>
            <td class="px-4 py-3">
              <span class="px-2.5 py-0.5 text-xs font-bold rounded-full ${rolesBadge[u.rol] || 'bg-slate-100 text-slate-700'}">
                ${App.escapeHtml(u.rol)}
              </span>
            </td>
            <td class="px-4 py-3">
              <span class="text-xs font-semibold ${u.activo === 1 ? 'text-emerald-600' : 'text-slate-400'}">
                ${u.activo === 1 ? '● Activo' : '○ Inactivo'}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500">${u.creado_en ? u.creado_en.substring(0, 10) : ''}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  abrirModalNuevoUsuario() {
    App.abrirModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Nuevo Usuario del Sistema</h2>
            <p class="text-xs text-slate-500">Cree un usuario y asigne su rol en el servicio de urgencias.</p>
          </div>
          <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form id="form-nuevo-usuario" class="space-y-4 mt-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre Completo y Cargo *</label>
            <input type="text" id="usr-nombre" required placeholder="Ej: Dra. Natalia Morales" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Documento (Usuario Login) *</label>
              <input type="text" id="usr-documento" required placeholder="Ej: 1004" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Rol Operativo *</label>
              <select id="usr-rol" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                <option value="ADMINISTRATIVO">ADMINISTRATIVO (Admisiones)</option>
                <option value="ENFERMERO">ENFERMERO (Enfermero Jefe)</option>
                <option value="MEDICO">MEDICO (Médico de Urgencias)</option>
                <option value="ADMIN">ADMIN (Administrador Maestro)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Contraseña *</label>
            <input type="password" id="usr-password" required minlength="10" placeholder="Mín. 10 caracteres (mayús, minús, número y símbolo)" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Crear Usuario</button>
          </div>
        </form>
      </div>
    `);

    const form = document.getElementById('form-nuevo-usuario');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.post('/configuracion/usuarios', {
          nombre: document.getElementById('usr-nombre').value,
          documento: document.getElementById('usr-documento').value,
          rol: document.getElementById('usr-rol').value,
          password: document.getElementById('usr-password').value
        });
        API.showToast('Usuario creado con éxito en el sistema.', 'success');
        App.cerrarModal();
        this.loadUsuarios();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  },

  async loadAuditoria() {
    try {
      const logs = await API.get('/configuracion/auditoria');
      const tbody = document.getElementById('tabla-auditoria-body');
      if (!tbody) return;

      if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-3 py-6 text-center text-slate-400">Sin eventos de auditoría registrados.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr class="hover:bg-slate-50 text-[11px]">
          <td class="px-3 py-2 text-slate-500">${App.escapeHtml(l.fecha ? l.fecha.substring(0, 19) : '')}</td>
          <td class="px-3 py-2 font-bold text-slate-800">${App.escapeHtml(l.usuario_nombre || 'Sistema')}</td>
          <td class="px-3 py-2 text-blue-700 font-semibold">${App.escapeHtml(l.accion)}</td>
          <td class="px-3 py-2 text-slate-500">${App.escapeHtml(l.entidad)}</td>
          <td class="px-3 py-2 text-slate-700 truncate max-w-xs" title="${App.escapeHtml(l.detalles)}">${App.escapeHtml(l.detalles)}</td>
          <td class="px-3 py-2 text-slate-400">${App.escapeHtml(l.ip || '127.0.0.1')}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }
};

