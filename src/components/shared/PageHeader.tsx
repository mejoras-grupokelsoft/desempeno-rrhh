// src/components/shared/PageHeader.tsx
import React from 'react';
import type { User } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  currentUser?: User;
  onLogout?: () => void;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  currentUser,
  onLogout,
  children,
}: PageHeaderProps) {
  const { dark, toggle: toggleDark } = useTheme();

  return (
    <div className="bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
            {(subtitle || currentUser) && (
              <p className="text-stone-600">
                {subtitle ??
                  `${currentUser!.nombre} • ${currentUser!.rol} • ${currentUser!.area}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle tema */}
            <button
              onClick={toggleDark}
              className="w-9 h-9 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center text-stone-500 hover:text-slate-800 transition-all"
              title={dark ? 'Modo claro' : 'Modo oscuro'}
            >
              {dark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Cerrar Sesión
                </span>
              </button>
            )}
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
