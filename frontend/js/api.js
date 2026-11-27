// ============================================================
// ARCHIVO: api.js
// OBJETIVO: Conectar el frontend con el backend usando cookies httpOnly + CSRF
// ============================================================

const API = {
  currentUser: null,
  csrfToken: null,
  _refreshPromise: null,   // mutex para silent refresh

  clearLegacyStorage() {
    try {
      localStorage.removeItem('medbot_triage_token');
      localStorage.removeItem('medbot_triage_user');
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }
  },

  getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  },

  getCsrfToken() {
    return this.getCookie('medbot_csrf') || this.csrfToken;
  },

  setCsrfToken(token) {
    this.csrfToken = token || null;
  },

  getUser() {
    return this.currentUser;
  },

  setUser(usuario) {
    this.currentUser = usuario || null;
  },

  async fetchCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
      });
      if (!res.ok) {
        this.currentUser = null;
        return null;
      }
      const data = await res.json();
      this.currentUser = data.user || null;
      return this.currentUser;
    } catch (err) {
      this.currentUser = null;
      return null;
    }
  },

  async logout() {
    try {
      const csrf = this.getCsrfToken();
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {}
      });
    } catch (err) {
      // Ignorar errores de red al cerrar sesión
    } finally {
      this.currentUser = null;
      this.csrfToken = null;
      if (window.RealtimeSync && window.RealtimeSync.socket) {
        window.RealtimeSync.socket.disconnect();
      }
      if (window.App && typeof window.App.checkAuth === 'function') {
        window.App.checkAuth();
      } else {
        window.location.reload();
      }
    }
  },

  async request(ruta, opciones = {}) {
    const url = ruta.startsWith('/') ? `/api${ruta}` : `/api/${ruta}`;
    const method = (opciones.method || 'GET').toUpperCase();

    const headers = {
      'Content-Type': 'application/json',
      ...opciones.headers
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && url !== '/api/auth/login') {
      const csrf = this.getCsrfToken();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }

    try {
      const respuesta = await fetch(url, {
        ...opciones,
        method,
        credentials: 'include',
        headers
      });

      const datos = await respuesta.json().catch(() => ({}));

      if (respuesta.status === 401 && url !== '/api/auth/login' && url !== '/api/auth/refresh') {
        // Intentar renovar el token silenciosamente (un solo intento compartido)
        const refreshed = await this._silentRefresh();
        if (refreshed) {
          // Reintentar la petición original con el token nuevo
          const headers2 = { 'Content-Type': 'application/json', ...opciones.headers };
          if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            const csrf2 = this.getCsrfToken();
            if (csrf2) headers2['X-CSRF-Token'] = csrf2;
          }
          const retry = await fetch(url, { ...opciones, method, credentials: 'include', headers: headers2 });
          const datos2 = await retry.json().catch(() => ({}));
          if (!retry.ok) {
            const err2 = new Error(datos2.error || 'Error en el servidor');
            err2.code = datos2.code;
            throw err2;
          }
          return datos2;
        }
        // Refresh fallido → una sola notificación y redirigir al login
        this.showToast('Tu sesión expiró. Por favor vuelve a ingresar.', 'warning');
        this.currentUser = null;
        setTimeout(() => {
          if (window.App) window.App.checkAuth();
        }, 800);
        throw new Error('Sesión expirada');
      }

      if (!respuesta.ok) {
        const mensajeError = datos.error || 'Ocurrió un error en el servidor';
        const err = new Error(mensajeError);
        err.code = datos.code;
        throw err;
      }

      return datos;
    } catch (error) {
      throw error;
    }
  },

  // Renueva el token silenciosamente. Usa un mutex para que múltiples
  // peticiones 401 simultáneas sólo hagan un único refresh.
  async _silentRefresh() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      try {
        const csrf = this.getCsrfToken();
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? { 'X-CSRF-Token': csrf } : {}
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => ({}));
        if (data.csrfToken) this.setCsrfToken(data.csrfToken);
        if (data.user) this.currentUser = data.user;
        return true;
      } catch {
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  },

  get(ruta) {
    return this.request(ruta, { method: 'GET' });
  },

  post(ruta, cuerpo) {
    return this.request(ruta, {
      method: 'POST',
      body: JSON.stringify(cuerpo || {})
    });
  },

  put(ruta, cuerpo) {
    return this.request(ruta, {
      method: 'PUT',
      body: JSON.stringify(cuerpo || {})
    });
  },

  showToast(mensaje, tipo = 'info') {
    const contenedor = document.getElementById('toast-container');
    if (!contenedor) return;

    const colores = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-slate-800 text-white'
    };

    const cajita = document.createElement('div');
    cajita.className = `flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${colores[tipo] || colores.info}`;

    const span = document.createElement('span');
    span.textContent = String(mensaje);

    const btn = document.createElement('button');
    btn.style.fontWeight = 'bold';
    btn.style.cursor = 'pointer';
    btn.textContent = '×';
    btn.addEventListener('click', () => cajita.remove());

    cajita.appendChild(span);
    cajita.appendChild(btn);
    contenedor.appendChild(cajita);

    setTimeout(() => {
      if (cajita.parentNode) {
        cajita.remove();
      }
    }, 4000);
  }
};
