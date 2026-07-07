-- Migración: Deshabilitar RLS para desarrollo
-- Descripción: Disabilita RLS en todas las tablas de admin para desarrollo
-- Ejecutar en: Supabase SQL Editor
-- NOTA: Esto es SOLO para desarrollo. En producción deben re-habilitarse con políticas apropiadas.

-- Deshabilitar RLS en todas las tablas administrativas
ALTER TABLE public.areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;

-- Comentario para recordar
COMMENT ON TABLE public.areas IS 'RLS DESHABILITADO para desarrollo. Re-habilitar antes de producción.';
