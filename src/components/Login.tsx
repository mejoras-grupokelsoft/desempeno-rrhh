// src/components/Login.tsx
import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useApp } from '../context/AppContext';
import { sanitizeEmail, logger } from '../utils/sanitize';

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
  const { users, setCurrentUser, loading, error: apiError } = useApp();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [devEmail, setDevEmail] = useState<string>('');
  
  // Mostrar modo desarrollo siempre en localhost
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasGoogleClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Modo desarrollo bypass
  const handleDevLogin = () => {
    const email = sanitizeEmail(devEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresá un email válido.');
      return;
    }
    const user = users.find((u) => u.email.toLowerCase().trim() === email);
    
    if (user) {
      setCurrentUser(user);
    } else {
      setError(`Email "${email}" no encontrado en la base de datos.`);
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-stone-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-orange-200 max-w-md">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Error de Conexión</h2>
          <p className="text-stone-700 mb-4">{apiError}</p>
          <p className="text-sm text-stone-500">Verificá tu conexión y la URL del API en el archivo .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 w-full max-w-md">
        {/* Header con fondo destacado */}
        <div className="mb-8 bg-gradient-to-br from-orange-50 to-stone-50 p-6 rounded-xl border border-orange-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">Dashboard RRHH</h1>
              <p className="text-orange-700 text-sm font-semibold">Evaluación de Desempeño</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-stone-800 mb-3">
              Iniciar sesión con Google
            </label>
            
            <div className="flex justify-center">
              {!hasGoogleClientId ? (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl text-sm text-center">
                  <p className="font-semibold">Google OAuth no configurado</p>
                  <p className="text-xs mt-1">Falta la variable <code>VITE_GOOGLE_CLIENT_ID</code> en el archivo .env</p>
                </div>
              ) : isLoading ? (
                <div className="flex items-center gap-3 px-6 py-3 bg-stone-100 rounded-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                  <span className="text-stone-600 text-sm font-semibold">Verificando...</span>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  logo_alignment="left"
                />
              )}
            </div>
          </div>

          {error && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Modo Desarrollo (visible en localhost) */}
          {isDevelopment && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-bold text-yellow-900">Modo Desarrollo (Bypass OAuth)</p>
              </div>
              <p className="text-xs text-yellow-800 mb-3">
                Para saltear el error de Google OAuth, ingresá tu email registrado:
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDevLogin()}
                  placeholder="capital.humano@ejemplo.com"
                  className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                />
                <button
                  onClick={handleDevLogin}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Entrar
                </button>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                ⚠️ Esto solo funciona en desarrollo. Para usar Google OAuth, configurá los orígenes en Google Cloud Console.
              </p>
            </div>
          )}

          {/* Box de acceso restringido con colores acordes */}
          <div className="bg-gradient-to-br from-stone-50 to-orange-50 border border-stone-300 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 mb-1">Acceso Restringido</p>
                <p className="text-xs text-stone-700 leading-relaxed">
                  Solo personal autorizado puede acceder. Si no podés ingresar, contactá a RRHH.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
