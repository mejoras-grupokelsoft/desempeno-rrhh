-- Migración: Crear tabla de plantillas de email editables
-- Descripción: Permite editar desde el panel de admin el asunto y el cuerpo (con placeholders)
--              de los emails de "reporte" (resultados de evaluación) y "recordatorio"
--              (evaluación pendiente de completar), sin tocar código.
-- Ejecutar en: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE CHECK (tipo IN ('reporte', 'recordatorio')),
  asunto TEXT NOT NULL,
  cuerpo_html TEXT NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN public.email_templates.tipo IS 'reporte = resultados de evaluación | recordatorio = evaluación pendiente';
COMMENT ON COLUMN public.email_templates.cuerpo_html IS 'HTML con placeholders tipo {{nombre}}; el header/footer con marca Kelsoft se agrega en código';

-- La app usa "soft auth" (sin JWT de Supabase) y opera siempre como anon, con RLS
-- deshabilitado en el resto de las tablas administrativas (ver migración 015/017).
-- RLS no se habilita por defecto en tablas nuevas, pero los GRANT son necesarios igual.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;

COMMENT ON TABLE public.email_templates IS 'Plantillas editables de email (asunto + cuerpo HTML con placeholders {{...}}). DEV: re-habilitar RLS antes de producción.';
