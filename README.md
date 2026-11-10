# 🏥 Sistema de Clasificación de Triage para Servicios de Urgencias Hospitalarias

> **Proyecto Académico:** Administración de la Información  
> **Institución:** Universidad Santiago de Cali (USC)  
> **Marco Legal:** **Resolución 5596 de 2015** — Ministerio de Salud y Protección Social (Colombia)  
> **Estado:** Listo para ejecutar localmente (Producción / Demostración)

---

## 📋 Descripción del Proyecto

El **Sistema de Clasificación de Triage Hospitalario** es una solución web integral diseñada para gestionar la recepción, priorización clínica en tiempo real y flujo de atención de pacientes en el servicio de urgencias de una institución de salud de media y alta complejidad en Colombia.

Conforme a la **Resolución 5596 de 2015**, el objetivo del triage es garantizar que la prioridad de atención no se base en el orden de llegada, sino en el **riesgo vital** y el grado de deterioro clínico del paciente. Además, la norma establece que **nunca se debe negar la primera valoración a un paciente que consulte el servicio de urgencias**.

---

## ⚖️ Marco Normativo: Niveles de Triage (Resolución 5596/2015)

El sistema implementa las 5 categorías oficiales, codificadas por color, severidad y tiempos máximos:

| Nivel | Denominación | Color Oficial | Código HEX | Tiempo Máximo de Espera | Criterio Clínico y Conducta | Configurable |
| :---: | :--- | :---: | :---: | :---: | :--- | :---: |
| **I** | **Triage I** | **Rojo** | `#DC2626` | **0 min (Inmediato)** | Requiere atención inmediata. Paciente en riesgo vital inminente con alteración severa de signos vitales, vía aérea o paro cardiorrespiratorio. | **No** (Ley) |
| **II** | **Triage II** | **Naranja** | `#EA580C` | **Hasta 30 minutos** | La condición del paciente puede evolucionar hacia un deterioro rápido o secuelas graves si no se atiende oportunamente. | **No** (Ley) |
| **III**| **Triage III** | **Amarillo** | `#EAB308` | **Por defecto 120 min** | Paciente con estabilidad hemodinámica que requiere exámenes diagnósticos complementarios, vigilancia o tratamiento urgente. | **Sí** (Institucional) |
| **IV** | **Triage IV** | **Verde** | `#16A34A` | **Por defecto 240 min** | Sin riesgo vital ni compromiso fisiológico agudo; presenta síntomas menores o molestias que no comprometen la vida. | **Sí** (Institucional) |
| **V** | **Triage V** | **Azul** | `#2563EB` | **Por defecto 360 min** | Problema de salud agudo o crónico sin deterioro clínico. Puede ser derivado a consulta externa o prioritaria. | **Sí** (Institucional) |

> ⚠️ **Modo Emergencia / Desastre con Múltiples Víctimas:**  
> La Resolución 5596/2015 estipula que los tiempos máximos normativos **no aplican** ante emergencias, desastres o contingencias masivas. El sistema incluye un interruptor global de *Modo Emergencia* que suspende visual y normativamente los cronómetros de advertencia, alertando a todas las terminales en tiempo real.

---

## 🛠️ Stack Tecnológico

- **Backend:** Node.js + Express 5.
- **Base de Datos:** SQLite 3 relacional de alto rendimiento mediante `better-sqlite3`, con claves foráneas estrictas (`PRAGMA foreign_keys = ON`), transacciones atómicas e índices optimizados.
- **Frontend:** Single Page Application (SPA) responsive construida en JavaScript Vanilla moderno (ES6+), estilizada con **Tailwind CSS**, tipografía Inter y set de iconos clínicos de **Lucide Icons**.
- **Tiempo Real:** **Socket.IO** para sincronización bidireccional inmediata de eventos clínicos (nuevos ingresos, clasificaciones, reclasificaciones, detención de cronómetros por inicio de atención y cambios de conducta) con fallback automático por *polling*.
- **Seguridad y Autenticación:** Tokens JWT (JSON Web Tokens) con cifrado `HMAC-SHA256`, contraseñas encriptadas con **bcryptjs** (10 rondas de salt) y control de acceso basado en roles (RBAC) tanto en el backend (middlewares) como en el frontend (renderizado condicional del menú).

