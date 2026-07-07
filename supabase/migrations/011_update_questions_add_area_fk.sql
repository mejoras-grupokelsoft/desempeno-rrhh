-- Migración: Actualizar questions para usar FK a areas
-- Descripción: Cambiar area de TEXT a UUID con referencia a tabla areas
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- Agregar columna area_id (nueva)
-- ============================================

ALTER TABLE public.questions ADD COLUMN area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;

-- Migrar datos existentes (mapear área por nombre)
UPDATE public.questions q 
SET area_id = (SELECT id FROM public.areas a WHERE a.nombre = q.area LIMIT 1)
WHERE q.area IS NOT NULL;

-- Comentario
COMMENT ON COLUMN public.questions.area_id IS 'FK a areas - área asociada (NULL = pregunta global)';

-- Nota: Eliminar columna area antigua solo después de verificar:
-- ALTER TABLE public.questions DROP COLUMN area;
-- ALTER TABLE public.questions RENAME COLUMN area_id TO area;
