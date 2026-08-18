-- Migración: Agregar "puesto" a users
-- Descripción: Desacopla el puesto/posición real (ej: "Líder Técnico", "Desarrollador")
--              del rol de acceso (RRHH/Director/Lider/Analista) y de quién evalúa a quién
--              (eso ya lo define teams.leader_email). El puesto sirve para filtrar qué
--              preguntas (questions.rol_objetivo) le corresponden a cada persona.
-- Ejecutar en: Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS puesto TEXT;

CREATE INDEX IF NOT EXISTS idx_users_puesto ON public.users(puesto);

COMMENT ON COLUMN public.users.puesto IS 'Puesto/posición real de la persona (ej: "Líder Técnico", "Desarrollador"). Independiente del rol de acceso y de quién la evalúa. Si es NULL, se usa el fallback LIDER/ANALISTA según users.rol.';
