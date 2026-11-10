// SINCRONIZACIÓN EN TIEMPO REAL CON SOCKET.IO Y FALLBACK DE POLLING

const RealtimeSync = {
  socket: null,
  connected: false,
  fallbackInterval: null,

  init(onDataChange) {
    if (typeof io !== 'undefined') {
      try {
        this.socket = io({
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

        // Escuchar eventos clínicos
        const eventos = [
          'ingreso:creado',
          'triage:clasificado',
          'triage:reclasificado',
          'atencion:iniciada',
          'atencion:cerrada',
          'config:niveles_actualizados'
        ];

        eventos.forEach(evt => {
          this.socket.on(evt, (data) => {
            if (onDataChange) onDataChange(evt, data);
          });
        });

        // Evento de Modo Emergencia
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
        console.warn('Socket.IO no disponible, activando modo polling.', err);
        this.startPollingFallback(onDataChange);
      }
    } else {
      console.log('Socket.IO client no detectado, activando polling.');
      this.startPollingFallback(onDataChange);
    }
  },

  startPollingFallback(onDataChange) {
    if (this.fallbackInterval) clearInterval(this.fallbackInterval);
    this.fallbackInterval = setInterval(() => {
      if (onDataChange) onDataChange('polling:tick', null);
    }, 10000); // Polling cada 10s como respaldo
  },

  updateConnectionBadge(isOnline) {
    const badge = document.getElementById('socket-status-badge');
    if (!badge) return;

    if (isOnline) {
      badge.className = 'flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>En Vivo (Sincronizado)</span>';
    } else {
      badge.className = 'flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span><span>Reconectando...</span>';
    }
  }
};

