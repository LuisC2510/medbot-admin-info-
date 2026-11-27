// CONTROLADOR PRINCIPAL Y ROUTER DE LA APLICACIÓN SPA

const App = {
  currentView: 'tablero',
  emergencyModeActive: false,

  // Función de seguridad en frontend para neutralizar código HTML/scripts
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  init() {
    API.clearLegacyStorage();
    this.startLiveClock();
    this.bindGlobalEvents();
    this.checkAuth();
  },

  startLiveClock() {
    const actualizar = () => {
      const el = document.getElementById('topbar-live-clock');
      if (el) {
        el.textContent = new Date().toLocaleTimeString('es-CO');
      }
    };
    setInterval(actualizar, 1000);
    actualizar();
  },

  async checkAuth() {
    let user = API.getUser();
    if (!user) {
      user = await API.fetchCurrentUser();
    }

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (!user) {
      if (authContainer) authContainer.classList.remove('hidden');
      if (appContainer) appContainer.classList.add('hidden');
      this.renderLoginForm();
    } else if (user.debe_cambiar_password) {
      if (authContainer) authContainer.classList.remove('hidden');
      if (appContainer) appContainer.classList.add('hidden');
      this.renderChangePasswordForm(user);
    } else {
      if (authContainer) authContainer.classList.add('hidden');
      if (appContainer) appContainer.classList.remove('hidden');
      this.setupAuthenticatedLayout(user);
      this.initRealtime();
      this.navigate(this.getDefaultViewForRole(user.rol));
    }
  },

  getDefaultViewForRole(rol) {
    switch (rol) {
      case 'ENFERMERO':
        return 'cola-triage';
      case 'ADMINISTRATIVO':
        return 'admisiones';
      case 'MEDICO':
      case 'ADMIN':
      default:
        return 'tablero';
    }
  },

  bindGlobalEvents() {
    // Tecla ESC para cerrar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cerrarModal();
    });
  },

  renderLoginForm() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    // Asegurar que el contenedor principal esté oculto
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.classList.add('hidden');
    container.classList.remove('hidden');

    container.innerHTML = `
      <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          
          <!-- Encabezado Sencillo -->
          <div class="bg-blue-600 p-4 text-white text-center">
            <span class="text-2xl block mb-1">🏥</span>
            <h2 class="text-base font-bold">Sistema de Triage de Urgencias</h2>
            <p class="text-xs text-blue-100">Universidad Santiago de Cali • Res. 5596/2015</p>
          </div>

          <div class="p-5">
            <!-- Ingreso con Documento y Contraseña -->
            <form id="form-login" class="space-y-3">
              <p class="text-xs text-slate-500 text-center font-medium">Ingrese sus credenciales institucionales:</p>
              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Documento</label>
                <input type="text" id="login-documento" required autocomplete="username" placeholder="Número de documento..." class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500">
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Contraseña</label>
                <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••" class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500">
              </div>

              <button type="submit" class="w-full py-2 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-xs">
                Ingresar al Sistema
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('form-login');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const doc = document.getElementById('login-documento').value.trim();
      const pwd = document.getElementById('login-password').value;
      await this.login(doc, pwd);
    };
  },

  renderChangePasswordForm(user) {
    const container = document.getElementById('auth-container');
    if (!container) return;

    container.innerHTML = `
      <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div class="bg-amber-600 p-4 text-white text-center">
            <span class="text-2xl block mb-1">🔐</span>
            <h2 class="text-base font-bold">Cambio de Contraseña Obligatorio</h2>
            <p class="text-xs text-amber-100">Primer ingreso o restablecimiento requerido (${this.escapeHtml(user.nombre)})</p>
          </div>

          <div class="p-5">
            <p class="text-xs text-slate-600 mb-3 bg-amber-50 border border-amber-200 rounded p-2.5">
              Por seguridad, debe definir una contraseña personal de al menos <strong>10 caracteres</strong> con mayúscula, minúscula, número y símbolo.
            </p>
            <form id="form-change-pwd" class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Contraseña Actual</label>
                <input type="password" id="chg-current-pwd" required autocomplete="current-password" class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Nueva Contraseña</label>
                <input type="password" id="chg-new-pwd" required minlength="10" autocomplete="new-password" class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Confirmar Nueva Contraseña</label>
                <input type="password" id="chg-confirm-pwd" required minlength="10" autocomplete="new-password" class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500">
              </div>
              <div class="flex gap-2 pt-2">
                <button type="button" id="btn-cancel-chg-pwd" class="w-1/3 py-2 px-3 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded">
                  Salir
                </button>
                <button type="submit" class="w-2/3 py-2 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs">
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-cancel-chg-pwd').onclick = () => API.logout();
    document.getElementById('form-change-pwd').onsubmit = async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('chg-current-pwd').value;
      const newPassword = document.getElementById('chg-new-pwd').value;
      const confirmPassword = document.getElementById('chg-confirm-pwd').value;
      if (newPassword !== confirmPassword) {
        API.showToast('Las contraseñas nuevas no coinciden.', 'error');
        return;
      }
      try {
        const res = await API.post('/auth/cambiar-password', { currentPassword, newPassword });
        if (res.csrfToken) API.setCsrfToken(res.csrfToken);
        API.setUser(res.user);
        API.showToast(res.message, 'success');
        this.checkAuth();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  },

  async login(documento, password) {
    try {
      const res = await API.post('/auth/login', { documento, password });

      if (res.csrfToken) API.setCsrfToken(res.csrfToken);
      API.setUser(res.user);
      API.showToast(`Bienvenido(a), ${res.user.nombre} (${res.user.rol})`, 'success');
      this.checkAuth();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  },

  cerrarSesion() {
    API.logout();
  },

  setupAuthenticatedLayout(user) {
    // Elementos del usuario en el header/sidebar
    const userNameEl = document.getElementById('header-user-name');
    const userRoleEl = document.getElementById('header-user-role');
    const logoutBtn = document.getElementById('btn-logout');

    if (userNameEl) userNameEl.textContent = user.nombre;
    if (userRoleEl) {
      userRoleEl.textContent = user.rol;
      const rolesBadgeClass = {
        ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
        ADMINISTRATIVO: 'bg-blue-100 text-blue-800 border-blue-200',
        ENFERMERO: 'bg-amber-100 text-amber-800 border-amber-200',
        MEDICO: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
      userRoleEl.className = `px-2 py-0.5 text-xs font-bold rounded-full border ${rolesBadgeClass[user.rol] || 'bg-slate-100 text-slate-800'}`;
    }

    if (logoutBtn) {
      logoutBtn.onclick = () => API.logout();
    }

    this.renderSidebarMenu(user.rol);
  },

  renderSidebarMenu(rol) {
    const nav = document.getElementById('sidebar-navigation');
    if (!nav) return;

    let items = [];

    if (rol === 'ADMINISTRATIVO') {
      items = [
        { id: 'admisiones', label: 'Admisiones de Urgencias', icon: 'clipboard-list' },
        { id: 'pacientes', label: 'Directorio de Pacientes', icon: 'users' },
        { id: 'tablero', label: 'Tablero de Urgencias (Monitor)', icon: 'layout-grid' }
      ];
    } else if (rol === 'ENFERMERO') {
      items = [
        { id: 'cola-triage', label: 'Cola de Triage Pendiente', icon: 'clock' },
        { id: 'tablero', label: 'Tablero de Urgencias', icon: 'layout-grid' },
        { id: 'pacientes', label: 'Pacientes', icon: 'users' }
      ];
    } else if (rol === 'MEDICO') {
      items = [
        { id: 'tablero', label: 'Tablero de Urgencias (En Vivo)', icon: 'layout-grid' },
        { id: 'mis-pacientes', label: 'Mis Pacientes Atendidos', icon: 'stethoscope' },
        { id: 'historial', label: 'Historial y Tiempos', icon: 'history' },
        { id: 'pacientes', label: 'Pacientes', icon: 'users' }
      ];
    } else if (rol === 'ADMIN') {
      items = [
        { id: 'tablero', label: 'Tablero de Urgencias', icon: 'layout-grid' },
        { id: 'cola-triage', label: 'Cola de Triage', icon: 'clock' },
        { id: 'admisiones', label: 'Admisiones', icon: 'clipboard-list' },
        { id: 'pacientes', label: 'Pacientes', icon: 'users' },
        { id: 'historial', label: 'Historial Urgencias', icon: 'history' },
        { id: 'admin', label: 'Configuración y Auditoría', icon: 'settings' }
      ];
    }

    nav.innerHTML = items.map(item => `
      <button data-view="${item.id}" class="nav-item-btn w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors">
        <i data-lucide="${item.icon}" class="w-4 h-4 text-slate-500 flex-shrink-0"></i>
        <span>${item.label}</span>
      </button>
    `).join('');

    nav.querySelectorAll('.nav-item-btn').forEach(btn => {
      btn.onclick = () => {
        const v = btn.getAttribute('data-view');
        this.navigate(v);
      };
    });

    if (window.lucide) window.lucide.createIcons();
  },

  navigate(viewId) {
    this.currentView = viewId;

    // Actualizar clase activa en sidebar (estilo limpio y claro)
    const navBtns = document.querySelectorAll('.nav-item-btn');
    navBtns.forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.className = 'nav-item-btn w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200';
      } else {
        btn.className = 'nav-item-btn w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors';
      }
    });

    const contentContainer = document.getElementById('main-view-container');
    if (!contentContainer) return;

    switch (viewId) {
      case 'tablero':
        TableroView.render(contentContainer);
        break;
      case 'admisiones':
        AdmisionesView.render(contentContainer);
        break;
      case 'pacientes':
        PacientesView.render(contentContainer);
        break;
      case 'cola-triage':
        EnfermeriaView.render(contentContainer);
        break;
      case 'mis-pacientes':
        MedicoView.renderMisPacientes(contentContainer);
        break;
      case 'historial':
        MedicoView.renderHistorial(contentContainer);
        break;
      case 'admin':
        AdminView.render(contentContainer);
        break;
      default:
        TableroView.render(contentContainer);
    }

    if (window.lucide) window.lucide.createIcons();
  },

  initRealtime() {
    RealtimeSync.init((event, data) => {
      // Si estamos en el tablero y hubo cambios clínicos, refrescamos el tablero
      if (this.currentView === 'tablero') {
        TableroView.loadData();
      } else if (this.currentView === 'cola-triage' && (event.includes('triage') || event.includes('ingreso'))) {
        EnfermeriaView.loadCola();
      } else if (this.currentView === 'admisiones' && event.includes('ingreso')) {
        AdmisionesView.loadIngresos();
      }
    });
  },

  setEmergencyModeBanner(active) {
    this.emergencyModeActive = active;
    const banner = document.getElementById('global-emergency-banner');
    if (!banner) return;

    if (active) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  },

  // Modal genérico reutilizable
  abrirModal(htmlContent) {
    const container = document.getElementById('modal-container');
    const content = document.getElementById('modal-content-box');
    if (!container || !content) return;

    content.innerHTML = htmlContent;
    container.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  cerrarModal() {
    const container = document.getElementById('modal-container');
    const content = document.getElementById('modal-content-box');
    if (!container) return;
    container.classList.add('hidden');
    if (content) content.innerHTML = '';
  },

  // ACCIONES CLÍNICAS COMPARTIDAS
  async iniciarAtencion(ingresoId) {
    if (!confirm('¿Confirma que inicia la atención médica presencial del paciente? El cronómetro de espera de triage se detendrá.')) {
      return;
    }

    try {
      const res = await API.post(`/atencion/${ingresoId}/iniciar`);
      API.showToast(res.message, 'success');
      if (this.currentView === 'tablero') TableroView.loadData();
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  },

  abrirModalReclasificar(ingresoId, currentNivel) {
    this.abrirModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Reclasificación Médica de Triage</h2>
            <p class="text-xs text-slate-500">Nivel actual: <strong>Triage ${currentNivel}</strong>. Requiere justificación clínica estricta.</p>
          </div>
          <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form id="form-reclasificar" class="space-y-4 mt-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nuevo Nivel de Triage *</label>
            <select id="rec-nuevo-nivel" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500">
              <option value="">Seleccione el nuevo nivel...</option>
              <option value="1" ${currentNivel === 1 ? 'disabled' : ''}>Triage I (Rojo) - Atención Inmediata / Riesgo Vital</option>
              <option value="2" ${currentNivel === 2 ? 'disabled' : ''}>Triage II (Naranja) - Hasta 30 min / Deterioro rápido</option>
              <option value="3" ${currentNivel === 3 ? 'disabled' : ''}>Triage III (Amarillo) - Hasta 120 min / Estable con exámenes</option>
              <option value="4" ${currentNivel === 4 ? 'disabled' : ''}>Triage IV (Verde) - Hasta 240 min / Sin riesgo vital</option>
              <option value="5" ${currentNivel === 5 ? 'disabled' : ''}>Triage V (Azul) - Hasta 360 min / Sin deterioro</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Motivo Clínico de la Reclasificación *</label>
            <textarea id="rec-motivo" rows="4" required placeholder="Explique las razones clínicas, cambios de signos vitales o respuesta al tratamiento que fundamentan el cambio de nivel..." class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"></textarea>
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" class="px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm">
              Confirmar Reclasificación
            </button>
          </div>
        </form>
      </div>
    `);

    const form = document.getElementById('form-reclasificar');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const nuevoNivel = document.getElementById('rec-nuevo-nivel').value;
      const motivo = document.getElementById('rec-motivo').value;

      try {
        const res = await API.post(`/triage/${ingresoId}/reclasificar`, {
          nivel_nuevo: parseInt(nuevoNivel, 10),
          motivo
        });
        API.showToast(res.message, 'success');
        this.cerrarModal();
        if (this.currentView === 'tablero') TableroView.loadData();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  },

  async verHistorialReclasificaciones(ingresoId) {
    try {
      const ing = await API.get(`/ingresos/${ingresoId}`);
      const reclas = ing.reclasificaciones || [];

      this.abrirModal(`
        <div class="p-6">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-xl font-bold text-slate-800">Historial de Reclasificaciones</h2>
              <p class="text-xs text-slate-500">Ingreso: <strong>${this.escapeHtml(ing.consecutivo)}</strong> • Paciente: ${this.escapeHtml(ing.nombres)} ${this.escapeHtml(ing.apellidos)}</p>
            </div>
            <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>

          <div class="mt-4 space-y-3">
            ${reclas.length === 0 ? '<p class="text-sm text-slate-400 text-center py-4">No hay reclasificaciones registradas para este ingreso.</p>' : ''}
            ${reclas.map(r => `
              <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800">
                    Cambio: <span class="text-slate-600">${this.escapeHtml(r.nivel_anterior_nombre)}</span> &rarr; <span class="text-purple-700 font-extrabold">${this.escapeHtml(r.nivel_nuevo_nombre)}</span>
                  </span>
                  <span class="text-slate-400">${this.escapeHtml(r.fecha_reclasificacion)}</span>
                </div>
                <p class="text-slate-700"><strong>Motivo:</strong> ${this.escapeHtml(r.motivo)}</p>
                <span class="text-[11px] text-slate-500 block">Médico: ${this.escapeHtml(r.reclasificado_por_nombre)}</span>
              </div>
            `).join('')}
          </div>

          <div class="pt-4 border-t border-slate-100 text-right mt-4">
            <button onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
          </div>
        </div>
      `);
    } catch (err) {
      API.showToast('Error al consultar historial: ' + err.message, 'error');
    }
  },

  abrirModalConducta(ingresoId) {
    this.abrirModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Definir Conducta Médica y Cierre</h2>
            <p class="text-xs text-slate-500">Determine el destino y plan terapéutico del paciente para el servicio de urgencias.</p>
          </div>
          <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form id="form-conducta" class="space-y-4 mt-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Conducta Médica *</label>
            <select id="cnd-tipo" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
              <option value="">Seleccione la conducta...</option>
              <option value="ATENDER_URGENCIAS">Atender y estabilizar en urgencias</option>
              <option value="SOLICITAR_EXAMENES">Solicitar exámenes diagnósticos / Laboratorios / Imágenes</option>
              <option value="HOSPITALIZAR">Hospitalizar en piso / UCI</option>
              <option value="REMITIR">Remisión a institución de mayor complejidad</option>
              <option value="DERIVAR_CONSULTA">Derivar a consulta prioritaria o ambulatoria</option>
              <option value="ALTA_MEDICA">Alta médica con recomendaciones</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Destino o Servicio (Opcional)</label>
            <input type="text" id="cnd-destino" placeholder="Ej: Sala de Observación Cama 3, Hospital Departamental, o Domicilio" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Plan Terapéutico y Justificación Médica *</label>
            <textarea id="cnd-descripcion" rows="4" required placeholder="Detalle la orden médica, medicamentos formulados, paraclinicos solicitados o recomendaciones de egreso..." class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"></textarea>
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" class="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm">
              Emitir Conducta y Cerrar Ingreso
            </button>
          </div>
        </form>
      </div>
    `);

    const form = document.getElementById('form-conducta');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await API.post(`/atencion/${ingresoId}/conducta`, {
          tipo: document.getElementById('cnd-tipo').value,
          destino: document.getElementById('cnd-destino').value,
          descripcion: document.getElementById('cnd-descripcion').value
        });
        API.showToast(res.message, 'success');
        this.cerrarModal();
        if (this.currentView === 'tablero') TableroView.loadData();
        else if (this.currentView === 'mis-pacientes') MedicoView.loadMisPacientes();
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  },

  async verFichaPaciente(pacienteId) {
    try {
      const p = await API.get(`/pacientes/${pacienteId}`);
      const edad = p.fecha_nacimiento ? Math.floor((new Date() - new Date(p.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000)) : 'N/A';
      const ingresos = p.ingresos || [];

      this.abrirModal(`
        <div class="p-6 max-w-3xl">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 class="text-xl font-bold text-slate-800">${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos)}</h2>
              <p class="text-xs text-slate-500">${this.escapeHtml(p.tipo_documento)} ${this.escapeHtml(p.numero_documento)} • ${edad} años • EPS: ${this.escapeHtml(p.eps)}</p>
            </div>
            <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div><span class="text-slate-400 block font-semibold uppercase">Sexo:</span> <strong class="text-slate-700">${this.escapeHtml(p.sexo)}</strong></div>
            <div><span class="text-slate-400 block font-semibold uppercase">Teléfono:</span> <strong class="text-slate-700">${this.escapeHtml(p.telefono || '--')}</strong></div>
            <div><span class="text-slate-400 block font-semibold uppercase">Dirección:</span> <strong class="text-slate-700">${this.escapeHtml(p.direccion || '--')}</strong></div>
            <div><span class="text-slate-400 block font-semibold uppercase">Acudiente:</span> <strong class="text-slate-700">${this.escapeHtml(p.acudiente_nombre || 'Ninguno')}</strong></div>
          </div>

          <h3 class="text-sm font-bold text-slate-800 mb-2">Historial de Ingresos a Urgencias (${ingresos.length})</h3>
          <div class="space-y-3 max-h-64 overflow-y-auto">
            ${ingresos.length === 0 ? '<p class="text-xs text-slate-400 py-3 text-center">No tiene ingresos registrados.</p>' : ''}
            ${ingresos.map(ing => `
              <div class="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-mono font-bold text-slate-800">${this.escapeHtml(ing.consecutivo)}</span>
                  <span class="text-slate-400">${this.escapeHtml(ing.fecha_llegada)}</span>
                </div>
                <p class="text-slate-700"><strong>Motivo:</strong> ${this.escapeHtml(ing.motivo_consulta)}</p>
                <div class="flex items-center gap-3 pt-1 text-[11px]">
                  <span><strong>Estado:</strong> ${this.escapeHtml(ing.estado)}</span>
                  <span><strong>Triage:</strong> ${this.escapeHtml(ing.triage_nombre || 'Sin clasificar')}</span>
                  ${ing.conducta_tipo ? `<span><strong>Conducta:</strong> ${this.escapeHtml(ing.conducta_tipo)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="pt-4 border-t border-slate-100 text-right mt-4">
            <button onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cerrar</button>
          </div>
        </div>
      `);
    } catch (err) {
      API.showToast('Error al consultar paciente: ' + err.message, 'error');
    }
  },

  abrirModalCrearPaciente(onCreated) {
    this.abrirModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 class="text-xl font-bold text-slate-800">Registrar Nuevo Paciente</h2>
            <p class="text-xs text-slate-500">Ingrese los datos de afiliación e identificación del paciente.</p>
          </div>
          <button onclick="App.cerrarModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <form id="form-crear-paciente" class="space-y-4 mt-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Documento *</label>
              <select id="pac-tipo-doc" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                <option value="CC" selected>Cédula de Ciudadanía (CC)</option>
                <option value="TI">Tarjeta de Identidad (TI)</option>
                <option value="RC">Registro Civil (RC)</option>
                <option value="CE">Cédula de Extranjería (CE)</option>
                <option value="PA">Pasaporte (PA)</option>
                <option value="PPT">Permiso Protección Temporal (PPT)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Número de Documento *</label>
              <input type="text" id="pac-num-doc" required placeholder="Ej: 11440022" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nombres *</label>
              <input type="text" id="pac-nombres" required placeholder="Ej: Juan Camilo" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Apellidos *</label>
              <input type="text" id="pac-apellidos" required placeholder="Ej: Ortiz Salazar" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Fecha de Nacimiento *</label>
              <input type="date" id="pac-fecha-nac" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Sexo Biológico *</label>
              <select id="pac-sexo" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">EPS / Aseguradora *</label>
              <input type="text" id="pac-eps" required placeholder="Ej: Sura EPS, Nueva EPS, Sanitas, Particular" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfono</label>
              <input type="text" id="pac-telefono" placeholder="Ej: 3151234567" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Dirección de Residencia</label>
            <input type="text" id="pac-direccion" placeholder="Ej: Calle 5 # 38-19, Cali" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onclick="App.cerrarModal()" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button type="submit" class="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">Guardar Paciente</button>
          </div>
        </form>
      </div>
    `);

    const form = document.getElementById('form-crear-paciente');
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const nuevo = await API.post('/pacientes', {
          tipo_documento: document.getElementById('pac-tipo-doc').value,
          numero_documento: document.getElementById('pac-num-doc').value,
          nombres: document.getElementById('pac-nombres').value,
          apellidos: document.getElementById('pac-apellidos').value,
          fecha_nacimiento: document.getElementById('pac-fecha-nac').value,
          sexo: document.getElementById('pac-sexo').value,
          eps: document.getElementById('pac-eps').value,
          telefono: document.getElementById('pac-telefono').value,
          direccion: document.getElementById('pac-direccion').value
        });
        API.showToast(`Paciente ${nuevo.nombres} ${nuevo.apellidos} registrado exitosamente.`, 'success');
        this.cerrarModal();
        if (onCreated) onCreated(nuevo);
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  }
};

// Auto-iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