---

## 👥 Actores y Roles del Sistema

```
                                      [ FLUJO CLÍNICO DEL PACIENTE ]
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
     [ 1. ADMINISTRATIVO ]                                                 [ 2. ENFERMERO JEFE ]
   • Recepción del paciente                                               • Cola de espera de triage
   • Valida EPS y Acudiente                                               • Toma de signos vitales (FC, FR, PA, SpO2, Temp)
   • Genera Ingreso URG-XXXX                                              • Escala de dolor EVA (0-10) y Conciencia
   • Estado: EN_ESPERA_TRIAGE                                             • Asigna Nivel I a V
                 │                                                        • Inicia Cronómetro de Espera
                 └──────────────────────────────────┬──────────────────────────────────┘
                                                    ▼
                                          [ 3. MÉDICO DE URGENCIAS ]
                                        • Tablero en Vivo por Prioridad
                                        • Inicia Atención (Detiene Cronómetro)
                                        • Reclasificación Clínica (Auditoría)
                                        • Define Conducta Médica (Alta, Hospitalización, etc.)
                                        • Cierre del Ingreso
```

### 1. Rol Administrativo (Admisiones)
- Búsqueda, creación y edición de pacientes con identificación colombiana (CC, TI, RC, CE, PA, PEP, PPT), fecha de nacimiento, sexo, teléfono, dirección, EPS y acudiente.
- Admisión a urgencias: genera consecutivo único anual (`URG-2026-XXXX`), motivo de consulta y acompañante, asignando el estado `"EN_ESPERA_TRIAGE"`.
- Consulta la tabla de admisiones del turno, sin acceso a toma de decisiones clínicas ni clasificación.

### 2. Rol Profesional de Salud: Enfermero(a) Jefe
- Visualiza la cola de pacientes en espera de valoración con su tiempo transcurrido desde la llegada.
- Registra la valoración clínica de triage:
  - Frecuencia Cardíaca (lpm)
  - Frecuencia Respiratoria (rpm)
  - Presión Arterial Sistólica y Diastólica (mmHg)
  - Temperatura Corporal (°C)
  - Saturación de Oxígeno SpO2 (%)
  - Escala Visual Analógica de Dolor (EVA 0 a 10)
  - Estado de Conciencia (Alerta, Respuesta a voz, Respuesta a dolor, Inconsciente)
  - Observaciones clínicas y fundamentación del nivel de triage (1 al 5).
- Al guardar la valoración, el ingreso pasa a `"CLASIFICADO"` e **inicia automáticamente el cronómetro** de sala de espera.

### 3. Rol Profesional de Salud: Médico de Urgencias
- Tablero de Urgencias en tiempo real ordenado estrictamente por prioridad (Triage I primero, luego II, etc.) y tiempo transcurrido (FIFO).
- **Iniciar Atención:** Registra la fecha y hora de atención presencial, cambiando el estado a `"EN_ATENCION"`. **Esta acción detiene el cronómetro de espera**, dejando constancia del tiempo exacto que el paciente esperó.
- **Reclasificar Paciente:** En caso de deterioro o mejoría, el médico puede cambiar el nivel de triage. Se exige registrar obligatoriamente la justificación clínica y se almacena en la tabla `historial_reclasificaciones` con fecha y médico responsable.
- **Definir Conducta Médica:** Selecciona el desenlace asistencial (`ATENDER_URGENCIAS`, `SOLICITAR_EXAMENES`, `HOSPITALIZAR`, `REMITIR`, `DERIVAR_CONSULTA`, `ALTA_MEDICA`), redacta la orden/justificación, define el servicio destino y cierra el caso (`"CERRADO"`).

### 4. Rol Administrador del Sistema
- Gestión de usuarios y asignación de roles.
- Tabla editable de tiempos institucionales para Triage III, IV y V (bloqueando por norma los niveles I y II).
- Activación y desactivación del **Modo Emergencia / Múltiples Víctimas**.
- Consulta del registro de auditoría clínica y operativa.

