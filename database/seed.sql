-- ============================================================================
-- DATOS SEMILLA (SEED DATA)
-- SISTEMA DE CLASIFICACIÓN DE TRIAGE (RESOLUCIÓN 5596 DE 2015)
-- ============================================================================

-- 1. NIVELES DE TRIAGE OFICIALES (MINSALUD COLOMBIA)
INSERT OR REPLACE INTO niveles_triage (nivel, nombre, color, codigo_color, minutos_max, descripcion, editable) VALUES
(1, 'Triage I', 'Rojo', '#DC2626', 0, 'Atención inmediata. Paciente en riesgo vital inminente con alteración súbita de signos vitales o vía aérea.', 0),
(2, 'Triage II', 'Naranja', '#EA580C', 30, 'Atención oportuna, máximo 30 minutos. Condición que puede evolucionar rápidamente a deterioro hemodinámico o neurológico.', 0),
(3, 'Triage III', 'Amarillo', '#EAB308', 120, 'Paciente clínicamente estable que requiere exámenes diagnósticos, tratamiento oportuno o vigilancia clínica en urgencias.', 1),
(4, 'Triage IV', 'Verde', '#16A34A', 240, 'Condiciones médicas sin compromiso vital que presentan síntomas menores o molestias que no comprometen la vida.', 1),
(5, 'Triage V', 'Azul', '#2563EB', 360, 'Problema agudo o crónico sin evidencia de deterioro clínico ni riesgo vital agudo. Puede canalizarse a consulta prioritaria.', 1);

-- 2. CONFIGURACIÓN DEL SISTEMA
INSERT OR REPLACE INTO configuracion (clave, valor, descripcion) VALUES
('modo_emergencia', '0', 'Modo desastre o emergencia con múltiples víctimas: suspende temporalmente los límites de tiempo normativos'),
('nombre_institucion', 'Hospital Universitario Departamental - Cali', 'Nombre oficial de la institución prestadora de salud'),
('codigo_habilitacion', '760010000101', 'Código de habilitación en Registro Especial de Prestadores (REPS)');

-- 3. USUARIOS DEL SISTEMA POR ROL (Contraseñas semilla con cambio obligatorio en primer ingreso)
INSERT OR REPLACE INTO usuarios (id, nombre, documento, rol, password_hash, activo, debe_cambiar_password) VALUES
(1, 'Dra. Claudia Patricia Rivas', '1000', 'ADMIN', '$2b$10$nyLFYklo73Ssuy.bIy9vUec5pvOB6yM9k5vagXD3sIDB0xFpMUp/q', 1, 1),
(2, 'Jhonatan Alexander Gómez', '1001', 'ADMINISTRATIVO', '$2b$10$nyLFYklo73Ssuy.bIy9vUec5pvOB6yM9k5vagXD3sIDB0xFpMUp/q', 1, 1),
(3, 'Enf. Marcela Zuluaga Osorio', '1002', 'ENFERMERO', '$2b$10$6P0cMCbVl75TngPUHtIGrOTM5synf2MXi1BS96UFgqLM/OvKSx.om', 1, 1),
(4, 'Dr. Alejandro Restrepo Ruiz', '1003', 'MEDICO', '$2b$10$XtF1fmkPYtrF5DPosqBKh.haXj89RoBGXzMCk1HUjhSUqNoabpNra', 1, 1);

