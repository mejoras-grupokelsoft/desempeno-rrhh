-- Migración: Habilitar Row Level Security (RLS)
-- Descripción: Define permisos por rol
-- Ejecutar en: Supabase SQL Editor

-- ==================== TABLA: users ====================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RRHH puede ver todos los usuarios
DROP POLICY IF EXISTS "RRHH can view all users" ON public.users;
CREATE POLICY "RRHH can view all users"
ON public.users FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'RRHH'
  OR auth.jwt() ->> 'email' = email
);

-- Todos los usuarios pueden ver su propio perfil
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
USING (auth.jwt() ->> 'email' = email);

-- ==================== TABLA: evaluations ====================
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- RRHH puede ver todas las evaluaciones
DROP POLICY IF EXISTS "RRHH can view all evaluations" ON public.evaluations;
CREATE POLICY "RRHH can view all evaluations"
ON public.evaluations FOR SELECT
USING ((auth.jwt() ->> 'role')::text = 'RRHH');

-- Director puede ver evaluaciones de su área
DROP POLICY IF EXISTS "Director can view evaluations in their area" ON public.evaluations;
CREATE POLICY "Director can view evaluations in their area"
ON public.evaluations FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'Director'
  AND area = (SELECT area FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
);

-- Líder puede ver evaluaciones de su área
DROP POLICY IF EXISTS "Lider can view evaluations in their area" ON public.evaluations;
CREATE POLICY "Lider can view evaluations in their area"
ON public.evaluations FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'Lider'
  AND area = (SELECT area FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
);

-- Analista/Usuario solo ve sus propias evaluaciones
DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.evaluations;
CREATE POLICY "Users can view their own evaluations"
ON public.evaluations FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'Analista'
  AND evaluado_email = auth.jwt() ->> 'email'
);

-- Todos pueden insertar sus propias evaluaciones
DROP POLICY IF EXISTS "Users can insert their own evaluations" ON public.evaluations;
CREATE POLICY "Users can insert their own evaluations"
ON public.evaluations FOR INSERT
WITH CHECK (
  evaluador_email = auth.jwt() ->> 'email'
);

-- ==================== TABLA: skills_matrix ====================
ALTER TABLE public.skills_matrix ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer la matriz de skills
DROP POLICY IF EXISTS "Everyone can view skills matrix" ON public.skills_matrix;
CREATE POLICY "Everyone can view skills matrix"
ON public.skills_matrix FOR SELECT
USING (true);

-- ==================== TABLA: evaluation_results ====================
ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;

-- RRHH puede ver todos los resultados
DROP POLICY IF EXISTS "RRHH can view all results" ON public.evaluation_results;
CREATE POLICY "RRHH can view all results"
ON public.evaluation_results FOR SELECT
USING ((auth.jwt() ->> 'role')::text = 'RRHH');

-- Director puede ver resultados de su área
DROP POLICY IF EXISTS "Director can view results in their area" ON public.evaluation_results;
CREATE POLICY "Director can view results in their area"
ON public.evaluation_results FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'Director'
  AND area = (SELECT area FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
);

-- Líder puede ver resultados de su área
DROP POLICY IF EXISTS "Lider can view results in their area" ON public.evaluation_results;
CREATE POLICY "Lider can view results in their area"
ON public.evaluation_results FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'Lider'
  AND area = (SELECT area FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
);

-- Analista ve solo sus resultados
DROP POLICY IF EXISTS "Users can view their own results" ON public.evaluation_results;
CREATE POLICY "Users can view their own results"
ON public.evaluation_results FOR SELECT
USING (
  (auth.jwt() ->> 'role')::text = 'Analista'
  AND evaluado_email = auth.jwt() ->> 'email'
);
