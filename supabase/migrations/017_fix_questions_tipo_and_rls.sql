-- Migración: Corregir CHECK constraint de tipo en questions y asegurar RLS deshabilitado
-- Problema: 
--   1. La migración 013 describía agregar COMENTARIO al tipo pero nunca lo hizo.
--   2. El CHECK constraint original solo permite 'HARD' y 'SOFT'.
--   3. Si RLS está habilitado sin sesión JWT real, los UPDATEs devuelven 0 filas (error 406).
-- Solución:
--   1. Reemplazar el CHECK para incluir 'COMENTARIO'.
--   2. Deshabilitar RLS en questions (y demás tablas admin) hasta tener auth de Supabase configurado.

-- ============================================
-- 1. ARREGLAR CHECK CONSTRAINT DE tipo
-- ============================================

-- Eliminar el CHECK constraint existente en tipo
ALTER TABLE public.questions 
  DROP CONSTRAINT IF EXISTS questions_tipo_check;

-- Recrear con los tres valores válidos
ALTER TABLE public.questions 
  ADD CONSTRAINT questions_tipo_check CHECK (tipo IN ('HARD', 'SOFT', 'COMENTARIO'));

-- ============================================
-- 2. DESHABILITAR RLS EN TODAS LAS TABLAS ADMIN
-- (ya se hizo en 015, pero repetir es idempotente y asegura consistencia)
-- ============================================

ALTER TABLE public.areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills_matrix DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses DISABLE ROW LEVEL SECURITY;

-- teams y team_members pueden no existir según la instancia
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teams') THEN
    EXECUTE 'ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_members') THEN
    EXECUTE 'ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================
-- NOTAS
-- ============================================
-- Para re-habilitar RLS en producción (cuando Supabase Auth esté configurado):
--   ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
--   -- (y así para todas las tablas)
-- Las políticas correctas ya están en 014_fix_rls_policies.sql
