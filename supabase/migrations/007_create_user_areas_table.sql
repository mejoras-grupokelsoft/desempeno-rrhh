-- Tabla de relación usuario-área
-- Permite asignar usuarios a múltiples áreas si es necesario
CREATE TABLE IF NOT EXISTS public.user_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  area VARCHAR(50) NOT NULL,
  rol_en_area VARCHAR(50), -- 'Lider', 'Miembro', etc. para contexto futuro
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Asegurar que no haya duplicados
  UNIQUE(user_email, area)
);

CREATE INDEX IF NOT EXISTS idx_user_areas_email ON public.user_areas(user_email);
CREATE INDEX IF NOT EXISTS idx_user_areas_area ON public.user_areas(area);

COMMENT ON TABLE public.user_areas IS 'Relación N:N entre usuarios y áreas';
COMMENT ON COLUMN public.user_areas.area IS 'Código del área (IT, Ventas, HR, etc.)';
COMMENT ON COLUMN public.user_areas.rol_en_area IS 'Rol específico del usuario en esa área';
