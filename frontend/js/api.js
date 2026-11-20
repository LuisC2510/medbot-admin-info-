// ============================================================
// ARCHIVO: api.js
// OBJETIVO: Conectar el frontend (pantalla) con el backend (servidor)
// Hecho de forma sencilla y directa usando fetch de JavaScript
// ============================================================

const API = {
  // 1. OBTENER EL TOKEN GUARDADO
  // Busca en la memoria del navegador si el usuario ya inició sesión
  getToken() {
    return localStorage.getItem('medbot_triage_token');
  },

  // 2. GUARDAR O BORRAR EL TOKEN
  setToken(token) {
    if (token) {
      localStorage.setItem('medbot_triage_token', token);
    } else {
      localStorage.removeItem('medbot_triage_token');
    }
  },

  // 3. OBTENER LOS DATOS DEL USUARIO LOGUEADO
  getUser() {
    try {
      const usuarioGuardado = localStorage.getItem('medbot_triage_user');
      if (!usuarioGuardado) return null;
      return JSON.parse(usuarioGuardado);
    } catch (error) {
      return null;
    }
  },

  // 4. GUARDAR LOS DATOS DEL USUARIO
  setUser(usuario) {
    if (usuario) {
      localStorage.setItem('medbot_triage_user', JSON.stringify(usuario));
    } else {
      localStorage.removeItem('medbot_triage_user');
    }
  },

  // 5. CERRAR SESIÓN
  // Limpia el token y recarga la página para mostrar el login
  logout() {
    this.setToken(null);
    this.setUser(null);
    window.location.reload();
  },

  // 6. FUNCIÓN GENERAL PARA HACER PETICIONES AL SERVIDOR
  // Usa "fetch" para enviar o pedir datos a las rutas /api/...
  async request(ruta, opciones = {}) {
    // Si la ruta no empieza con /, se lo agregamos
    const url = ruta.startsWith('/') ? `/api${ruta}` : `/api/${ruta}`;

    // Configuramos los encabezados
    const headers = {
      'Content-Type': 'application/json',
      ...opciones.headers
    };

    // Si tenemos token guardado, lo enviamos en la cabecera
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Hacemos la petición HTTP al backend
      const respuesta = await fetch(url, {
        ...opciones,
        headers: headers
      });

      // Leemos la respuesta como JSON
      const datos = await respuesta.json().catch(() => ({}));

      // Si el servidor nos dice 401 (no autorizado o token vencido)
      if (respuesta.status === 401) {
        this.showToast('Tu sesión expiró. Por favor vuelve a ingresar.', 'warning');
        // Esperamos medio segundo y cerramos sesión
        setTimeout(() => this.logout(), 600);
        throw new Error('Sesión expirada');
      }

      // Si hubo algún otro error (ej: 400, 404, 500)
      if (!respuesta.ok) {
        const mensajeError = datos.error || 'Ocurrió un error en el servidor';
        throw new Error(mensajeError);
      }

      // Todo salió bien, devolvemos los datos
      return datos;

    } catch (error) {
      console.log('Error en la petición a ' + url + ':', error.message);
      throw error;
    }
  },

  // 7. MÉTODOS CORTOS PARA GET, POST Y PUT
  // Para consultar información
  get(ruta) {
    return this.request(ruta, { method: 'GET' });
  },

  // Para enviar o crear nueva información
  post(ruta, cuerpo) {
    return this.request(ruta, {
      method: 'POST',
      body: JSON.stringify(cuerpo)
    });
  },

  // Para editar o actualizar información existente
  put(ruta, cuerpo) {
    return this.request(ruta, {
      method: 'PUT',
      body: JSON.stringify(cuerpo)
    });
  },

  // 8. MOSTRAR MENSAJES (TOAST) EN LA PANTALLA
  // Muestra una notificación visual en la esquina inferior
  showToast(mensaje, tipo = 'info') {
    const contenedor = document.getElementById('toast-container');
    if (!contenedor) return;

    // Colores según el tipo de mensaje
    const colores = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-slate-800 text-white'
    };

    // Crear la cajita del mensaje
    const cajita = document.createElement('div');
    cajita.className = `flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${colores[tipo] || colores.info}`;
    cajita.innerHTML = `
      <span>${mensaje}</span>
      <button style="font-weight:bold; cursor:pointer;" onclick="this.parentElement.remove()">&times;</button>
    `;

    contenedor.appendChild(cajita);

    // Se borra sola a los 4 segundos
    setTimeout(() => {
      if (cajita.parentNode) {
        cajita.remove();
      }
    }, 4000);
  }
};
