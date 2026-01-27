// src/context/AppContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Evaluation, SkillMatrix, ApiResponse } from '../types';

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

  // Sincronizar currentUser cuando cambian los datos de usuarios
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const updatedUser = users.find(u => u.email === currentUser.email);
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        // Usuario encontrado con datos actualizados
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
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
      console.error('❌ Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFromStorage = () => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setCurrentUser(user);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  };

  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

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
        logout,
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
