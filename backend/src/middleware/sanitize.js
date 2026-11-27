// ============================================================
// ARCHIVO: sanitize.js
// Middleware de sanitización de entradas contra XSS y Prototype Pollution
// ============================================================

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function limpiarTexto(valor) {
  if (typeof valor !== 'string') return valor;

  return valor
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(iframe|object|embed|applet|meta|link|style|svg|math)[^>]*>/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizarRecursivo(datos) {
  if (!datos || typeof datos !== 'object') {
    return typeof datos === 'string' ? limpiarTexto(datos) : datos;
  }

  if (Array.isArray(datos)) {
    return datos.map((item) => sanitizarRecursivo(item));
  }

  const resultado = Object.create(null);
  for (const llave of Object.keys(datos)) {
    if (FORBIDDEN_KEYS.has(llave)) {
      continue;
    }
    resultado[llave] = sanitizarRecursivo(datos[llave]);
  }
  return { ...resultado };
}

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