---

## 💻 Tablero de Urgencias en Tiempo Real (Pieza Central)

El tablero de urgencias opera como el monitor de mando del hospital:
- **Priorización Automática:** Siempre encabeza los pacientes con Triage I (Rojo), seguidos de Triage II (Naranja), Triage III (Amarillo), etc.
- **Cronómetro Persistente:** Se calcula en tiempo real a partir del `fecha_clasificacion` almacenado en SQLite. **Al recargar el navegador o cambiar de equipo, los cronómetros reflejan exactamente el tiempo transcurrido sin reiniciarse**.
- **Alertas Visuales Automatizadas:**
  - `NORMAL`: Estado en verde/gris mientras el tiempo sea menor al 75% del límite.
  - `POR VENCER (>75% del tiempo)`: Resaltado amarillo con animación de parpadeo suave (*pulse*).
  - `VENCIDO (>100% del tiempo)`: Borde rojo intermitente con badge `TIEMPO VENCIDO` y cronómetro que cuantifica los minutos excedidos en formato `+HH:MM:SS`.
  - `TRIAGE I`: Alerta roja parpadeante continua con rótulo `¡ATENCIÓN INMEDIATA! RIESGO VITAL`.

---

## 🗄️ Modelo de Datos Relacional (SQLite)

```
  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
  │    USUARIOS     │       │    PACIENTES    │       │ NIVELES_TRIAGE  │
  ├─────────────────┤       ├─────────────────┤       ├─────────────────┤
  │ id (PK)         │       │ id (PK)         │       │ nivel (PK 1..5) │
  │ nombre          │       │ tipo_documento  │       │ nombre          │
  │ documento       │       │ numero_documento│       │ color           │
  │ rol             │       │ nombres         │       │ codigo_color    │
  │ password_hash   │       │ apellidos       │       │ minutos_max     │
  │ activo          │       │ fecha_nacimiento│       │ editable        │
  └────────┬────────┘       │ eps             │       └────────┬────────┘
           │                └────────┬────────┘                │
           │                         │                         │
           │                         ▼                         │
           │                ┌─────────────────┐                │
           │ 1:N            │    INGRESOS     │                │
           └───────────────►├─────────────────┤                │
                            │ id (PK)         │                │
                            │ consecutivo     │                │
                            │ paciente_id(FK) ├─┐              │
                            │ estado          │ │              │
                            │ fecha_llegada   │ │              │
                            │ fecha_inicio_at.│ │              │
                            │ fecha_cierre    │ │              │
                            └────────┬────────┘ │              │
                                     │          │              │
                   ┌─────────────────┴────┐     │              │
                   ▼                      ▼     ▼              │
        ┌─────────────────┐    ┌─────────────────────┐         │
        │    CONDUCTAS    │    │       TRIAGE        │         │
        ├─────────────────┤    ├─────────────────────┤         │
        │ id (PK)         │    │ id (PK)             │         │
        │ ingreso_id (FK) │    │ ingreso_id (FK, UQ) │         │
        │ tipo            │    │ nivel (FK) ─────────┼─────────┘
        │ descripcion     │    │ fc, fr, pas, pad    │
        │ medico_id (FK)  │    │ temp, spo2, dolor   │
        └─────────────────┘    │ fecha_clasificacion │
                               └──────────┬──────────┘
                                          │ 1:N
                                          ▼
                               ┌─────────────────────┐
                               │ HISTORIAL_RECLASIF. │
                               ├─────────────────────┤
                               │ id (PK)             │
                               │ triage_id (FK)      │
                               │ nivel_anterior      │
                               │ nivel_nuevo         │
                               │ motivo              │
                               │ reclasificado_por   │
                               └─────────────────────┘
```

