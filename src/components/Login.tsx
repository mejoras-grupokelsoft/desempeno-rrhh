// src/components/Login.tsx
import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { sanitizeEmail, logger } from '../utils/sanitize';
import { supabase } from '../lib/supabaseClient';

interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

interface CredentialResponse {
  credential?: string;
  clientId?: string;
}

export default function Login() {
  const { users, evaluations, setCurrentUser, loading, error: apiError } = useApp();
  const { dark, toggle: toggleDark } = useTheme();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [devEmail, setDevEmail] = useState<string>('');
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  // QA: Modo pruebas habilitado en todos los entornos
  const isDevelopment = true;
  const isQA = !(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const hasGoogleClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Modo desarrollo bypass
  const handleDevLogin = () => {
    const emailInput = sanitizeEmail(devEmail);
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setError('Ingresá un email válido.');
      return;
    }
    const user = users.find((u) => u.email.toLowerCase().trim() === emailInput);
    
    if (user) {
      setCurrentUser(user);
    } else {
      // Modo testeo: si el email tiene evaluaciones, crear usuario temporal
      const tieneEvals = evaluations.some(e => e.evaluadoEmail.toLowerCase().trim() === emailInput);
      if (tieneEvals) {
        const firstEval = evaluations.find(e => e.evaluadoEmail.toLowerCase().trim() === emailInput)!;
        const nombre = firstEval.evaluadoNombre || emailInput;
        // Determinar rol según origen de evaluación
        const esLider = evaluations.some(e => e.evaluadorEmail?.toLowerCase().trim() === emailInput);
        const rol = esLider ? 'Lider' : 'Analista';
        setCurrentUser({
          email: emailInput,
          nombre,
          rol,
          area: firstEval.area || 'Sin área',
        });
      } else {
        setError(`Email "${emailInput}" no encontrado en la base de datos.`);
      }
    }
  };

  // Login con email + password
  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');

      const emailInput = sanitizeEmail(email);
      if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
        setError('Ingresá un email válido.');
        return;
      }

      if (!password || password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      // Autenticar con Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password,
      });

      if (authError) {
        setError(authError.message || 'Email o contraseña incorrectos.');
        return;
      }

      if (!data.user) {
        setError('No se pudo autenticar el usuario.');
        return;
      }

      // Buscar usuario en la whitelist
      const user = users.find((u) => u.email.toLowerCase().trim() === emailInput);
      if (user) {
        setCurrentUser(user);
      } else {
        setError(`Acceso denegado. El email "${emailInput}" no está autorizado en el sistema.`);
      }
    } catch (err: any) {
      setError('Error al autenticar. Intentá de nuevo.');
      logger.error('Email login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = (credentialResponse: CredentialResponse) => {
    try {
      setIsLoading(true);
      setError('');

      if (!credentialResponse.credential) {
        setError('No se recibió credencial de Google.');
        return;
      }

      // Decodificar el JWT de Google
      const decoded: GoogleUser = jwtDecode(credentialResponse.credential);
      const googleEmail = sanitizeEmail(decoded.email);

      if (!googleEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail)) {
        setError('El token de Google no contiene un email válido.');
        return;
      }

      // Buscar usuario en la whitelist
      const user = users.find((u) => u.email.toLowerCase().trim() === googleEmail);

      if (user) {
        setCurrentUser(user);
      } else {
        setError(`Acceso denegado. El email "${googleEmail}" no está autorizado en el sistema.`);
      }
    } catch {
      setError('Error al procesar la autenticación. Intentá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Error al autenticar con Google. Intentá de nuevo.');
    logger.error('Google Login Error');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="bg-brand-surface p-8 rounded-xl shadow-card border border-brand-border text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-indigo mx-auto" />
          <p className="mt-4 text-brand-t2 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4">
        <div className="bg-brand-surface p-8 rounded-xl shadow-card border border-red-200 dark:border-red-900 max-w-md w-full">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-brand-t1 mb-2">Error de Conexión</h2>
          <p className="text-brand-t2 text-sm mb-2">{apiError}</p>
          <p className="text-brand-t3 text-xs">Verificá tu conexión y la URL del API en el archivo .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">

      {/* ── Banner superior ─────────────────────────────────── */}
      <div className="w-full px-8 py-8 md:py-10" style={{ background: 'rgb(var(--clr-night))' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgb(var(--clr-indigo))' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-slate-400 text-sm font-medium">Grupo Kelsoft · Evaluación de Desempeño</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-snug tracking-tight">
            Tu crecimiento profesional, en tus manos.
          </h2>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed max-w-xl">
            Este espacio es tuyo. Acá vas a poder ver cómo estás, qué habilidades desarrollaste y hacia dónde podés crecer dentro de la empresa.
          </p>
          {/* Indicadores */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              { label: 'Autoevaluación + evaluación de tu líder', icon: '👤' },
              { label: 'Hard skills y soft skills', icon: '🎯' },
              { label: 'Período semestral', icon: '📅' },
              { label: '4 niveles de seniority', icon: '📈' },
            ].map(({ label, icon }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-300"
                style={{ background: 'rgb(51 65 85 / 0.6)' }}>
                <span>{icon}</span>{label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario centrado ──────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-10">

        {/* Theme toggle */}
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleDark}
            className="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-t2 hover:text-brand-t1 hover:bg-brand-surface2 transition-all shadow-card"
            title={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            {dark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        <div className="w-full max-w-[420px] space-y-8">

          {/* Título del formulario */}
          <div>
            <h1 className="text-2xl font-extrabold text-brand-t1 tracking-tight">Ingresá a tu cuenta</h1>
            <p className="mt-1 text-brand-t2 text-sm">Usá tu cuenta institucional para acceder.</p>
          </div>

          {/* Tabs auth */}
          <div className="flex gap-1 bg-brand-surface2 rounded-xl p-1">
            {(['google', 'email'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAuthMethod(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  authMethod === m
                    ? 'bg-brand-surface text-brand-t1 shadow-card'
                    : 'text-brand-t2 hover:text-brand-t1'
                }`}
              >
                {m === 'google' ? 'Google' : 'Email + Contraseña'}
              </button>
            ))}
          </div>

          {/* Google */}
          {authMethod === 'google' && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-brand-t1">Iniciá sesión con tu cuenta Google</p>
              <div className="flex justify-center">
                {!hasGoogleClientId ? (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl text-sm text-center w-full">
                    <p className="font-semibold">Google OAuth no configurado</p>
                    <p className="text-xs mt-1">Falta <code>VITE_GOOGLE_CLIENT_ID</code> en .env</p>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center gap-3 px-6 py-3 bg-brand-surface2 rounded-xl">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'rgb(var(--clr-indigo))' }} />
                    <span className="text-brand-t2 text-sm font-medium">Verificando...</span>
                  </div>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme={dark ? 'filled_black' : 'outline'}
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                    logo_alignment="left"
                  />
                )}
              </div>
            </div>
          )}

          {/* Email + Password */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-brand-t1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu.email@grupokelsoft.com"
                  className="w-full px-4 py-3 rounded-xl text-sm text-brand-t1 bg-brand-surface2 border border-brand-border placeholder:text-brand-t3 outline-none transition-all focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-brand-t1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-sm text-brand-t1 bg-brand-surface2 border border-brand-border placeholder:text-brand-t3 outline-none transition-all focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: isLoading ? undefined : 'rgb(var(--clr-indigo))' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgb(var(--clr-indigo-dk))')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgb(var(--clr-indigo))')}
              >
                {isLoading ? 'Autenticando...' : 'Ingresar'}
              </button>
            </form>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Dev quick access */}
          {isDevelopment && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Acceso Rápido — Dev</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Director', email: 'capital.humano@grupokelsoft.com', cls: 'bg-violet-600 hover:bg-violet-700' },
                  { label: 'Líder',    email: 'pamela.gomez@grupokelsoft.com',   cls: 'bg-blue-600 hover:bg-blue-700' },
                  { label: 'Analista', email: 'killa.roldan@grupokelsoft.com',   cls: 'bg-teal-600 hover:bg-teal-700' },
                ].map(({ label, email: devEmail, cls }) => {
                  const user = users.find(u => u.email === devEmail);
                  return (
                    <button
                      key={label}
                      onClick={() => user ? setCurrentUser(user) : setError(`${devEmail} no encontrado en BD.`)}
                      disabled={!user}
                      title={user ? `${user.nombre} · ${user.email}` : `${devEmail} no está en la BD`}
                      className={`py-2 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${cls}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acceso restringido */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-brand-surface border border-brand-border">
            <svg className="w-4 h-4 text-brand-t3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-brand-t2 leading-relaxed">
              <span className="font-semibold text-brand-t1">Acceso restringido.</span>{' '}
              Solo personal autorizado. Si no podés ingresar, contactá a RRHH.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
