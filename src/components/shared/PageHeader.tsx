// src/components/shared/PageHeader.tsx
import React from 'react';
import type { User } from '../../types';

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
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
