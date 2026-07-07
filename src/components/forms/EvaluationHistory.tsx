// src/components/forms/EvaluationHistory.tsx
import { useState, useEffect } from 'react';
import { fetchEvaluationHistory, type EvaluationWithResponses } from '../../lib/supabaseQueries';
import { useApp } from '../../context/AppContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function avgScore(responses: EvaluationWithResponses['responses'], tipo?: 'HARD' | 'SOFT') {
  const filtered = tipo ? responses.filter(r => r.skill_tipo === tipo) : responses;
  if (!filtered.length) return null;
  return (filtered.reduce((s, r) => s + r.puntaje, 0) / filtered.length).toFixed(2);
}

const SCORE_COLORS: Record<number, string> = { 1: 'bg-red-100 text-red-700', 2: 'bg-yellow-100 text-yellow-700', 3: 'bg-blue-100 text-blue-700', 4: 'bg-green-100 text-green-700' };

export default function EvaluationHistory() {
  const { currentUser } = useApp();
  const [history, setHistory] = useState<EvaluationWithResponses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<'ALL' | 'AUTO' | 'JEFE'>('ALL');

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    fetchEvaluationHistory(currentUser.email)
      .then(setHistory)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser) return null;

  const filtered = history.filter(e => filterTipo === 'ALL' || e.tipo_evaluador === filterTipo);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-xl">🗂</span> Historial de Evaluaciones
        </h3>
        <div className="flex gap-2">
          {(['ALL', 'AUTO', 'JEFE'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterTipo(t)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterTipo === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'ALL' ? 'Todas' : t === 'AUTO' ? 'Autoevaluaciones' : 'Evaluaciones del jefe'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-stone-500 text-sm py-4 text-center">Cargando historial...</p>}
      {error && <p className="text-red-600 text-sm">❌ {error}</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-8 text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
          <p className="text-2xl mb-2">📋</p>
          <p className="font-semibold">No hay evaluaciones registradas</p>
          <p className="text-sm">Completá tu primera evaluación usando el formulario de arriba.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(ev => {
          const isOwn = ev.evaluado_email === currentUser.email;
          const isSelf = ev.tipo_evaluador === 'AUTO';
          const isOpen = openId === ev.id;
          const hardAvg = avgScore(ev.responses, 'HARD');
          const softAvg = avgScore(ev.responses, 'SOFT');
          const totalAvg = avgScore(ev.responses);

          return (
            <div key={ev.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Header clickeable */}
              <button
                onClick={() => setOpenId(isOpen ? null : ev.id)}
                className="w-full text-left p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isSelf ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {isSelf ? '👤' : '⭐'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {isSelf
                        ? `Autoevaluación — ${ev.evaluado_nombre}`
                        : isOwn
                          ? `Evaluado por ${ev.evaluador_email}`
                          : `Evaluaste a ${ev.evaluado_nombre}`
                      }
                    </p>
                    <p className="text-xs text-stone-500">{ev.periodo} · {formatDate(ev.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {totalAvg ? (
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      Prom: {totalAvg}
                    </span>
                  ) : ev.puntaje != null && ev.skill_nombre !== 'general' ? (
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      Puntaje: {ev.puntaje}
                    </span>
                  ) : null}
                  <span className="text-stone-400 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
              </button>

              {/* Detalle expandible */}
              {isOpen && (
                <div className="border-t border-stone-100 p-4 space-y-4 bg-slate-50">
                  {/* Resumen de promedios — cuando hay respuestas individuales */}
                  {ev.responses.length > 0 && (
                    <div className="flex gap-3 flex-wrap">
                      {hardAvg && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-blue-500 font-semibold">Hard Skills</p>
                          <p className="text-xl font-bold text-blue-700">{hardAvg}</p>
                        </div>
                      )}
                      {softAvg && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-purple-500 font-semibold">Soft Skills</p>
                          <p className="text-xl font-bold text-purple-700">{softAvg}</p>
                        </div>
                      )}
                      {totalAvg && (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-green-500 font-semibold">Promedio total</p>
                          <p className="text-xl font-bold text-green-700">{totalAvg}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fallback: sin respuestas individuales → mostrar puntaje global */}
                  {ev.responses.length === 0 && (
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-stone-500 mb-2">Puntaje registrado</p>
                      {ev.puntaje != null && ev.skill_nombre !== 'general' ? (
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${SCORE_COLORS[ev.puntaje] || 'bg-gray-100 text-gray-600'}`}>
                            {ev.puntaje}
                          </span>
                          <span className="text-sm text-slate-700 font-medium">{ev.skill_nombre}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">Esta evaluación no tiene detalle de preguntas individuales</p>
                      )}
                    </div>
                  )}

                  {/* Respuestas individuales */}
                  {['HARD', 'SOFT'].map(tipo => {
                    const qs = ev.responses.filter(r => r.skill_tipo === tipo);
                    if (!qs.length) return null;
                    return (
                      <div key={tipo}>
                        <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">
                          {tipo === 'HARD' ? '🔧 Hard Skills' : '💬 Soft Skills'}
                        </p>
                        <div className="space-y-1">
                          {qs.map(r => (
                            <div key={r.pregunta_id} className="flex items-center justify-between gap-2 py-1 px-2 bg-white rounded-lg border border-stone-100">
                              <p className="text-sm text-slate-700 flex-1 truncate" title={r.pregunta_nombre}>{r.pregunta_nombre}</p>
                              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${SCORE_COLORS[r.puntaje] || 'bg-gray-100 text-gray-600'}`}>
                                {r.puntaje}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {ev.comentario && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-amber-600 mb-1">💬 Comentario</p>
                      <p className="text-sm text-slate-700 italic">"{ev.comentario}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
