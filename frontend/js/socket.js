// SINCRONIZACIÓN EN TIEMPO REAL CON SOCKET.IO Y FALLBACK DE POLLING

const RealtimeSync = {
  socket: null,
  connected: false,
  fallbackInterval: null,

  init(onDataChange) {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (typeof io !== 'undefined') {
      try {
        this.socket = io({
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000
        });

        this.socket.on('connect', () => {
          this.connected = true;
          this.updateConnectionBadge(true);
        });

        this.socket.on('disconnect', () => {
          this.connected = false;
          this.updateConnectionBadge(false);
        });

        this.socket.on('connect_error', () => {
          this.connected = false;
          this.updateConnectionBadge(false);
        });

        const eventos = [
          'ingreso:creado',
          'triage:clasificado',
          'triage:reclasificado',
          'atencion:iniciada',
          'atencion:cerrada',
          'config:niveles_actualizados'
        ];

        eventos.forEach((evt) => {
          this.socket.on(evt, (data) => {
            if (onDataChange) onDataChange(evt, data);
          });
        });

        this.socket.on('emergencia:toggle', (data) => {
          if (window.App && window.App.setEmergencyModeBanner) {
            window.App.setEmergencyModeBanner(data.activo);
          }
          if (data.activo) {
            API.showToast('⚠️ ATENCIÓN: Se ha activado el MODO EMERGENCIA / DESASTRE CON MÚLTIPLES VÍCTIMAS.', 'warning');
          } else {
            API.showToast('✅ Modo de emergencia finalizado. Se restablecen tiempos normativos.', 'info');
          }
          if (onDataChange) onDataChange('emergencia:toggle', data);
        });
      } catch (err) {
        this.startPollingFallback(onDataChange);
      }
    } else {
      this.startPollingFallback(onDataChange);
    }
  },

  startPollingFallback(onDataChange) {
    if (this.fallbackInterval) clearInterval(this.fallbackInterval);
    this.fallbackInterval = setInterval(() => {
      if (onDataChange) onDataChange('polling:tick', null);
    }, 10000);
  },

  updateConnectionBadge(isOnline) {
    const badge = document.getElementById('socket-status-badge');
    if (!badge) return;

    badge.replaceChildren();
    const dot = document.createElement('span');
    const label = document.createElement('span');

    if (isOnline) {
      badge.className = 'flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200';
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      label.textContent = 'En Vivo (Sincronizado)';
    } else {
      badge.className = 'flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200';
      dot.className = 'w-2 h-2 rounded-full bg-slate-400';
      label.textContent = 'Reconectando...';
    }

    badge.appendChild(dot);
    badge.appendChild(label);
  }
};
