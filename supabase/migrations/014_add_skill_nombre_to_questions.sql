-- Migración: Agregar skill_nombre a questions para vincular con skills_matrix
-- Descripción:
--   Permite relacionar cada pregunta del formulario de evaluación con
--   una habilidad específica de la tabla skills_matrix.
--   Esto habilita que los gráficos de radar sepan qué puntajes mapear
--   a qué skill esperado por seniority.
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- ACTUALIZAR: tabla questions
-- ============================================

ALTER TABLE IF EXISTS public.questions
ADD COLUMN IF NOT EXISTS skill_nombre TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN public.questions.skill_nombre IS 
  'Nombre de la habilidad en skills_matrix a la que mapea esta pregunta. '
  'Permite relacionar respuestas de evaluación con valores esperados por seniority. '
  'Debe coincidir con skill_nombre de la tabla skills_matrix para el área correspondiente.';

-- Índice para búsquedas por skill
CREATE INDEX IF NOT EXISTS idx_questions_skill_nombre ON public.questions(skill_nombre);

-- ============================================
-- NOTAS DE IMPLEMENTACIÓN
-- ============================================
-- Cuando un analista responde la pregunta "Gestión de campañas" (Marketing),
-- el sistema busca en skills_matrix donde:
--   skill_nombre = questions.skill_nombre
--   area = evaluacion.area
--   seniority = seniority del evaluado
-- para obtener el valor_esperado y graficarlo como pentágono de referencia.
