-- Tabla de preguntas/skills configurables
-- Reemplaza la anterior hardcodeada y permite que admin configure las preguntas
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('HARD', 'SOFT')), -- HARD skills o SOFT skills
  area VARCHAR(50), -- NULL para preguntas globales (SOFT skills), sino específica del área
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'archivado', 'oculto')),
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Índices para búsquedas frecuentes
  UNIQUE(nombre, area, tipo) -- No permitir duplicados en mismo contexto
);

-- Índice para filtrar por área y tipo
CREATE INDEX IF NOT EXISTS idx_questions_area_tipo ON public.questions(area, tipo);
CREATE INDEX IF NOT EXISTS idx_questions_estado ON public.questions(estado);

-- Comentarios para documentación
COMMENT ON TABLE public.questions IS 'Preguntas/skills configurables para evaluaciones';
COMMENT ON COLUMN public.questions.area IS 'Null para preguntas globales (SOFT), sino código de área específica';
COMMENT ON COLUMN public.questions.estado IS 'activo=visible, archivado=oculto, oculto=temporalmente oculto';
COMMENT ON COLUMN public.questions.orden IS 'Para ordenar preguntas en UI';

-- Seed data: Preguntas globales por defecto (SOFT skills)
INSERT INTO public.questions (nombre, descripcion, tipo, area, estado, orden) VALUES
  ('Comunicación', 'Capacidad de expresarse claramente y escuchar activamente', 'SOFT', NULL, 'activo', 1),
  ('Trabajo en Equipo', 'Habilidad para colaborar y coordinarse con otros', 'SOFT', NULL, 'activo', 2),
  ('Resolución de Problemas', 'Capacidad de identificar, analizar y resolver problemas', 'SOFT', NULL, 'activo', 3),
  ('Liderazgo', 'Capacidad de guiar, motivar e inspirar a otros', 'SOFT', NULL, 'activo', 4),
  ('Adaptabilidad', 'Capacidad de adaptarse a cambios y nuevas situaciones', 'SOFT', NULL, 'activo', 5)
ON CONFLICT DO NOTHING;
