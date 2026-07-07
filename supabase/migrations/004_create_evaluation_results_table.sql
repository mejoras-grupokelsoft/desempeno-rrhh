-- Migración: Crear tabla de resultados finales
-- Descripción: Almacena los resultados finales de cada evaluación (promedio + seniority)
-- Ejecutar en: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.evaluation_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo TEXT NOT NULL,
  evaluado_email TEXT NOT NULL,
  evaluado_nombre TEXT NOT NULL,
  area TEXT NOT NULL,
  skill_nombre TEXT NOT NULL,
  skill_tipo TEXT NOT NULL CHECK (skill_tipo IN ('HARD', 'SOFT')),
  
  -- Puntajes individuales
  puntaje_auto NUMERIC(3,1),
  puntaje_jefe NUMERIC(3,1),
  puntaje_promedio NUMERIC(3,1),
  puntaje_esperado NUMERIC(3,1),
  
  -- Metadata
  seniority_inicial TEXT,
  seniority_alcanzado TEXT,
  estado TEXT CHECK (estado IN ('Cumple', 'No Cumple', 'Superó')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_results_evaluado_email ON public.evaluation_results(evaluado_email);
CREATE INDEX IF NOT EXISTS idx_results_periodo ON public.evaluation_results(periodo);
CREATE INDEX IF NOT EXISTS idx_results_area ON public.evaluation_results(area);
CREATE INDEX IF NOT EXISTS idx_results_skill_nombre ON public.evaluation_results(skill_nombre);

-- Comentarios
COMMENT ON TABLE public.evaluation_results IS 'Resultados consolidados de evaluaciones (promedios y seniority)';
COMMENT ON COLUMN public.evaluation_results.puntaje_promedio IS 'Promedio: (AUTO + JEFE) / 2';
