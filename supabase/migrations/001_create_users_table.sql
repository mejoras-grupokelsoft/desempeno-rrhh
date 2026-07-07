-- Migración: Crear tabla de usuarios (whitelist)
-- Descripción: Almacena los usuarios autorizados del sistema
-- Ejecutar en: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('RRHH', 'Director', 'Lider', 'Analista')),
  area TEXT,
  foto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas por email (rápidas)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_area ON public.users(area);
CREATE INDEX IF NOT EXISTS idx_users_rol ON public.users(rol);

-- Comentarios
COMMENT ON TABLE public.users IS 'Whitelist de usuarios autorizados del sistema';
COMMENT ON COLUMN public.users.email IS 'Email corporativo único (identificador)';
COMMENT ON COLUMN public.users.rol IS 'Rol del usuario: RRHH, Director, Lider, o Analista';
COMMENT ON COLUMN public.users.area IS 'Área/departamento del usuario';
