// src/context/AppContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, Evaluation, SkillMatrix, ApiResponse, UserRole } from '../types';
import { logger } from '../utils/sanitize';
import { googleLogout } from '@react-oauth/google';

// ── Constantes de sesión ──────────────────────────────────────────────
const SESSION_KEY = 'currentUser';
const SESSION_TS_KEY = 'sessionTimestamp';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/** Verifica si la sesión almacenada expiró */
function isSessionExpired(): boolean {
  const ts = localStorage.getItem(SESSION_TS_KEY);
  if (!ts) return true;
  return Date.now() - Number(ts) > SESSION_TTL_MS;
}

/** Limpia todos los datos de sesión del localStorage */
function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TS_KEY);
  localStorage.removeItem('lastSelectedEmail');
  localStorage.removeItem('lastSelectedArea');
  sessionStorage.clear();
}

interface AppContextType {
  users: User[];
  evaluations: Evaluation[];
  skillsMatrix: SkillMatrix[];
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [skillsMatrix, setSkillsMatrix] = useState<SkillMatrix[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos del API al montar
  useEffect(() => {
    fetchData();
    loadUserFromStorage();
  }, []);

  // Validar usuario almacenado contra whitelist cuando llegan datos del API
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const updatedUser = users.find(
        u => u.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
      );

      if (!updatedUser) {
        // Usuario fue removido de la BD → cerrar sesión
        logger.warn('Usuario almacenado no encontrado en whitelist, cerrando sesión');
        handleLogout();
        return;
      }

      if (JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        // Datos actualizados (rol, area, nombre, etc.)
        setCurrentUser(updatedUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
      }
    }
  }, [users]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
      
      if (!apiUrl) {
        throw new Error('VITE_GOOGLE_SCRIPT_URL no está configurada en .env');
      }

      // Agregar timestamp para evitar caché de Google Apps Script
      const cacheBuster = `?t=${Date.now()}`;
      const fullUrl = apiUrl + cacheBuster;

      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      if (data.error) {
        throw new Error(data.message || 'Error desconocido del servidor');
      }

      // Limpiar espacios extras en roles y áreas
      const cleanedUsers = (data.users || []).map(u => ({
        ...u,
        rol: u.rol.trim() as UserRole,
        area: u.area.trim()
      }));
      
      setUsers(cleanedUsers);
      setEvaluations(data.evaluations || []);
      setSkillsMatrix(data.skills_matrix || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar datos';
      setError(message);
      logger.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFromStorage = () => {
    // Verificar expiración de sesión (24h TTL)
    if (isSessionExpired()) {
      clearSession();
      return;
    }

    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const user: User = JSON.parse(stored);
        // Validación básica de estructura
        if (user.email && user.nombre && user.rol) {
          setCurrentUser(user);
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      }
    }
  };

  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
    }
  };

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    clearSession();
    // Revocar sesión de Google OAuth
    try { googleLogout(); } catch { /* silently ignore */ }
  }, []);

  return (
    <AppContext.Provider
      value={{
        users,
        evaluations,
        skillsMatrix,
        currentUser,
        loading,
        error,
        setCurrentUser: handleSetCurrentUser,
        logout: handleLogout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
