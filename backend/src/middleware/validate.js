// ============================================================
// ARCHIVO: validate.js
// Esquemas estrictos de validación con Zod (anti mass-assignment)
// ============================================================

const { z } = require('zod');

const passwordPolicySchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(128, 'La contraseña no puede superar los 128 caracteres.')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula.')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula.')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un símbolo especial.');

const loginSchema = z
  .object({
    documento: z.string().trim().min(1, 'Documento obligatorio.').max(30, 'Documento demasiado largo.'),
    password: z.string().min(1, 'Contraseña obligatoria.').max(128, 'Contraseña demasiado larga.')
  })
  .strict();

const cambiarPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Contraseña actual obligatoria.').max(128),
    newPassword: passwordPolicySchema
  })
  .strict();

const optionalNullableString = (maxLen) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .nullish()
    .transform((v) => (typeof v === 'string' && v.trim() === '' ? null : v ? v.trim() : null));

const optionalNullableInt = (min, max) =>
  z
    .union([z.coerce.number().int().min(min).max(max), z.literal('')])
    .nullish()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)));

const optionalNullableFloat = (min, max) =>
  z
    .union([z.coerce.number().min(min).max(max), z.literal('')])
    .nullish()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)));

const pacienteCreateSchema = z
  .object({
    tipo_documento: z.enum(['CC', 'TI', 'RC', 'CE', 'PA', 'PEP', 'PPT']),
    numero_documento: z
      .string()
      .trim()
      .min(3, 'El número de documento debe tener al menos 3 caracteres.')
      .max(30, 'El número de documento no puede superar 30 caracteres.')
      .regex(/^[A-Za-z0-9._-]+$/, 'Formato de documento inválido.'),
    nombres: z.string().trim().min(1, 'Nombres obligatorios.').max(100),
    apellidos: z.string().trim().min(1, 'Apellidos obligatorios.').max(100),
    fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD).'),
    sexo: z.enum(['M', 'F', 'OTRO']),
    telefono: optionalNullableString(30),
    direccion: optionalNullableString(200),
    eps: z.string().trim().min(2, 'La EPS es obligatoria.').max(120),
    acudiente_nombre: optionalNullableString(120),
    acudiente_telefono: optionalNullableString(30)
  })
  .strict();

const pacienteUpdateSchema = pacienteCreateSchema.partial().strict();

const ingresoCreateSchema = z
  .object({
    paciente_id: z.coerce.number().int().positive(),
    motivo_consulta: z.string().trim().min(3, 'El motivo de consulta es obligatorio.').max(1000),
    acompanante: optionalNullableString(150)
  })
  .strict();

const triageCreateSchema = z
  .object({
    ingreso_id: z.coerce.number().int().positive(),
    nivel: z.coerce.number().int().min(1).max(5),
    fc: optionalNullableInt(20, 250),
    fr: optionalNullableInt(5, 80),
    pas: optionalNullableInt(40, 300),
    pad: optionalNullableInt(20, 200),
    temperatura: optionalNullableFloat(30, 43),
    spo2: optionalNullableInt(40, 100),
    dolor: optionalNullableInt(0, 10),
    estado_conciencia: z
      .enum(['Alerta', 'Voz', 'Dolor', 'Inconsciente', 'Somnoliento', 'Obnubilado', 'Estupor', 'Coma'])
      .optional()
      .default('Alerta'),
    observaciones: z.string().trim().min(3, 'Las observaciones clínicas son obligatorias.').max(2000)
  })
  .strict();

const reclasificarSchema = z
  .object({
    nivel_nuevo: z.coerce.number().int().min(1).max(5),
    motivo: z.string().trim().min(5, 'El motivo clínico es obligatorio.').max(1000)
  })
  .strict();

const conductaSchema = z
  .object({
    tipo: z.enum([
      'ATENDER_URGENCIAS',
      'SOLICITAR_EXAMENES',
      'HOSPITALIZAR',
      'REMITIR',
      'DERIVAR_CONSULTA',
      'ALTA_MEDICA'
    ]),
    descripcion: z.string().trim().min(5, 'La descripción clínica es obligatoria.').max(2000),
    destino: optionalNullableString(200)
  })
  .strict();

const nivelUpdateSchema = z
  .object({
    minutos_max: z.coerce.number().int().min(5, 'Mínimo 5 minutos.').max(1440, 'Máximo 1440 minutos.')
  })
  .strict();

const emergenciaSchema = z
  .object({
    activo: z.boolean()
  })
  .strict();

const usuarioCreateSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    documento: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9._-]+$/, 'Formato de documento inválido.'),
    rol: z.enum(['ADMINISTRATIVO', 'ENFERMERO', 'MEDICO', 'ADMIN']),
    password: passwordPolicySchema
  })
  .strict();

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        error: firstIssue ? firstIssue.message : 'Datos de entrada inválidos.'
      });
    }
    req.validatedBody = parsed.data;
    next();
  };
}

function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    const val = Number(req.params[paramName]);
    if (!Number.isInteger(val) || val <= 0) {
      return res.status(400).json({ error: 'Identificador numérico inválido.' });
    }
    req.validatedParams = req.validatedParams || {};
    req.validatedParams[paramName] = val;
    next();
  };
}

module.exports = {
  passwordPolicySchema,
  loginSchema,
  cambiarPasswordSchema,
  pacienteCreateSchema,
  pacienteUpdateSchema,
  ingresoCreateSchema,
  triageCreateSchema,
  reclasificarSchema,
  conductaSchema,
  nivelUpdateSchema,
  emergenciaSchema,
  usuarioCreateSchema,
  validateBody,
  validateIdParam
};
