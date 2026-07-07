-- Migración: Agregar estructura jerárquica a áreas
-- Descripción: Permite sub-áreas y asignar líder a cada área
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- AGREGAR COLUMNAS A areas PARA JERARQUÍA
-- ============================================

ALTER TABLE public.areas 
  ADD COLUMN IF NOT EXISTS parent_area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lider_email TEXT REFERENCES public.users(email) ON DELETE SET NULL;

-- Crear índices para búsquedas jerárquicas
CREATE INDEX IF NOT EXISTS idx_areas_parent_area_id ON public.areas(parent_area_id);
CREATE INDEX IF NOT EXISTS idx_areas_lider_email ON public.areas(lider_email);

-- Comentarios
COMMENT ON COLUMN public.areas.parent_area_id IS 'Área padre (NULL = área raíz). Permite crear sub-áreas.';
COMMENT ON COLUMN public.areas.lider_email IS 'Líder/responsable de esta área específica';

-- ============================================
-- EJEMPLO: DATOS JERÁRQUICOS
-- ============================================

-- Primero, obtener los IDs de las áreas existentes (estos ya existen)
-- INSERT INTO public.areas (nombre, descripcion, activo) 
-- VALUES 
--   ('Reclutamiento', 'Reclutamiento y selección de personal', true),
--   ('Comunicaciones', 'Comunicación interna y externa', true),
--   ('Plan de Carrera', 'Desarrollo de carrera de empleados', true)
-- ON CONFLICT (nombre) DO NOTHING;

-- Actualizar RRHH como área raíz (parent_area_id = NULL)
-- UPDATE public.areas SET parent_area_id = NULL WHERE nombre = 'RRHH';

-- Actualizar sub-áreas para que tengan parent_area_id = RRHH.id
-- UPDATE public.areas 
-- SET parent_area_id = (SELECT id FROM public.areas WHERE nombre = 'RRHH' LIMIT 1)
-- WHERE nombre IN ('Reclutamiento', 'Comunicaciones', 'Plan de Carrera');

-- ============================================
-- COMENTARIO IMPORTANTE
-- ============================================

-- IMPORTANTE: Las migraciones anteriores (009-015) ya crearon la estructura básica.
-- Si ejecutas esto, se agregan las columnas para jerarquía.
-- Luego, desde el panel de admin, podrás:
-- 1. Crear sub-áreas (seleccionar área padre)
-- 2. Asignar líder a cada área
-- 3. Ver árbol jerárquico de áreas
