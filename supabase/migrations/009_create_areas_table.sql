-- Migración: Crear tabla de áreas
-- Descripción: Tabla normalizada de áreas/departamentos del sistema
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- TABLA: areas (Áreas/Departamentos)
-- ============================================

CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_areas_nombre ON public.areas(nombre);
CREATE INDEX IF NOT EXISTS idx_areas_activo ON public.areas(activo);

-- Comentarios
COMMENT ON TABLE public.areas IS 'Áreas/departamentos disponibles en el sistema';
COMMENT ON COLUMN public.areas.nombre IS 'Nombre único del área (ej: RRHH, Infraestructura, Marketing, Ventas)';
COMMENT ON COLUMN public.areas.descripcion IS 'Descripción opcional del área';
COMMENT ON COLUMN public.areas.activo IS 'Si el área está activa o archivada';

-- Insertar áreas predefinidas
INSERT INTO public.areas (nombre, descripcion, activo) 
VALUES 
  ('RRHH', 'Recursos Humanos', true),
  ('Infraestructura', 'Infraestructura y Sistemas', true),
  ('Marketing', 'Marketing y Comunicación', true),
  ('Ventas', 'Ventas y Comercial', true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- RLS Policies para areas
-- ============================================

-- Todos pueden ver áreas activas
DROP POLICY IF EXISTS "areas_select_active" ON public.areas;
CREATE POLICY "areas_select_active" ON public.areas
  FOR SELECT USING (activo = true);

-- Admin (RRHH o Director) pueden ver todas las áreas
DROP POLICY IF EXISTS "areas_select_all_admin" ON public.areas;
CREATE POLICY "areas_select_all_admin" ON public.areas
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- RRHH y Director (admin) pueden crear áreas
DROP POLICY IF EXISTS "areas_insert_admin" ON public.areas;
CREATE POLICY "areas_insert_admin" ON public.areas
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- RRHH y Director (admin) pueden editar áreas
DROP POLICY IF EXISTS "areas_update_admin" ON public.areas;
CREATE POLICY "areas_update_admin" ON public.areas
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- RRHH y Director (admin) pueden eliminar áreas
DROP POLICY IF EXISTS "areas_delete_admin" ON public.areas;
CREATE POLICY "areas_delete_admin" ON public.areas
  FOR DELETE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- Habilitar RLS
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
