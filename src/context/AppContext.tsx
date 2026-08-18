import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, Evaluation, SkillMatrix } from '../types';
import { logger } from '../utils/sanitize';
import { fetchUsers, fetchAllEvaluations, fetchSkillsMatrix } from '../lib/supabaseQueries';
import { adaptEvaluations, adaptSkillsMatrix } from '../lib/adapters';
import { supabase } from '../lib/supabaseClient';

// ── Constantes de sesión ──────────────────────────────────────────────
const SESSION_KEY = 'currentUser';
const SESSION_TS_KEY = 'sessionTs';
const DEFAULT_DISPLAY_PERIODO = '2026-S2'; // Período actual para display

/** Limpia todos los datos de sesión del localStorage */
function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
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
  currentPeriodo: string;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  refetch: () => Promise<void>;
  /** Usuario realmente logueado (RRHH/Director). Difiere de currentUser mientras se está impersonando. */
  realUser: User | null;
  /** true mientras un RRHH/Director está viendo la app como otro usuario */
  isImpersonating: boolean;
  /** Empezar a ver la app como otro usuario (solo lectura: no se pueden guardar evaluaciones) */
  startImpersonation: (user: User) => void;
  /** Volver a la sesión real */
  stopImpersonation: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [skillsMatrix, setSkillsMatrix] = useState<SkillMatrix[]>([]);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = impersonatedUser ?? loggedInUser;

  // Cargar datos de Supabase al montar
  useEffect(() => {
    fetchData();
    loadUserFromStorage();

    // Escuchar cambios de sesión de Supabase Auth
    // Esto es lo que permite que RLS funcione: cuando hay sesión real, el JWT se adjunta automáticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // Si Supabase cierra sesión, limpiar también el localStorage
        clearSession();
        setLoggedInUser(null);
        setImpersonatedUser(null);
      }
      // Si hay sesión, no hacemos nada extra — el usuario ya quedó seteado por handleSetCurrentUser
    });

    return () => subscription.unsubscribe();
  }, []);

  // Validar usuario logueado contra whitelist cuando llegan datos de Supabase
  useEffect(() => {
    if (loggedInUser && users.length > 0) {
      const updatedUser = users.find(
        u => u.email.toLowerCase().trim() === loggedInUser.email.toLowerCase().trim()
      );

      if (!updatedUser) {
        // Usuario fue removido de la BD → cerrar sesión
        logger.warn('Usuario almacenado no encontrado en whitelist, cerrando sesión');
        handleLogout();
        return;
      }

      if (JSON.stringify(updatedUser) !== JSON.stringify(loggedInUser)) {
        // Datos actualizados (rol, area, puesto, etc.)
        setLoggedInUser(updatedUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
      }
    }
  }, [users]);

  // Mantener al usuario impersonado sincronizado con la whitelist (sin persistir en localStorage)
  useEffect(() => {
    if (impersonatedUser && users.length > 0) {
      const updatedUser = users.find(
        u => u.email.toLowerCase().trim() === impersonatedUser.email.toLowerCase().trim()
      );
      if (!updatedUser) {
        setImpersonatedUser(null);
        return;
      }
      if (JSON.stringify(updatedUser) !== JSON.stringify(impersonatedUser)) {
        setImpersonatedUser(updatedUser);
      }
    }
  }, [users]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch desde Supabase
      const usersData = await fetchUsers();
      const evaluationsDataRaw = await fetchAllEvaluations();
      const skillsMatrixDataRaw = await fetchSkillsMatrix();
      
      // Adaptar datos de Supabase a formato interno (camelCase)
      const evaluationsData = adaptEvaluations(evaluationsDataRaw);
      const skillsMatrixData = adaptSkillsMatrix(skillsMatrixDataRaw);
      
      setUsers(usersData);
      setEvaluations(evaluationsData);
      setSkillsMatrix(skillsMatrixData);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar datos desde Supabase';
      setError(message);
      logger.error('Error fetching data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFromStorage = () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const user: User = JSON.parse(stored);
        // Validación básica de estructura
        if (user.email && user.nombre && user.rol) {
          setLoggedInUser(user);
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      }
    }
  };

  const handleSetCurrentUser = (user: User | null) => {
    setLoggedInUser(user);
    setImpersonatedUser(null); // un login nuevo siempre arranca sin impersonación activa
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
    }
  };

  const handleLogout = useCallback(() => {
    setLoggedInUser(null);
    setImpersonatedUser(null);
    supabase.auth.signOut(); // Cierra sesión en Supabase Auth → invalida el JWT → RLS queda activo
  }, []);

  const startImpersonation = useCallback((user: User) => {
    if (!loggedInUser || (loggedInUser.rol !== 'RRHH' && loggedInUser.rol !== 'Director')) {
      logger.warn('Solo RRHH/Director pueden impersonar usuarios');
      return;
    }
    setImpersonatedUser(user);
  }, [loggedInUser]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
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
        currentPeriodo: DEFAULT_DISPLAY_PERIODO,
        setCurrentUser: handleSetCurrentUser,
        logout: handleLogout,
        refetch: fetchData,
        realUser: loggedInUser,
        isImpersonating: impersonatedUser !== null,
        startImpersonation,
        stopImpersonation,
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