-- 4. PACIENTES DE EJEMPLO
INSERT OR REPLACE INTO pacientes (id, tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, sexo, telefono, direccion, eps, acudiente_nombre, acudiente_telefono) VALUES
(1, 'CC', '11440001', 'Carlos Mario', 'Restrepo Velez', '1968-05-14', 'M', '3104567890', 'Cra 56 # 14-32, Cali', 'Sura EPS', 'Marta Velez', '3157890123'),
(2, 'CC', '11440002', 'María Fernanda', 'Gómez Castro', '1985-09-21', 'F', '3128901234', 'Calle 5 # 38-19, Cali', 'Sanitas EPS', 'Roberto Gómez', '3189012345'),
(3, 'CC', '11440003', 'Juan David', 'Herrera Peña', '1999-12-03', 'M', '3156781234', 'Av. Pasoancho # 66-10, Cali', 'Nueva EPS', 'Patricia Peña', '3167894561'),
(4, 'TI', '10050004', 'Valentina', 'Caicedo Mina', '2009-03-15', 'F', '3187654321', 'Cra 1 # 44-55, Cali', 'Salud Total', 'Gloria Mina', '3187654322'),
(5, 'CC', '11440005', 'Andrés Felipe', 'Ospina Ramos', '1992-07-30', 'M', '3176543210', 'Calle 16 # 85-40, Cali', 'Coosalud', 'Luz Marina Ramos', '3176543211'),
(6, 'CC', '11440006', 'Laura Camila', 'Muñoz Pardo', '1996-11-18', 'F', '3145678901', 'Cra 80 # 10A-22, Cali', 'Emssanar', 'Carlos Muñoz', '3145678902'),
(7, 'CC', '11440007', 'Rosa Elena', 'Morales Benítez', '1955-02-09', 'F', '3134567892', 'Calle 9 # 42-15, Cali', 'Sura EPS', 'Héctor Morales', '3134567893'),
(8, 'CC', '11440008', 'Diego Armando', 'Ortiz Barona', '1980-08-25', 'M', '3112345678', 'Cra 42 # 5B-30, Cali', 'Nueva EPS', 'Sandra Barona', '3112345679'),
(9, 'CC', '11440009', 'Sofía Lorena', 'Martínez Díaz', '2001-04-12', 'F', '3161234567', 'Calle 25 # 98-14, Cali', 'Sanitas EPS', 'Hernando Martínez', '3161234568'),
(10, 'CC', '11440010', 'Pedro Pablo', 'Silva Cárdenas', '1974-10-05', 'M', '3198765432', 'Cra 15 # 33-88, Cali', 'Particular', 'Nidia Cárdenas', '3198765433');

-- 5. INGRESOS A URGENCIAS (Con diferentes estados y tiempos relativos)
-- Paciente 1: Triage I (Rojo) - Llegó hace 8 min, clasificado hace 5 min
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(1, 'URG-2026-0001', 1, datetime('now', 'localtime', '-8 minutes'), 'Dolor torácico opresivo de 30 min, irradiado a mandíbula y brazo izquierdo, disnea y diaforesis profusa.', 'Marta Velez (Esposa)', 'CLASIFICADO', 2);

-- Paciente 2: Triage II (Naranja) - Clasificado hace 18 minutos (Normal, máx 30 min)
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(2, 'URG-2026-0002', 2, datetime('now', 'localtime', '-25 minutes'), 'Cefalea súbita intensa "la peor de su vida" (10/10), vómito en escopetazo y fotofobia.', 'Roberto Gómez (Hermano)', 'CLASIFICADO', 2);

-- Paciente 3: Triage III (Amarillo) - Clasificado hace 50 minutos (Normal, máx 120 min)
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(3, 'URG-2026-0003', 3, datetime('now', 'localtime', '-65 minutes'), 'Dolor abdominal cólico en fosa ilíaca derecha de 14 horas, náuseas y alzas térmicas no cuantificadas.', 'Patricia Peña (Madre)', 'CLASIFICADO', 2);

-- Paciente 6: Triage III (Amarillo) - Clasificado hace 98 minutos (>75% de 120 min -> ALERTA POR VENCER)
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(6, 'URG-2026-0004', 6, datetime('now', 'localtime', '-110 minutes'), 'Trauma craneoencefálico leve tras colisión en motocicleta con casco, dolor cervical y episodio de amnesia.', 'Carlos Muñoz (Padre)', 'CLASIFICADO', 2);

-- Paciente 7: Triage III (Amarillo) - Clasificado hace 135 minutos (>100% de 120 min -> ALERTA VENCIDO)
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(7, 'URG-2026-0005', 7, datetime('now', 'localtime', '-150 minutes'), 'Dolor lumbar izquierdo irradiado a flanco e ingle de intensidad 9/10 tipo cólico, orina colúrica.', 'Héctor Morales (Hijo)', 'CLASIFICADO', 2);

-- Paciente 4: Triage IV (Verde) - Clasificado hace 40 minutos (Normal, máx 240 min)
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(4, 'URG-2026-0006', 4, datetime('now', 'localtime', '-55 minutes'), 'Trauma cerrado en tobillo derecho por torsión al practicar deporte, edema local y limitación para el apoyo.', 'Gloria Mina (Madre)', 'CLASIFICADO', 2);

-- Paciente 5: Triage V (Azul) - Clasificado hace 20 minutos (Normal, máx 360 min)
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(5, 'URG-2026-0007', 5, datetime('now', 'localtime', '-30 minutes'), 'Cuadro catarral de 4 días de evolución: rinorrea hialina, estornudos y tos seca sin fiebre ni disnea.', 'Solo', 'CLASIFICADO', 2);

