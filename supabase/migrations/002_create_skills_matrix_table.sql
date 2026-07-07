-- Migración: Crear tabla de matriz de skills esperados
-- Descripción: Define qué puntaje se espera para cada skill según seniority
-- Ejecutar en: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.skills_matrix (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seniority TEXT NOT NULL CHECK (seniority IN ('Trainee', 'Junior', 'Semi Senior', 'Senior', 'Lead')),
  skill_nombre TEXT NOT NULL,
  skill_tipo TEXT NOT NULL CHECK (skill_tipo IN ('HARD', 'SOFT')),
  valor_esperado NUMERIC(3,1) NOT NULL CHECK (valor_esperado >= 1 AND valor_esperado <= 5),
  area TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_skills_matrix_seniority ON public.skills_matrix(seniority);
CREATE INDEX IF NOT EXISTS idx_skills_matrix_skill_tipo ON public.skills_matrix(skill_tipo);
CREATE INDEX IF NOT EXISTS idx_skills_matrix_area ON public.skills_matrix(area);

-- Comentarios
COMMENT ON TABLE public.skills_matrix IS 'Define los puntajes esperados por seniority y skill';
COMMENT ON COLUMN public.skills_matrix.valor_esperado IS 'Puntaje esperado (1-5)';
