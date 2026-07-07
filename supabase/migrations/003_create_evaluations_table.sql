-- Migración: Crear tabla de evaluaciones
-- Descripción: Almacena todas las evaluaciones (AUTO y JEFE)
-- Ejecutar en: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo TEXT NOT NULL,
  evaluado_email TEXT NOT NULL,
  evaluado_nombre TEXT NOT NULL,
  evaluador_email TEXT NOT NULL,
  tipo_evaluador TEXT NOT NULL CHECK (tipo_evaluador IN ('AUTO', 'JEFE')),
  skill_nombre TEXT NOT NULL,
  skill_tipo TEXT NOT NULL CHECK (skill_tipo IN ('HARD', 'SOFT')),
  puntaje INTEGER NOT NULL CHECK (puntaje >= 1 AND puntaje <= 4),
  area TEXT NOT NULL,
  comentario TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluado_email ON public.evaluations(evaluado_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluador_email ON public.evaluations(evaluador_email);
CREATE INDEX IF NOT EXISTS idx_evaluations_periodo ON public.evaluations(periodo);
CREATE INDEX IF NOT EXISTS idx_evaluations_tipo_evaluador ON public.evaluations(tipo_evaluador);
CREATE INDEX IF NOT EXISTS idx_evaluations_area ON public.evaluations(area);
CREATE INDEX IF NOT EXISTS idx_evaluations_skill_nombre ON public.evaluations(skill_nombre);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON public.evaluations(created_at);

-- Comentarios
COMMENT ON TABLE public.evaluations IS 'Almacena todas las evaluaciones de desempeño (AUTO y JEFE)';
COMMENT ON COLUMN public.evaluations.periodo IS 'Período de evaluación (ej: 2024-S1, 2024-S2)';
COMMENT ON COLUMN public.evaluations.tipo_evaluador IS 'AUTO = autoevaluación, JEFE = evaluación del líder';
COMMENT ON COLUMN public.evaluations.puntaje IS 'Puntuación (1-4)';
