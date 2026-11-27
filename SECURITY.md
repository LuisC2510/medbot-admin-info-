# Guía de Seguridad — MedBot (Sistema de Triage de Urgencias)

Este documento describe los controles de seguridad implementados en **MedBot**, su correspondencia con **OWASP Top 10 (2021)**, los riesgos residuales en entorno local, las políticas de protección de datos personales (**Ley 1581 de 2012 - Colombia**) y los pasos de verificación.

---

## 1. Matriz de Amenazas (OWASP Top 10 2021) vs. Controles Implementados

| Categoría OWASP Top 10 (2021) | Amenaza Identificada | Medida Aplicada | Archivo(s) |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** | Rutas sin control de rol, IDOR en atención médica, escalada de privilegios vía body, Socket.IO abierto, CSRF | Middleware `requireRole` en **todas** las rutas; verificación de `medico_id` en atención/conducta; rol tomado solo del JWT verificado; Socket.IO autenticado en handshake; protección CSRF Double-Submit Cookie (`X-CSRF-Token` + `SameSite=Strict`) | `backend/src/middleware/auth.js`, `backend/src/middleware/csrf.js`, `backend/src/routes/*.js`, `backend/src/server.js` |
| **A02: Cryptographic Failures** | `JWT_SECRET` hardcodeado, expiración de 7 días, algoritmo no fijado, bcrypt costo 10, tokens en `localStorage` | `JWT_SECRET` obligatorio desde `.env` (mín. 32 chars; si falta, el servidor no arranca); JWT fijado a `HS256` con expiración `30m`; cookie `httpOnly` + `SameSite=Strict` (+ `Secure` con HTTPS); `bcryptjs` costo 12; soporte HTTPS opcional | `backend/src/config.js`, `backend/src/routes/auth.routes.js`, `frontend/js/api.js`, `backend/src/server.js` |
| **A03: Injection** | Posible SQLi en buscadores/parámetros, XSS almacenado en nombres/observaciones, Prototype Pollution, Mass Assignment | Consultas 100% parametrizadas con `better-sqlite3`; validación estricta con **Zod `.strict()`** (rechaza campos inesperados y valida rangos clínicos); sanitización recursiva que elimina `__proto__`/`constructor`/`prototype` y neutraliza HTML; `App.escapeHtml()` y `textContent` en frontend | `backend/src/middleware/validate.js`, `backend/src/middleware/sanitize.js`, `backend/src/routes/*.js`, `frontend/js/app.js`, `frontend/js/views/*.js` |
| **A04: Insecure Design** | Contraseñas semilla públicas en README y botones de acceso rápido, sin cambio obligatorio ni bloqueo de cuenta | Eliminación de credenciales del `README.md` y de accesos rápidos en UI; cambio obligatorio de contraseña en primer ingreso (`debe_cambiar_password`); política de contraseñas fuerte (mín. 10 chars, mayús, minús, número, símbolo); bloqueo temporal tras 5 intentos fallidos | `database/schema.sql`, `backend/src/routes/auth.routes.js`, `frontend/js/app.js`, `README.md` |
| **A05: Security Misconfiguration** | Cabeceras incompletas, CORS `*`, body de `1mb`, `err.message` expuesto en errores 500, sin timeouts | `helmet` con CSP restrictiva (sin `unsafe-inline` en `<script>`), `frameguard`, `Referrer-Policy`, `HSTS`; CORS restringido a `ALLOWED_ORIGINS`; `express.json({ limit: '10kb' })`; `x-powered-by` deshabilitado; manejador global de errores sin stack traces ni detalles de BD | `backend/src/server.js`, `.env.example`, `.gitignore` |
| **A06: Vulnerable & Outdated Components** | Dependencias desactualizadas o vulnerables | Auditoría con `npm audit` (0 vulnerabilidades) y uso exclusivo de dependencias activas (`express`, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `socket.io`, `cors`, `dotenv`, `helmet`, `cookie-parser`, `express-rate-limit`, `zod`) | `package.json` |
| **A07: Identification & Authentication Failures** | Enumeración de usuarios en login, fuerza bruta ilimitada, sesiones no revocables al cerrar sesión | Mensaje genérico `"Credenciales inválidas."` con comparación bcrypt ficticia para igualar tiempos; `express-rate-limit` estricto en `/api/auth/login`; bloqueo de cuenta tras 5 fallos; `token_version` en BD incrementado en `/logout` y `/cambiar-password`; rechazo de `alg: "none"` y tokens expirados | `backend/src/routes/auth.routes.js`, `backend/src/middleware/auth.js` |
| **A08: Software and Data Integrity Failures** | Manipulación de registros de auditoría | Triggers SQLite `prevent_audit_update` y `prevent_audit_delete` que impiden modificar o borrar `log_auditoria` desde la aplicación | `database/schema.sql`, `backend/src/db.js` |
| **A09: Security Logging & Monitoring Failures** | Falta de registro de intentos fallidos, accesos denegados y eventos CSRF/Socket | Auditoría completa en `log_auditoria` (login exitoso/fallido/bloqueado, logout, cambio de clave, creación de usuarios, clasificaciones, reclasificaciones, `ACCESO_DENEGADO` 403, `CSRF_INVALIDO`, eventos Socket.IO no permitidos) con usuario, IP y fecha | `backend/src/middleware/auth.js`, `backend/src/routes/*.js` |
| **A10: Server-Side Request Forgery (SSRF)** | Peticiones salientes arbitrarias desde el servidor | El backend no realiza peticiones HTTP salientes controladas por el usuario (superficie SSRF nula) | N/A |

