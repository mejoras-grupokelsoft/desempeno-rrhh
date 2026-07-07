// src/components/FormularioView.tsx
// Vista de formularios de evaluación.
// - Si el usuario lidera equipos → muestra la sección "Evaluar mi equipo"
// - Si el usuario es miembro de un equipo con autoevaluación → muestra "Mi autoevaluación"
// - Si tiene ambos → muestra tabs para alternar

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTeamAccess } from '../hooks/useTeamAccess';
import EvaluationFormAnalista from './forms/EvaluationFormAnalista';
import EvaluationFormLider from './forms/EvaluationFormLider';
import EvaluationHistory from './forms/EvaluationHistory';
import LeaderNotesPanel from './forms/LeaderNotesPanel';
import type { User } from '../types';

type Tab = 'autoeval' | 'equipo' | 'historial';
type EquipoSubTab = 'evaluar' | 'notas';

export default function FormularioView() {
  const { currentUser, users } = useApp();
  const { loading, error, shouldSelfEvaluate, shouldEvaluateTeam, memberEmailsToEvaluate, teamsAsLeader } = useTeamAccess(currentUser);
  const [tab, setTab] = useState<Tab>('autoeval');
  const [equipoSubTab, setEquipoSubTab] = useState<EquipoSubTab>('evaluar');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedMemberForNotes, setSelectedMemberForNotes] = useState<User | null>(null);

  if (!currentUser) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
        Error cargando configuración de equipos: {error}
      </div>
    );
  }

  // Usuarios que debo evaluar (resolviendo desde la lista de users del contexto)
  const membersToEvaluate = memberEmailsToEvaluate
    .map(email => users.find(u => u.email === email))
    .filter((u): u is NonNullable<typeof u> => u !== undefined);

  const noTieneNada = !shouldSelfEvaluate && !shouldEvaluateTeam;

  if (noTieneNada) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-700">Sin formularios pendientes</h3>
        <p className="text-stone-500 text-sm">
          No estás asignado a ningún equipo de evaluación todavía.
          Pedile a RRHH que te agregue a un equipo.
        </p>
      </div>
    );
  }

  // Determinar tab inicial correcto
  const initialTab: Tab = shouldSelfEvaluate ? 'autoeval' : shouldEvaluateTeam ? 'equipo' : 'historial';
  const activeTab = (shouldSelfEvaluate || shouldEvaluateTeam) ? tab : 'historial';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Formularios de Evaluación</h2>
        <p className="text-stone-500 text-sm mt-1">Período activo: {currentUser && '2024-S1'}</p>
      </div>

      {/* Tabs — siempre visible (historial para todos) */}
      <div className="flex gap-2 bg-stone-100 rounded-xl p-1 w-fit flex-wrap">
        {shouldSelfEvaluate && (
          <button
            onClick={() => setTab('autoeval')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'autoeval'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-stone-600 hover:text-slate-900'
            }`}
          >
            Mi Autoevaluación
          </button>
        )}
        {shouldEvaluateTeam && (
          <button
            onClick={() => setTab('equipo')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'equipo'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-stone-600 hover:text-slate-900'
            }`}
          >
            Evaluar mi equipo
            {membersToEvaluate.length > 0 && (
              <span className="ml-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {membersToEvaluate.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setTab('historial')}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'historial'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-stone-600 hover:text-slate-900'
          }`}
        >
          🗂 Historial
        </button>
      </div>

      {/* Info de equipos que lidero */}
      {shouldEvaluateTeam && activeTab === 'equipo' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">
            Equipos que liderás ({teamsAsLeader.length}):
          </p>
          <p className="text-sm text-blue-700">
            {teamsAsLeader.map(t => t.nombre).join(' · ')}
          </p>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {formError}
        </div>
      )}

      {/* Formulario activo */}
      {activeTab === 'autoeval' && shouldSelfEvaluate && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Mi Autoevaluación</h3>
          <p className="text-sm text-stone-500 mb-6">
            Respondé honestamente. Esta evaluación es confidencial y se combina con la de tu líder.
          </p>
          <EvaluationFormAnalista
            onSuccess={() => setFormError(null)}
            onError={setFormError}
          />
        </div>
      )}

      {activeTab === 'equipo' && shouldEvaluateTeam && (
        <div className="space-y-4">
          {/* Subtabs dentro de equipo */}
          <div className="flex gap-2 border-b border-stone-200 pb-0">
            <button
              onClick={() => setEquipoSubTab('evaluar')}
              className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-all -mb-px ${
                equipoSubTab === 'evaluar'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-stone-500 hover:text-slate-800'
              }`}
            >
              📋 Formulario
            </button>
            <button
              onClick={() => setEquipoSubTab('notas')}
              className={`px-5 py-2.5 font-semibold text-sm border-b-2 transition-all -mb-px ${
                equipoSubTab === 'notas'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-stone-500 hover:text-slate-800'
              }`}
            >
              📝 Notas del equipo
            </button>
          </div>

          {equipoSubTab === 'evaluar' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-1">Evaluar mi equipo</h3>
              <p className="text-sm text-stone-500 mb-6">
                Seleccioná una persona de tu equipo y completá la evaluación de desempeño.
              </p>
              <EvaluationFormLider
                eligibleMembers={membersToEvaluate}
                onSuccess={() => setFormError(null)}
                onError={setFormError}
                onMemberSelected={setSelectedMemberForNotes}
              />
            </div>
          )}

          {equipoSubTab === 'notas' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Notas del equipo</h3>
                  <p className="text-sm text-stone-500">Guardá observaciones, borradores o feedback sobre cada integrante.</p>
                </div>
              </div>
              <LeaderNotesPanel
                members={membersToEvaluate}
                initialMember={selectedMemberForNotes}
              />
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <EvaluationHistory />
        </div>
      )}
    </div>
  );
}
