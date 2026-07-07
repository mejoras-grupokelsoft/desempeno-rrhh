-- Migración: Agregar columnas de reset de contraseña
-- Descripción: Permitir que admin resete contraseñas de usuarios
-- Ejecutar en: Supabase SQL Editor

-- ============================================
-- Agregar columnas para password reset
-- ============================================

ALTER TABLE public.users ADD COLUMN password_reset_token TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN password_reset_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN last_password_change TIMESTAMP WITH TIME ZONE;

-- Índice para búsquedas rápidas de tokens de reset
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON public.users(password_reset_token);

-- Comentarios
COMMENT ON COLUMN public.users.password_reset_token IS 'Token temporal para reset de contraseña (generado por admin)';
COMMENT ON COLUMN public.users.password_reset_expires IS 'Fecha de expiración del token de reset';
COMMENT ON COLUMN public.users.last_password_change IS 'Última vez que se cambió la contraseña';
