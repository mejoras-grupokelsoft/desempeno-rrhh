// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase credentials missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

// Usuario de la app que se manda en cada request para el log de auditoría (ver migración 027).
// No es autenticación: solo deja registro de quién estaba logueado / a quién impersonaba.
let auditUser = '';
let auditImpersonating = '';

export function setAuditUser(email: string | null, impersonating: string | null = null) {
  auditUser = email ?? '';
  auditImpersonating = impersonating ?? '';
}

const auditFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (auditUser) headers.set('x-app-user', auditUser);
  if (auditImpersonating) headers.set('x-app-impersonating', auditImpersonating);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: auditFetch },
});
