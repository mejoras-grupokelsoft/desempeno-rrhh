-- Migración: Actualizar users para usar FK a areas
-- Descripción: Cambiar area de TEXT a UUID con referencia a tabla areas
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- Agregar columna area_id (nueva)
-- ============================================

ALTER TABLE public.users ADD COLUMN area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;

-- Migrar datos existentes (mapear área por nombre)
UPDATE public.users u 
SET area_id = (SELECT id FROM public.areas a WHERE a.nombre = u.area LIMIT 1)
WHERE u.area IS NOT NULL;

-- Asegurar que todos tengan un área asignada (si están en la whitelist, deben tener área)
-- Nota: Se permite NULL para casos especiales, pero se recomienda siempre asignar
-- UPDATE public.users SET area_id = (SELECT id FROM public.areas WHERE nombre = 'RRHH' LIMIT 1) WHERE area_id IS NULL;

-- Eliminar columna area antigua (solo después de verificar migración exitosa)
-- ALTER TABLE public.users DROP COLUMN area;

-- Si se confirma la migración, renombrar:
-- ALTER TABLE public.users RENAME COLUMN area_id TO area;

COMMENT ON COLUMN public.users.area_id IS 'FK a areas - área/departamento del usuario';
