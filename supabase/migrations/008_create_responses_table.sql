-- Migración: Crear tabla de respuestas evaluación
-- Descripción: Relaciona evaluaciones con preguntas específicas y sus puntajes
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- TABLA: responses (Respuestas de evaluación)
-- ============================================

CREATE TABLE IF NOT EXISTS public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  pregunta_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  puntaje INTEGER NOT NULL CHECK (puntaje >= 1 AND puntaje <= 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Asegurar que no haya duplicados: una pregunta por evaluación
  UNIQUE(evaluation_id, pregunta_id)
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_responses_evaluation_id ON public.responses(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_responses_pregunta_id ON public.responses(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_responses_puntaje ON public.responses(puntaje);

-- Comentarios
COMMENT ON TABLE public.responses IS 'Relaciona evaluaciones con preguntas específicas y sus puntajes';
COMMENT ON COLUMN public.responses.evaluation_id IS 'FK a evaluations - contexto de la evaluación';
COMMENT ON COLUMN public.responses.pregunta_id IS 'FK a questions - pregunta específica respondida';
COMMENT ON COLUMN public.responses.puntaje IS 'Puntuación 1-4 para esta pregunta';

-- ============================================
-- RLS Policies para questions
-- ============================================

-- Todos pueden ver preguntas activas
DROP POLICY IF EXISTS "questions_select_active" ON public.questions;
CREATE POLICY "questions_select_active" ON public.questions
  FOR SELECT USING (estado = 'activo');

-- Solo RRHH puede ver/editar todas (incluyendo archivadas y ocultas)
DROP POLICY IF EXISTS "questions_full_access_rrhh" ON public.questions;
CREATE POLICY "questions_full_access_rrhh" ON public.questions
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- RLS Policies para user_areas
-- ============================================

-- Todos pueden ver sus propias áreas
DROP POLICY IF EXISTS "user_areas_select_own" ON public.user_areas;
CREATE POLICY "user_areas_select_own" ON public.user_areas
  FOR SELECT USING (
    user_email = auth.jwt() ->> 'email' 
    OR
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- Solo RRHH puede insertar/actualizar/eliminar
DROP POLICY IF EXISTS "user_areas_manage_rrhh" ON public.user_areas;
CREATE POLICY "user_areas_manage_rrhh" ON public.user_areas
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- RLS Policies para responses
-- ============================================

-- RRHH puede ver todas las respuestas
DROP POLICY IF EXISTS "responses_rrhh_view_all" ON public.responses;
CREATE POLICY "responses_rrhh_view_all" ON public.responses
  FOR SELECT USING (
    (auth.jwt() ->> 'role')::text = 'RRHH'
  );

-- Director puede ver respuestas de su área
DROP POLICY IF EXISTS "responses_director_view_area" ON public.responses;
CREATE POLICY "responses_director_view_area" ON public.responses
  FOR SELECT USING (
    (auth.jwt() ->> 'role')::text = 'Director'
    AND evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE area = (SELECT area FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
    )
  );

-- Líder puede ver respuestas de su área
DROP POLICY IF EXISTS "responses_lider_view_area" ON public.responses;
CREATE POLICY "responses_lider_view_area" ON public.responses
  FOR SELECT USING (
    (auth.jwt() ->> 'role')::text = 'Lider'
    AND evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE area = (SELECT area FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
    )
  );

-- Analista solo ve sus propias respuestas
DROP POLICY IF EXISTS "responses_analista_view_own" ON public.responses;
CREATE POLICY "responses_analista_view_own" ON public.responses
  FOR SELECT USING (
    (auth.jwt() ->> 'role')::text = 'Analista'
    AND evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE evaluado_email = auth.jwt() ->> 'email'
    )
  );

-- Todos pueden insertar respuestas para sus propias evaluaciones
DROP POLICY IF EXISTS "responses_insert_own_evaluation" ON public.responses;
CREATE POLICY "responses_insert_own_evaluation" ON public.responses
  FOR INSERT WITH CHECK (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE evaluador_email = auth.jwt() ->> 'email'
    )
  );

-- Habilitar RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
