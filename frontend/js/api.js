// API CLIENT WRAPPER CON SOPORTE JWT Y NOTIFICACIONES TOAST
const API = {
  getToken() {
    return localStorage.getItem('medbot_triage_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('medbot_triage_token', token);
    } else {
      localStorage.removeItem('medbot_triage_token');
    }
  },

  getUser() {
    try {
      const data = localStorage.getItem('medbot_triage_user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('medbot_triage_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('medbot_triage_user');
    }
  },

  logout() {
    this.setToken(null);
    this.setUser(null);
    window.location.reload();
  },

  async request(endpoint, options = {}) {
    const url = `/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.showToast('Sesión expirada o no autorizada. Ingrese nuevamente.', 'warning');
        this.logout();
        throw new Error('Sesión no autorizada.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`Error en petición a ${url}:`, err);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white border-emerald-700',
      error: 'bg-rose-600 text-white border-rose-700',
      warning: 'bg-amber-500 text-white border-amber-600',
      info: 'bg-slate-800 text-white border-slate-700'
    };

    const icons = {
      success: '<i data-lucide="check-circle" class="w-5 h-5 flex-shrink-0"></i>',
      error: '<i data-lucide="alert-circle" class="w-5 h-5 flex-shrink-0"></i>',
      warning: '<i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0"></i>',
      info: '<i data-lucide="info" class="w-5 h-5 flex-shrink-0"></i>'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="flex-1">${message}</span>
      <button class="opacity-75 hover:opacity-100 transition-opacity ml-2">&times;</button>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    // Fade-in
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    const closeBtn = toast.querySelector('button');
    closeBtn.onclick = () => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    };

    // Auto-remove después de 4.5 segundos
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4500);
  }
};