---

## 2. Protección de Datos Personales y Clínicos (Ley 1581 de 2012 — Colombia)

MedBot trata datos personales sensibles (historias clínicas, signos vitales, motivos de consulta e identificación de pacientes) sujetos a la **Ley Estatutaria 1581 de 2012** y la **Resolución 5596 de 2015**:

1. **Minimización de datos**: Las respuestas de la API excluyen `password_hash`, contadores de bloqueo y campos internos innecesarios.
2. **Control de acceso y confidencialidad**: Solo personal autenticado y con el rol clínico/administrativo correspondiente puede consultar o modificar registros.
3. **Trazabilidad e integridad**: Toda acción relevante queda registrada en `log_auditoria` de forma inmutable (solo inserción).
4. **Permisos del archivo de base de datos**:
   - En Linux/macOS, `db.js` aplica `chmod 0600` sobre `database/triage_urgencias.db` y `0700` sobre `database/`.
   - En Windows (NTFS), restringe las ACLs del archivo para que solo el usuario propietario del servicio y `SYSTEM` tengan acceso:
     ```powershell
     icacls database\triage_urgencias.db /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
     ```
5. **Copia de respaldo (Backup) recomendada**:
   Usar el comando nativo de respaldo en caliente de SQLite (seguro con modo WAL) antes de mantenimientos o diariamente:
   ```powershell
   node -e "const db=require('./backend/src/db'); db.backup('database/backup_' + Date.now() + '.db').then(()=>console.log('Backup OK'));"
   ```
   Los archivos `.db` y `.sqlite` están excluidos de Git en `.gitignore`.

---

## 3. HTTPS Local Opcional

Para habilitar HTTPS con certificado autofirmado en desarrollo:
1. Generar certificado local (por ejemplo con OpenSSL o `mkcert`) en `./certs/localhost-key.pem` y `./certs/localhost.pem`.
2. Configurar en `.env`:
   ```env
   HTTPS_ENABLED=true
   HTTPS_PORT=3443
   ALLOWED_ORIGINS=https://localhost:3443
   ```
3. El servidor escuchará en HTTPS (`3443`), redirigirá automáticamente HTTP (`3000`) → HTTPS (`3443`) y activará `Secure` en cookies y cabecera `HSTS`.

---

## 4. Riesgos Residuales (Entorno Local)

1. **CDN externos en frontend (`cdn.tailwindcss.com`, `unpkg.com`, `fonts.googleapis.com`)**: Al cargarse desde internet, requieren permitir esos dominios en la CSP y no cuentan con SRI dinámico en Tailwind Play CDN. En producción se recomienda compilar Tailwind localmente y alojar los assets bajo `'self'`.
2. **`script-src-attr 'unsafe-inline'`**: Algunos botones generados dinámicamente en vistas utilizan atributos `onclick="..."`. La directiva `script-src` bloquea etiquetas `<script>` inline, pero migrar todos los manejadores a `addEventListener` permitiría eliminar también `script-src-attr`.
3. **Almacenamiento en SQLite local sin cifrado en reposo (TDE)**: SQLite estándar no cifra el archivo `.db` en disco; se mitiga mediante permisos de archivo/ACL y cifrado de disco del sistema operativo (BitLocker/LUKS).
4. **Rate limiting en memoria**: `express-rate-limit` usa almacenamiento en memoria por defecto, suficiente para una instancia única; si se escala horizontalmente, requiere un store compartido (ej. Redis).

---

## 5. Pasos para Verificar Cada Medida

1. **Verificar variables de entorno obligatorias**:
   - Renombra temporalmente `.env` o deja `JWT_SECRET` vacío y ejecuta `npm start` → el servidor debe negarse a iniciar con código de salida `1`.
2. **Ejecutar la suite automatizada de ataques**:
   ```powershell
   npm run test:security
   ```
   Valida SQLi, XSS almacenado, fuerza bruta (bloqueo 423 + rate limit 429), RBAC e IDOR (403), JWT manipulado/expirado/`alg:none`/post-logout (401), rutas y Socket.IO sin token (401), payloads >10 KB (413), mass assignment (400), CSRF (403), cabeceras Helmet e inmutabilidad de auditoría.
3. **Ejecutar las pruebas funcionales de regresión**:
   ```powershell
   npm test
   ```
4. **Verificar dependencias**:
   ```powershell
   npm audit
   ```
