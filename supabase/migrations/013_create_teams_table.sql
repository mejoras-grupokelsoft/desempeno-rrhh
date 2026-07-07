-- Migración: Crear tabla de Teams/Equipos
-- Descripción: Equipos dentro de áreas con líderes asignados
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- TABLA: teams (Equipos/Departamentos)
-- ============================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE RESTRICT,
  leader_email TEXT NOT NULL REFERENCES public.users(email) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(nombre, area_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_teams_area_id ON public.teams(area_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_email ON public.teams(leader_email);
CREATE INDEX IF NOT EXISTS idx_teams_activo ON public.teams(activo);

-- Comentarios
COMMENT ON TABLE public.teams IS 'Equipos dentro de áreas con líderes asignados';
COMMENT ON COLUMN public.teams.nombre IS 'Nombre del equipo (ej: Equipo A, Back-end, etc)';
COMMENT ON COLUMN public.teams.area_id IS 'FK a areas - área a la que pertenece el equipo';
COMMENT ON COLUMN public.teams.leader_email IS 'FK a users - email del líder del equipo';

-- ============================================
-- TABLA: team_members (Miembros de Equipos)
-- ============================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  receives_evaluation_from_leader BOOLEAN DEFAULT true,
  performs_self_evaluation BOOLEAN DEFAULT true,
  can_evaluate_peers BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_email ON public.team_members(user_email);

-- Comentarios
COMMENT ON TABLE public.team_members IS 'Miembros de equipos y sus permisos de evaluación';
COMMENT ON COLUMN public.team_members.receives_evaluation_from_leader IS 'Si recibe evaluación del líder del equipo';
COMMENT ON COLUMN public.team_members.performs_self_evaluation IS 'Si realiza autoevaluación';
COMMENT ON COLUMN public.team_members.can_evaluate_peers IS 'Si puede evaluar a otros miembros del equipo';

-- ============================================
-- RLS Policies para teams
-- ============================================

-- Todos pueden ver teams activos
DROP POLICY IF EXISTS "teams_select_active" ON public.teams;
CREATE POLICY "teams_select_active" ON public.teams
  FOR SELECT USING (activo = true);

-- Admin (RRHH o Director) pueden ver todos
DROP POLICY IF EXISTS "teams_select_all_admin" ON public.teams;
CREATE POLICY "teams_select_all_admin" ON public.teams
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- Solo RRHH puede crear/editar/eliminar teams
DROP POLICY IF EXISTS "teams_manage_rrhh" ON public.teams;
CREATE POLICY "teams_manage_rrhh" ON public.teams
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- ============================================
-- RLS Policies para team_members
-- ============================================

-- Todos pueden ver sus propios miembros del equipo
DROP POLICY IF EXISTS "team_members_select_own" ON public.team_members;
CREATE POLICY "team_members_select_own" ON public.team_members
  FOR SELECT USING (
    team_id IN (
      SELECT id FROM public.teams WHERE leader_email = auth.jwt() ->> 'email'
    )
    OR
    user_email = auth.jwt() ->> 'email'
    OR
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol IN ('RRHH', 'Director')
    )
  );

-- Solo RRHH puede crear/editar/eliminar miembros
DROP POLICY IF EXISTS "team_members_manage_rrhh" ON public.team_members;
CREATE POLICY "team_members_manage_rrhh" ON public.team_members
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM public.users WHERE rol = 'RRHH'
    )
  );

-- Habilitar RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
