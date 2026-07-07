-- Migración: Corregir RLS Policies para incluir WITH CHECK en UPDATE/INSERT
-- Descripción: Agregar WITH CHECK clause a políticas de INSERT/UPDATE para que funcionen correctamente
-- Ejecutar en: Supabase SQL Editor
-- IMPORTANTE: Si ya ejecutaste 009-013, ejecuta esta ahora para corregir los permisos de UPDATE

-- ============================================
-- CORREGIR POLICIES PARA areas
-- ============================================

-- Reemplazar la política genérica por INSERT específico
DROP POLICY IF EXISTS "areas_manage_rrhh" ON public.areas;
DROP POLICY IF EXISTS "areas_insert_rrhh" ON public.areas;
DROP POLICY IF EXISTS "areas_update_rrhh" ON public.areas;
DROP POLICY IF EXISTS "areas_delete_rrhh" ON public.areas;

-- Política INSERT
CREATE POLICY "areas_insert_rrhh" ON public.areas
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- Política UPDATE (la más importante para tu caso)
CREATE POLICY "areas_update_rrhh" ON public.areas
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- Política DELETE
CREATE POLICY "areas_delete_rrhh" ON public.areas
  FOR DELETE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- CORREGIR POLICIES PARA users
-- ============================================

DROP POLICY IF EXISTS "users_update_rrhh" ON public.users;
DROP POLICY IF EXISTS "users_insert_rrhh" ON public.users;
CREATE POLICY "users_update_rrhh" ON public.users
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- CORREGIR POLICIES PARA questions
-- ============================================

DROP POLICY IF EXISTS "questions_full_access_rrhh" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_update_rrhh" ON public.questions;
DROP POLICY IF EXISTS "questions_update_rrhh" ON public.questions;
CREATE POLICY "questions_insert_update_rrhh" ON public.questions
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

CREATE POLICY "questions_update_rrhh" ON public.questions
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- CORREGIR POLICIES PARA teams
-- ============================================

DROP POLICY IF EXISTS "teams_manage_rrhh" ON public.teams;
DROP POLICY IF EXISTS "teams_insert_rrhh" ON public.teams;
DROP POLICY IF EXISTS "teams_update_rrhh" ON public.teams;
CREATE POLICY "teams_insert_rrhh" ON public.teams
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

CREATE POLICY "teams_update_rrhh" ON public.teams
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- CORREGIR POLICIES PARA team_members
-- ============================================

DROP POLICY IF EXISTS "team_members_manage_rrhh" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_rrhh" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_rrhh" ON public.team_members;
CREATE POLICY "team_members_insert_rrhh" ON public.team_members
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

CREATE POLICY "team_members_update_rrhh" ON public.team_members
  FOR UPDATE USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  ) WITH CHECK (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );
