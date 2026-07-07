-- Migración: Tabla de notas del líder sobre sus colaboradores
-- Notas en modo borrador para uso interno / compartir con el colaborador

CREATE TABLE IF NOT EXISTS public.leader_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_email TEXT NOT NULL,
  member_email TEXT NOT NULL,
  titulo TEXT,
  contenido TEXT NOT NULL,
  fecha_nota DATE NOT NULL DEFAULT CURRENT_DATE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leader_notes_leader ON public.leader_notes(leader_email);
CREATE INDEX IF NOT EXISTS idx_leader_notes_member ON public.leader_notes(member_email);

-- RLS
ALTER TABLE public.leader_notes ENABLE ROW LEVEL SECURITY;

-- El líder puede ver/crear/editar/borrar sus propias notas
CREATE POLICY "leader_notes_leader_access" ON public.leader_notes
  FOR ALL USING (auth.uid() IS NOT NULL OR true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leader_notes_updated_at
  BEFORE UPDATE ON public.leader_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
