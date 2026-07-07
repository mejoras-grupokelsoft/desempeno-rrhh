import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import AdminQuestionsPanel from './AdminQuestionsPanel';
import AdminSkillsPanel from './AdminSkillsPanel';
import AdminUsersPanel from './AdminUsersPanel';
import AdminAreasPanel from './AdminAreasPanel';
import AdminTeamsPanel from './AdminTeamsPanel';
import AdminSeedPanel from './AdminSeedPanel';
import AdminDataImport from './AdminDataImport';

type AdminTab = 'questions' | 'skills' | 'users' | 'areas' | 'teams' | 'seed' | 'import';

export default function AdminDashboard() {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('questions');

  // Solo RRHH o Director pueden acceder
  if (currentUser?.rol !== 'RRHH' && currentUser?.rol !== 'Director') {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          ❌ Acceso denegado. Solo administradores (RRHH/Director) pueden acceder a este panel.
        </div>
      </div>
    );
  }

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'questions', label: '📋 Preguntas' },
    { key: 'skills', label: '⭐ Habilidades' },
    { key: 'users', label: '👥 Usuarios' },
    { key: 'areas', label: '🏢 Áreas' },
    { key: 'teams', label: '👨‍💼 Equipos' },
    // { key: 'seed', label: '🌱 Datos de Prueba' },
    // { key: 'import', label: '📊 Importar Datos' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-brand-surface rounded-2xl shadow-card border border-brand-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgb(var(--clr-indigo))' }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-brand-t1 tracking-tight">Configuraciones</h1>
          <p className="text-xs text-brand-t3">Administración del sistema · Solo RRHH / Director</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-1 mb-6 bg-brand-surface2 rounded-xl p-1 flex-wrap">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-brand-surface text-brand-t1 shadow-card'
                : 'text-brand-t2 hover:text-brand-t1'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        {activeTab === 'questions' && <AdminQuestionsPanel />}
        {activeTab === 'skills' && <AdminSkillsPanel />}
        {activeTab === 'users' && <AdminUsersPanel />}
        {activeTab === 'areas' && <AdminAreasPanel />}
        {activeTab === 'teams' && <AdminTeamsPanel />}
        {/* {activeTab === 'seed' && <AdminSeedPanel />} */}
        {/* {activeTab === 'import' && <AdminDataImport />} */}
      </div>
    </div>
  );
}
