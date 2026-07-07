-- Reestructurar tabla questions para tener skill_id FK, rol_objetivo y area_id

-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pregunta TEXT NOT NULL,
  descripcion TEXT,
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
  rol_objetivo TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'oculto', 'archivado')),
  tipo TEXT CHECK (tipo IN ('HARD', 'SOFT', 'COMENTARIO')),
  orden INTEGER DEFAULT 0,
  puntaje_minimo INTEGER DEFAULT 1,
  puntaje_maximo INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Agregar columnas si no existen (por si la tabla ya estaba creada parcialmente)
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS rol_objetivo TEXT,
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tipo TEXT CHECK (tipo IN ('HARD', 'SOFT', 'COMENTARIO')),
ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS puntaje_minimo INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS puntaje_maximo INTEGER DEFAULT 4;

-- 3. Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_questions_skill_id ON public.questions(skill_id);
CREATE INDEX IF NOT EXISTS idx_questions_area_id ON public.questions(area_id);
CREATE INDEX IF NOT EXISTS idx_questions_rol_objetivo ON public.questions(rol_objetivo);
CREATE INDEX IF NOT EXISTS idx_questions_estado ON public.questions(estado);
CREATE INDEX IF NOT EXISTS idx_questions_tipo ON public.questions(tipo);

-- 4. Dar permisos al anon role
GRANT ALL ON public.questions TO anon;
