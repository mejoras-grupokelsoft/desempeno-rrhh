-- Migración: Permisos completos para anon en desarrollo
-- Descripción: Deshabilita RLS en todas las tablas Y otorga permisos SELECT/INSERT/UPDATE/DELETE al rol anon.
--              La app usa "soft auth" (sin JWT de Supabase), por lo que opera siempre como anon.
-- Ejecutar en: Supabase SQL Editor
-- NOTA: SOLO para desarrollo. Antes de producción, re-habilitar RLS con políticas apropiadas.

-- ============================================
-- 1. DESHABILITAR RLS EN TODAS LAS TABLAS
-- ============================================
ALTER TABLE public.areas              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams              DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills_matrix      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses          DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. OTORGAR PERMISOS COMPLETOS AL ROL anon
--    (SELECT ya suele estar otorgado, pero lo incluimos por completitud)
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas              TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users              TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams              TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills_matrix      TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_results TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses          TO anon;

-- También para el rol authenticated (por si en algún punto se usa)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills_matrix      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses          TO authenticated;

-- ============================================
-- RECORDATORIO PARA PRODUCCIÓN
-- ============================================
COMMENT ON TABLE public.areas IS 'DEV: RLS deshabilitado. Re-habilitar antes de producción.';
COMMENT ON TABLE public.users IS 'DEV: RLS deshabilitado. Re-habilitar antes de producción.';
COMMENT ON TABLE public.questions IS 'DEV: RLS deshabilitado. Re-habilitar antes de producción.';