-- Paciente 8: En Atención Médica
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por, fecha_inicio_atencion) VALUES
(8, 'URG-2026-0008', 8, datetime('now', 'localtime', '-80 minutes'), 'Crisis de broncoespasmo recurrente con sibilancias audibles y tirajes intercostales leves.', 'Sandra Barona (Esposa)', 'EN_ATENCION', 2, datetime('now', 'localtime', '-20 minutes'));

-- Pacientes 9 y 10: En espera de triage
INSERT OR REPLACE INTO ingresos (id, consecutivo, paciente_id, fecha_llegada, motivo_consulta, acompanante, estado, admisionado_por) VALUES
(9, 'URG-2026-0009', 9, datetime('now', 'localtime', '-15 minutes'), 'Sensación de taquicardia y mareo tras esfuerzo físico leve.', 'Hernando Martínez (Padre)', 'EN_ESPERA_TRIAGE', 2),
(10, 'URG-2026-0010', 10, datetime('now', 'localtime', '-5 minutes'), 'Herida en mano izquierda con borde filoso de vidrio, sangrado controlado con apósito.', 'Nidia Cárdenas (Esposa)', 'EN_ESPERA_TRIAGE', 2);

-- 6. VALORACIONES DE TRIAGE
-- Paciente 1: Nivel 1 (Rojo)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(1, 1, 1, 118, 28, 85, 55, 36.2, 89, 9, 'Alerta', 'Sospecha de Síndrome Coronario Agudo con compromiso hemodinámico. Se traslada a Reanimación de inmediato.', 3, datetime('now', 'localtime', '-5 minutes'));

-- Paciente 2: Nivel 2 (Naranja)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(2, 2, 2, 98, 20, 185, 110, 36.8, 97, 10, 'Alerta', 'Crisis hipertensiva con cefalea ictal aguda tipo thunderclap. Riesgo de evento cerebrovascular / hemorragia subaracnoidea.', 3, datetime('now', 'localtime', '-18 minutes'));

-- Paciente 3: Nivel 3 (Amarillo)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(3, 3, 3, 92, 18, 120, 75, 38.3, 98, 7, 'Alerta', 'Dolor en fosa ilíaca derecha con Blumberg y McBurney positivos. Requiere valoración por cirugía general y hemoleucograma.', 3, datetime('now', 'localtime', '-50 minutes'));

-- Paciente 6: Nivel 3 (Amarillo - Alerta por vencer)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(6, 6, 3, 84, 16, 125, 80, 36.6, 99, 6, 'Alerta', 'TCE leve, escala Glasgow 15/15. Pupilas isocóricas normorreactivas. Requiere radiografía cervical y observación.', 3, datetime('now', 'localtime', '-98 minutes'));

-- Paciente 7: Nivel 3 (Amarillo - Alerta vencido)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(7, 7, 3, 102, 19, 140, 90, 37.1, 98, 9, 'Alerta', 'Cólico nefrítico izquierdo agudo. Puñopercusión lumbar izquierda marcadamente positiva. Requiere analgesia endovenosa y uroanálisis.', 3, datetime('now', 'localtime', '-135 minutes'));

-- Paciente 4: Nivel 4 (Verde)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(4, 4, 4, 76, 16, 115, 70, 36.5, 99, 4, 'Alerta', 'Esguince grado I-II probable en tobillo derecho. Pulsos periféricos conservados, llenado capilar menor a 2 segundos.', 3, datetime('now', 'localtime', '-40 minutes'));

-- Paciente 5: Nivel 5 (Azul)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(5, 5, 5, 72, 14, 110, 70, 36.4, 99, 1, 'Alerta', 'Infección de vías respiratorias superiores alta, afebril, hemodinámicamente estable. Se orienta sobre consulta externa o prioritaria.', 3, datetime('now', 'localtime', '-20 minutes'));

-- Paciente 8: Nivel 2 (Naranja - En atención)
INSERT OR REPLACE INTO triage (id, ingreso_id, nivel, fc, fr, pas, pad, temperatura, spo2, dolor, estado_conciencia, observaciones, clasificado_por, fecha_clasificacion) VALUES
(8, 8, 2, 110, 26, 130, 85, 36.9, 91, 5, 'Alerta', 'Exacerbación de asma bronquial con tirajes leves. Requiere micronebulizaciones inmediatas con broncodilatador.', 3, datetime('now', 'localtime', '-45 minutes'));

-- 7. AUDITORÍA INICIAL
INSERT OR REPLACE INTO log_auditoria (id, usuario_id, accion, entidad, entidad_id, detalles) VALUES
(1, 1, 'SISTEMA_INICIALIZADO', 'SISTEMA', 1, 'Inicialización del sistema con Resolución 5596 de 2015 y carga de datos semilla.');

