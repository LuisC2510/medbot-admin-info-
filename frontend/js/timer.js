// MOTOR DE CRONÓMETROS Y ALERTAS VISUALES EN TIEMPO REAL
// Basado en marcas de tiempo (timestamps) de la base de datos (Res. 5596/2015)

const TimerEngine = {
  activeTimers: new Map(),
  intervalId: null,

  parseDate(dateStr) {
    if (!dateStr) return null;
    // Soporte para formato SQLite 'YYYY-MM-DD HH:MM:SS' y estándar ISO
    const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    return new Date(normalized);
  },

  formatHHMMSS(totalSeconds) {
    const isNegative = totalSeconds < 0;
    const absSeconds = Math.abs(Math.floor(totalSeconds));

    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const seconds = absSeconds % 60;

    const formatted = [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0')
    ].join(':');

    return isNegative ? `-${formatted}` : formatted;
  },

  calculateStatus(paciente) {
    const clasifDate = this.parseDate(paciente.fecha_clasificacion);
    if (!clasifDate) return { elapsedFormatted: '00:00:00', alertState: 'NORMAL', percent: 0 };

    let endTimestamp = Date.now();
    let isStopped = false;

    if (paciente.fecha_inicio_atencion || paciente.estado === 'EN_ATENCION' || paciente.estado === 'CERRADO') {
      const atencionDate = this.parseDate(paciente.fecha_inicio_atencion);
      if (atencionDate) {
        endTimestamp = atencionDate.getTime();
      }
      isStopped = true;
    }

    const elapsedSeconds = Math.max(0, Math.floor((endTimestamp - clasifDate.getTime()) / 1000));
    const maxSeconds = (paciente.triage_minutos_max || 0) * 60;

    let alertState = 'NORMAL';
    let percent = 0;
    let remainingSeconds = maxSeconds - elapsedSeconds;

    if (paciente.triage_nivel === 1) {
      alertState = 'INMEDIATA';
      percent = 100;
    } else if (maxSeconds > 0) {
      percent = Math.min(100, Math.round((elapsedSeconds / maxSeconds) * 100));
      if (elapsedSeconds > maxSeconds) {
        alertState = 'VENCIDO';
      } else if (elapsedSeconds >= maxSeconds * 0.75) {
        alertState = 'POR_VENCER';
      }
    }

    return {
      elapsedSeconds,
      elapsedFormatted: this.formatHHMMSS(elapsedSeconds),
      remainingSeconds,
      remainingFormatted: remainingSeconds >= 0 ? this.formatHHMMSS(remainingSeconds) : `+${this.formatHHMMSS(Math.abs(remainingSeconds))}`,
      maxFormatted: this.formatHHMMSS(maxSeconds),
      alertState,
      percent,
      isStopped
    };
  },

  registerPatient(paciente, elements) {
    this.activeTimers.set(paciente.ingreso_id, {
      paciente,
      elements
    });
    this.updatePatientDisplay(paciente.ingreso_id);
    this.startLoop();
  },

  unregisterPatient(ingresoId) {
    this.activeTimers.delete(ingresoId);
    if (this.activeTimers.size === 0) {
      this.stopLoop();
    }
  },

  clearAll() {
    this.activeTimers.clear();
    this.stopLoop();
  },

  startLoop() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  },

  stopLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  tick() {
    for (const [ingresoId] of this.activeTimers) {
      this.updatePatientDisplay(ingresoId);
    }
  },

  updatePatientDisplay(ingresoId) {
    const timerData = this.activeTimers.get(ingresoId);
    if (!timerData) return;

    const { paciente, elements } = timerData;
    const calc = this.calculateStatus(paciente);

    // Actualizar texto del cronómetro transcurrido
    if (elements.elapsed) {
      elements.elapsed.textContent = calc.elapsedFormatted;
    }

    // Actualizar texto de tiempo restante
    if (elements.remaining) {
      if (paciente.triage_nivel === 1) {
        elements.remaining.textContent = 'ATENCIÓN INMEDIATA';
      } else if (calc.remainingSeconds < 0) {
        elements.remaining.textContent = `VENCIDO ${calc.remainingFormatted}`;
      } else {
        elements.remaining.textContent = `Restante: ${calc.remainingFormatted}`;
      }
    }

    // Actualizar barra de progreso
    if (elements.progressBar) {
      elements.progressBar.style.width = `${calc.percent}%`;
      if (calc.alertState === 'VENCIDO') {
        elements.progressBar.className = 'h-2 rounded-full transition-all duration-500 bg-red-600';
      } else if (calc.alertState === 'POR_VENCER') {
        elements.progressBar.className = 'h-2 rounded-full transition-all duration-500 bg-amber-500';
      } else {
        elements.progressBar.className = 'h-2 rounded-full transition-all duration-500 bg-emerald-500';
      }
    }

    // Actualizar clase del contenedor de la tarjeta para alertas visuales
    if (elements.card) {
      elements.card.classList.remove('alerta-por-vencer', 'alerta-vencido');
      if (calc.alertState === 'VENCIDO') {
        elements.card.classList.add('alerta-vencido');
      } else if (calc.alertState === 'POR_VENCER') {
        elements.card.classList.add('alerta-por-vencer');
      }
    }

    // Actualizar badge de estado
    if (elements.badge) {
      if (calc.isStopped) {
        elements.badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1.5';
        elements.badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-600"></span>En Atención (Cronómetro detenido)`;
      } else if (calc.alertState === 'INMEDIATA') {
        elements.badge.className = 'px-2.5 py-1 text-xs font-bold rounded-md bg-red-100 text-red-700 border border-red-300 animate-pulse flex items-center gap-1.5';
        elements.badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>ATENCIÓN INMEDIATA`;
      } else if (calc.alertState === 'VENCIDO') {
        elements.badge.className = 'px-2.5 py-1 text-xs font-bold rounded-md bg-red-100 text-red-800 border border-red-300 animate-pulse flex items-center gap-1.5';
        elements.badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-600"></span>TIEMPO VENCIDO`;
      } else if (calc.alertState === 'POR_VENCER') {
        elements.badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5';
        elements.badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>POR VENCER (>75%)`;
      } else {
        elements.badge.className = 'px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5';
        elements.badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span>Dentro de Tiempo`;
      }
    }
  }
};

