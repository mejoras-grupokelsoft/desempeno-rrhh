-- Agregar columna tipo a la tabla questions
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS tipo TEXT CHECK (tipo IN ('HARD', 'SOFT', 'COMENTARIO'));

-- Agregar columna orden para ordenamiento de preguntas
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;

-- Agregar columnas de puntaje si no existen
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS puntaje_minimo INTEGER DEFAULT 1;

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS puntaje_maximo INTEGER DEFAULT 4;

-- Crear índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_questions_tipo ON public.questions(tipo);

-- Dar permisos al anon role
GRANT ALL ON public.questions TO anon;
