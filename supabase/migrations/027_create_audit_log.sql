-- 027_create_audit_log.sql
-- Log de auditoría: registra TODO insert/update/delete en las tablas de negocio,
-- venga de la app, del SQL Editor, de un script con service role o de la anon key.
-- No cambia RLS ni permisos de las tablas existentes: solo agrega triggers que insertan en audit_log.
--
-- "Quién" se toma de dos fuentes (las dos quedan guardadas):
--   * jwt_email   → email del JWT de Supabase Auth (confiable, pero hoy no siempre hay sesión Supabase)
--   * app_user    → header x-app-user que manda el front con el usuario logueado (útil, pero falsificable
--                   mientras RLS siga abierto — ver plan de RLS)
--   * db_role     → rol de Postgres: anon / authenticated / service_role / postgres (SQL Editor)

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  table_name   TEXT        NOT NULL,
  operation    TEXT        NOT NULL,            -- INSERT | UPDATE | DELETE
  record_id    TEXT,
  old_data     JSONB,
  new_data     JSONB,
  changed_cols TEXT[],                          -- solo en UPDATE: columnas que cambiaron
  db_role      TEXT,
  jwt_email    TEXT,
  app_user     TEXT,
  app_impersonating TEXT,                     -- si RRHH/Director estaba "viendo como" otra persona
  client_ip    TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_record_idx ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_log_app_user_idx ON public.audit_log (app_user);

-- Nadie desde la API puede leer, editar ni borrar el log: solo lo escribe el trigger (SECURITY DEFINER).
-- Se consulta desde el SQL Editor.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old     JSONB;
  v_new     JSONB;
  v_headers JSONB;
  v_claims  JSONB;
  v_changed TEXT[];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(n.key) INTO v_changed
    FROM jsonb_each(v_new) n
    WHERE v_old -> n.key IS DISTINCT FROM n.value;
    -- UPDATE sin cambios reales: no ensuciar el log
    IF v_changed IS NULL THEN RETURN NULL; END IF;
  END IF;

  -- Fuera de PostgREST (SQL Editor, pg directo) estos settings no existen → NULL
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_claims  := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := NULL; v_claims := NULL;
  END;

  INSERT INTO public.audit_log
    (table_name, operation, record_id, old_data, new_data, changed_cols,
     db_role, jwt_email, app_user, app_impersonating, client_ip, user_agent)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(v_new, v_old) ->> 'id',
    v_old,
    v_new,
    v_changed,
    COALESCE(v_claims ->> 'role', current_user),
    v_claims ->> 'email',
    v_headers ->> 'x-app-user',
    v_headers ->> 'x-app-impersonating',
    split_part(v_headers ->> 'x-forwarded-for', ',', 1),
    v_headers ->> 'user-agent'
  );

  RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora
END;
$$;

REVOKE ALL ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

-- Enganchar el trigger en todas las tablas de negocio que existan
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'user_areas', 'areas', 'teams', 'team_members',
    'evaluations', 'responses', 'evaluation_results', 'leader_notes',
    'questions', 'skills', 'skills_matrix', 'email_templates'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t);
    END IF;
  END LOOP;
END $$;

-- Consultas útiles (SQL Editor):
--   Últimos cambios:            SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100;
--   Historia de una persona:    SELECT * FROM audit_log WHERE table_name = 'users' AND
--                                 (new_data->>'email' = 'x@grupokelsoft.com' OR old_data->>'email' = 'x@grupokelsoft.com')
--                                 ORDER BY created_at;
--   Qué hizo un usuario:        SELECT * FROM audit_log WHERE app_user = 'x@grupokelsoft.com' ORDER BY created_at DESC;
--   Borrados:                   SELECT * FROM audit_log WHERE operation = 'DELETE' ORDER BY created_at DESC;
