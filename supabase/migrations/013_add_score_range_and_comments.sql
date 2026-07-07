-- Migración: Agregar rango de puntaje configurable y comentarios
-- Descripción: 
--   1. Agrega columnas puntaje_minimo y puntaje_maximo a questions
--   2. Agrega tipo COMENTARIO a las preguntas
--   3. Agrega columna de comentarios a responses

-- ============================================
-- ACTUALIZAR: tabla questions
-- ============================================

-- Agregar columnas de rango de puntaje
ALTER TABLE IF EXISTS public.questions
ADD COLUMN IF NOT EXISTS puntaje_minimo INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS puntaje_maximo INTEGER DEFAULT 4;

-- Comentarios
COMMENT ON COLUMN public.questions.puntaje_minimo IS 'Puntaje mínimo para esta pregunta (solo para HARD/SOFT)';
COMMENT ON COLUMN public.questions.puntaje_maximo IS 'Puntaje máximo para esta pregunta (solo para HARD/SOFT)';

-- ============================================
-- ACTUALIZAR: tabla responses (si existe)
-- ============================================

-- Agregar columna de comentarios opcionales
ALTER TABLE IF EXISTS public.responses
ADD COLUMN IF NOT EXISTS comentario TEXT,
ADD COLUMN IF NOT EXISTS es_comentario BOOLEAN DEFAULT FALSE;

-- Comentarios
COMMENT ON COLUMN public.responses.comentario IS 'Comentario de texto libre (para preguntas tipo COMENTARIO)';
COMMENT ON COLUMN public.responses.es_comentario IS 'Indica si esta respuesta es un comentario de texto en lugar de puntaje numérico';

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_responses_es_comentario ON public.responses(es_comentario);

-- ============================================
-- NOTAS DE SEGURIDAD
-- ============================================
-- Los comentarios estarán protegidos por RLS según el rol del evaluador
-- RRHH: puede ver todos los comentarios
-- Director/Líder: puede ver comentarios de su área
-- Analista: puede ver comentarios de sus propias evaluaciones (si se comparten)
