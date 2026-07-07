-- Crear tabla skills (maestro de habilidades)
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('HARD', 'SOFT')),
  area TEXT, -- NULL para soft skills globales
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'oculto', 'archivado')),
  orden INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Índices para queries rápidas
  UNIQUE(nombre, tipo, area)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_skills_tipo ON public.skills(tipo);
CREATE INDEX IF NOT EXISTS idx_skills_area ON public.skills(area);
CREATE INDEX IF NOT EXISTS idx_skills_estado ON public.skills(estado);

-- Agregar columna skill_id a questions (para vincular pregunta → skill)
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL;

-- Crear índice para la relación
CREATE INDEX IF NOT EXISTS idx_questions_skill_id ON public.questions(skill_id);

-- Insert initial SOFT skills (globales, area = NULL)
INSERT INTO public.skills (nombre, tipo, area, descripcion, estado, orden) VALUES
  ('Comunicación', 'SOFT', NULL, 'Capacidad de expresar ideas de forma clara y escuchar efectivamente', 'activo', 1),
  ('Trabajo en Equipo', 'SOFT', NULL, 'Colaboración efectiva con otros miembros del equipo', 'activo', 2),
  ('Resolución de Problemas', 'SOFT', NULL, 'Capacidad de identificar y resolver problemas complejos', 'activo', 3),
  ('Liderazgo', 'SOFT', NULL, 'Capacidad de guiar y motivar a otros', 'activo', 4),
  ('Adaptabilidad', 'SOFT', NULL, 'Flexibilidad para adaptarse a cambios y nuevos desafíos', 'activo', 5),
  ('Gestión del Tiempo', 'SOFT', NULL, 'Organización y priorización efectiva de tareas', 'activo', 6),
  ('Pensamiento Crítico', 'SOFT', NULL, 'Análisis profundo y toma de decisiones fundamentadas', 'activo', 7),
  ('Proactividad', 'SOFT', NULL, 'Iniciativa y capacidad de anticipar necesidades', 'activo', 8)
ON CONFLICT (nombre, tipo, area) DO NOTHING;

-- Feedback
SELECT 'Skills table created successfully' as status;
