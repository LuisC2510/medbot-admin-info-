// ============================================================
// ARCHIVO: sanitize.js
// Middleware de sanitización de entradas para prevenir ataques XSS
// (Cross-Site Scripting) e inyecciones de código en campos de texto.
// ============================================================

/**
 * Función que limpia un texto eliminando o desarmando etiquetas HTML peligrosas
 * como <script>, <iframe>, <object>, eventos como onload=, onerror=, etc.
 * 
 * @param {string} valor - Texto original ingresado por el usuario
 * @returns {string} Texto limpio y seguro para almacenar y mostrar
 */
function limpiarTexto(valor) {
  if (typeof valor !== 'string') return valor;

  return valor
    // 1. Eliminar etiquetas <script>...</script> y su contenido
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // 2. Eliminar etiquetas iframe, object, embed, etc.
    .replace(/<\/?(iframe|object|embed|applet|meta|link|style)[^>]*>/gi, '')
    // 3. Reemplazar caracteres < y > por entidades HTML para neutralizar cualquier otra etiqueta
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Recorre recursivamente un objeto o arreglo y limpia todas sus cadenas de texto.
 */
function sanitizarRecursivo(datos) {
  if (!datos || typeof datos !== 'object') {
    return typeof datos === 'string' ? limpiarTexto(datos) : datos;
  }

  // Si es un arreglo, sanitizamos cada elemento
  if (Array.isArray(datos)) {
    return datos.map(item => sanitizarRecursivo(item));
  }

  // Si es un objeto, sanitizamos cada una de sus propiedades
  const resultado = {};
  for (const llave of Object.keys(datos)) {
    resultado[llave] = sanitizarRecursivo(datos[llave]);
  }
  return resultado;
}

/**
 * Middleware de Express que se ejecuta antes de las rutas
 * y sanitiza automáticamente req.body, req.query y req.params.
 */
function sanitizarEntradas(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizarRecursivo(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizarRecursivo(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizarRecursivo(req.params);
  }
  next();
}

module.exports = {
  limpiarTexto,
  sanitizarRecursivo,
  sanitizarEntradas
};