El script DDL completo se encuentra en [`database/schema.sql`](file:///C:/Users/luisc/MEDBOT/database/schema.sql) y los datos iniciales en [`database/seed.sql`](file:///C:/Users/luisc/MEDBOT/database/seed.sql).

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js versión 18 o superior (probado en Node.js v24 LTS).
- npm (incluido con Node.js).

### Pasos de Ejecución

1. **Clonar o ubicarse en el directorio del proyecto:**
   ```bash
   cd c:\Users\luisc\MEDBOT
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Ejecutar la suite de pruebas automatizadas (opcional pero recomendado):**
   ```bash
   npm test
   ```
   *Verificará la autenticación de los 4 roles, admisiones, triage, reclasificaciones, conductas, cálculo de tiempos y restricciones normativas.*

4. **Iniciar el servidor de la aplicación:**
   ```bash
   npm start
   ```

5. **Abrir en su navegador:**
   Navegue a: **[http://localhost:3000](http://localhost:3000)**

*(Opcional) Si en algún momento desea restablecer la base de datos a su estado original con los datos semilla:*
```bash
npm run reset-db
```

---

## 🔑 Cuentas de Acceso de Prueba (Seed Data)

Para facilitar la calificación y evaluación del sistema, la pantalla de inicio de sesión incluye botones de **Acceso Rápido por Rol** (con un solo clic), o puede ingresar manualmente con las siguientes credenciales:

| Rol | Nombre de Prueba | Documento (Usuario) | Contraseña | Capacidades y Vistas |
| :--- | :--- | :---: | :---: | :--- |
| **Administrativo** | Jhonatan Alexander Gómez | `1001` | `Admin123!` | Admisión de pacientes, creación/búsqueda de pacientes, ingresos del turno. |
| **Enfermero Jefe** | Enf. Marcela Zuluaga Osorio | `1002` | `Enfermero123!` | Cola de triage pendiente, registro de signos vitales, clasificación 1-5 e inicio de cronómetro. |
| **Médico de Urgencias** | Dr. Alejandro Restrepo Ruiz | `1003` | `Medico123!` | Tablero en vivo, inicio de atención (detiene timer), reclasificación con motivo, definición de conducta y alta. |
| **Administrador** | Dra. Claudia Patricia Rivas | `1000` | `Admin123!` | Acceso completo maestro, edición de tiempos III, IV y V, activación de Modo Emergencia, usuarios y auditoría. |

---

## 🧪 Casos de Prueba Incluidos en los Datos Semilla

Al arrancar por primera vez, el sistema ya cuenta con pacientes precargados en diferentes estados de urgencias para evaluar el comportamiento en vivo:

1. **Carlos Mario Restrepo (CC 11440001) - Triage I (Rojo):**  
   Sospecha de Síndrome Coronario Agudo. Muestra alerta de atención inmediata y cronómetro activo en el tablero.
2. **María Fernanda Gómez (CC 11440002) - Triage II (Naranja):**  
   Cefalea en estallido (10/10) y crisis hipertensiva. Límite de 30 minutos.
3. **Juan David Herrera (CC 11440003) - Triage III (Amarillo):**  
   Dolor en fosa ilíaca derecha (sospecha de apendicitis). Espera normal dentro del rango de 120 min.
4. **Laura Camila Muñoz (CC 11440006) - Triage III (Amarillo):**  
   Trauma craneoencefálico leve clasificado hace más de 95 min. **Ilustra la alerta visual de "Por Vencer" (>75% del tiempo)** con resplandor amarillo.
5. **Rosa Elena Morales (CC 11440007) - Triage III (Amarillo):**  
   Cólico renal agudo clasificado hace más de 135 min. **Ilustra la alerta visual de "Vencido" (>100% del tiempo)** con borde rojo pulsante y conteo excedido.
6. **Diego Armando Ortiz (CC 11440008) - Triage II (En Atención):**  
   Crisis asmática atendida por el médico; **el cronómetro se encuentra detenido** y se muestra el badge de atención en curso.
7. **Sofía Martínez y Pedro Silva:**  
   Pacientes recién ingresados que se encuentran en la **Cola de Triage Pendiente** esperando ser valorados por el Enfermero Jefe.

---

## 📁 Estructura del Proyecto

```
MEDBOT/
├── backend/
│   └── src/
│       ├── db.js                     # Conexión SQLite, modo WAL y auto-seed
│       ├── config.js                 # Variables de entorno y constantes
│       ├── server.js                 # Servidor Express, Socket.IO y static host
│       ├── middleware/
│       │   └── auth.js               # Verificación JWT, roles y log de auditoría
│       └── routes/
│           ├── auth.routes.js        # Login (/api/auth/login) y perfil (/me)
│           ├── pacientes.routes.js   # CRUD de pacientes
│           ├── ingresos.routes.js    # Admisiones, cola de triage y tablero en vivo
│           ├── triage.routes.js      # Clasificación y reclasificación médica
│           ├── atencion.routes.js    # Inicio de atención, conducta y cierre
│           └── configuracion.routes.js # Tiempos, modo emergencia, usuarios y auditoría
├── database/
│   ├── schema.sql                    # Script DDL de tablas, relaciones e índices
│   ├── seed.sql                      # Datos iniciales (roles, tiempos, pacientes y casos)
│   ├── reset.js                      # Script para reiniciar la base de datos
│   └── triage_urgencias.db           # Archivo de base de datos SQLite (autogenerado)
├── frontend/
│   ├── index.html                    # Layout responsive principal de la SPA
│   ├── css/
│   │   └── styles.css                # Animaciones de parpadeo, badges de triage y temas
│   └── js/
│       ├── api.js                    # Cliente HTTP con JWT y notificaciones Toast
│       ├── timer.js                  # Motor digital de cronómetros y cálculo de alertas
│       ├── socket.js                 # Cliente Socket.IO para sincronización en tiempo real
│       ├── app.js                    # Router principal, gestión de sesión y modales
│       └── views/
│           ├── tablero.view.js       # Vista principal: Tablero en tiempo real
│           ├── admisiones.view.js    # Módulo de admisiones e ingresos del día
│           ├── pacientes.view.js     # Directorio y gestión de pacientes
│           ├── enfermeria.view.js    # Cola de espera y formulario de valoración
│           ├── medico.view.js        # Mis pacientes, historial y conductas
│           └── admin.view.js         # Configuración institucional y auditoría
├── test/
│   └── api.test.js                   # Suite de pruebas automatizadas integrales
├── package.json                      # Scripts de ejecución y dependencias
└── README.md                         # Documentación técnica y funcional
```

---

## 🎓 Cumplimiento de Requerimientos de la Materia

| Requerimiento Solicitado | Implementación en el Proyecto |
| :--- | :--- |
| **Backend en Node.js + Express** | Express 5 modular con controladores organizados en `backend/src/routes/`. |
| **Base de Datos SQL Relacional** | SQLite con `better-sqlite3`, integridad referencial, índices y script `schema.sql`. |
| **Frontend Responsive y Limpio** | Diseño limpio con Tailwind CSS y componentes en `frontend/`. |
| **Autenticación con Roles** | JWT con contraseñas hasheadas en `bcryptjs`. Rutas protegidas en backend y frontend. |
| **Resolución 5596 de 2015** | 5 niveles de triage por color, tiempos estipulados y modo emergencia / víctimas múltiples. |
| **Tiempos Configurables** | Triage III, IV y V editables desde panel de configuración; Triage I y II fijos por ley. |
| **Roles Diferenciados** | Vistas y acciones restringidas para Administrativo, Enfermero Jefe, Médico y Administrador. |
| **Tablero de Urgencias en Vivo** | Orden por prioridad, cronómetro persistente `HH:MM:SS`, alertas "por vencer" y "vencido". |
| **Detención de Cronómetro** | Al presionar "Iniciar Atención", el médico detiene el conteo registrando la fecha/hora en BD. |
| **Reclasificación Auditada** | El médico puede reclasificar el nivel, requiriendo justificación clínica y guardando historial. |
| **Definición de Conducta** | Registro de conducta médica (alta, exámenes, hospitalizar, etc.) y cierre del caso. |
| **Pruebas y Verificación** | Suite completa `npm test` probando cada endpoint y regla de negocio. |

