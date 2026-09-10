// src/components/forms/EvaluationHistory.tsx
import { useState, useEffect, useMemo } from 'react';
import { fetchEvaluationHistory, type EvaluationWithResponses } from '../../lib/supabaseQueries';
import { useApp } from '../../context/AppContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SCORE_COLORS: Record<number, string> = { 1: 'bg-red-100 text-red-700', 2: 'bg-yellow-100 text-yellow-700', 3: 'bg-blue-100 text-blue-700', 4: 'bg-green-100 text-green-700' };

function scoreColorForAvg(avg: number) {
  const rounded = Math.round(avg);
  return SCORE_COLORS[rounded] || 'bg-gray-100 text-gray-600';
}

function fmtScore(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

interface SkillGroup {
  skill_nombre: string;
  promedio: number;
  cantidad: number;
}

function groupBySkill(responses: EvaluationWithResponses['responses'], tipo: 'HARD' | 'SOFT'): SkillGroup[] {
  const map = new Map<string, number[]>();
  responses.filter(r => r.skill_tipo === tipo).forEach(r => {
    if (!map.has(r.skill_nombre)) map.set(r.skill_nombre, []);
    map.get(r.skill_nombre)!.push(r.puntaje);
  });
  return Array.from(map.entries()).map(([skill_nombre, puntajes]) => ({
    skill_nombre,
    promedio: puntajes.reduce((a, b) => a + b, 0) / puntajes.length,
    cantidad: puntajes.length,
  })).sort((a, b) => b.promedio - a.promedio);
}

interface CombinedSkillRow {
  skill_nombre: string;
  auto: number | null;
  jefe: number | null;
  promedio: number | null;
}

function combineSkillRows(autoEv: EvaluationWithResponses | undefined, jefeEv: EvaluationWithResponses | undefined, tipo: 'HARD' | 'SOFT'): CombinedSkillRow[] {
  const autoSkills = autoEv ? groupBySkill(autoEv.responses, tipo) : [];
  const jefeSkills = jefeEv ? groupBySkill(jefeEv.responses, tipo) : [];
  const names = new Set([...autoSkills.map(s => s.skill_nombre), ...jefeSkills.map(s => s.skill_nombre)]);
  return Array.from(names).map(name => {
    const a = autoSkills.find(s => s.skill_nombre === name) || null;
    const j = jefeSkills.find(s => s.skill_nombre === name) || null;
    // Misma regla que calculations.ts: el puntaje del líder es un techo — si la
    // autoevaluación es más generosa que la del líder, el promedio no puede superarlo.
    const promedio = a && j ? Math.min((a.promedio + j.promedio) / 2, j.promedio) : null;
    return { skill_nombre: name, auto: a?.promedio ?? null, jefe: j?.promedio ?? null, promedio };
  }).sort((x, y) => (y.promedio ?? y.auto ?? y.jefe ?? 0) - (x.promedio ?? x.auto ?? x.jefe ?? 0));
}

interface EvalGroup {
  key: string;
  evaluado_email: string;
  evaluado_nombre: string;
  periodo: string;
  isOwn: boolean;
  autoEval?: EvaluationWithResponses;
  jefeEval?: EvaluationWithResponses;
  latestCreatedAt: string;
}

function buildGroups(history: EvaluationWithResponses[], currentUserEmail: string): EvalGroup[] {
  const groups = new Map<string, EvalGroup>();
  for (const ev of history) {
    const key = `${ev.evaluado_email}|${ev.periodo}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        evaluado_email: ev.evaluado_email,
        evaluado_nombre: ev.evaluado_nombre,
        periodo: ev.periodo,
        isOwn: ev.evaluado_email === currentUserEmail,
        latestCreatedAt: ev.created_at,
      };
      groups.set(key, g);
    }
    if (ev.tipo_evaluador === 'AUTO') g.autoEval = ev;
    else g.jefeEval = ev;
    if (new Date(ev.created_at) > new Date(g.latestCreatedAt)) g.latestCreatedAt = ev.created_at;
  }
  return Array.from(groups.values()).sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
}

interface EvaluationHistoryProps {
  /** Emails de los miembros de mi equipo, para incluir también sus autoevaluaciones */
  teamMemberEmails?: string[];
}

export default function EvaluationHistory({ teamMemberEmails = [] }: EvaluationHistoryProps) {
  const { currentUser } = useApp();
  const [history, setHistory] = useState<EvaluationWithResponses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'MIO' | 'EQUIPO'>('ALL');

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    fetchEvaluationHistory(currentUser.email, teamMemberEmails)
      .then(setHistory)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentUser, teamMemberEmails.join(',')]);

  const groups = useMemo(
    () => (currentUser ? buildGroups(history, currentUser.email) : []),
    [history, currentUser]
  );

  if (!currentUser) return null;

  const hasEquipo = teamMemberEmails.length > 0;
  const filtered = groups.filter(g => {
    if (filter === 'MIO') return g.isOwn;
    if (filter === 'EQUIPO') return !g.isOwn;
    return true;
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-xl">🗂</span> Historial de Evaluaciones
        </h3>
        {hasEquipo && (
          <div className="flex gap-2">
            {(['ALL', 'MIO', 'EQUIPO'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  filter === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'ALL' ? 'Todas' : t === 'MIO' ? 'Mi autoevaluación' : 'Mi equipo'}
              </button>
            ))}
          </div>
        )}
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
        {filtered.map(g => {
          const isOpen = openKey === g.key;
          const hardRows = combineSkillRows(g.autoEval, g.jefeEval, 'HARD');
          const softRows = combineSkillRows(g.autoEval, g.jefeEval, 'SOFT');
          const totalConPromedio = [...hardRows, ...softRows].filter(r => r.promedio != null);
          const promedioGeneral = totalConPromedio.length > 0
            ? totalConPromedio.reduce((s, r) => s + (r.promedio || 0), 0) / totalConPromedio.length
            : null;

          return (
            <div key={g.key} className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Header clickeable */}
              <button
                onClick={() => setOpenKey(isOpen ? null : g.key)}
                className="w-full text-left p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${g.isOwn ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {g.isOwn ? '👤' : '⭐'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {g.isOwn ? 'Mi autoevaluación' : g.evaluado_nombre}
                    </p>
                    <p className="text-xs text-stone-500">{g.periodo} · {formatDate(g.latestCreatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!g.isOwn && promedioGeneral != null ? (
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                      Prom: {promedioGeneral.toFixed(2)}
                    </span>
                  ) : !g.isOwn && !g.autoEval ? (
                    <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">
                      Falta autoevaluación
                    </span>
                  ) : !g.isOwn && !g.jefeEval ? (
                    <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">
                      Falta tu evaluación
                    </span>
                  ) : null}
                  <span className="text-stone-400 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
              </button>

              {/* Detalle expandible */}
              {isOpen && (
                <div className="border-t border-stone-100 p-4 space-y-4 bg-slate-50">
                  {g.isOwn ? (
                    // ── Mi propia autoevaluación: solo lo que yo respondí, sin promedio ni nota del líder ──
                    <>
                      {(!g.autoEval || g.autoEval.responses.length === 0) && (
                        <p className="text-xs text-stone-400 italic">Todavía no completaste tu autoevaluación de este período.</p>
                      )}
                      {(['HARD', 'SOFT'] as const).map(tipo => {
                        const skills = g.autoEval ? groupBySkill(g.autoEval.responses, tipo) : [];
                        if (!skills.length) return null;
                        return (
                          <div key={tipo}>
                            <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">
                              {tipo === 'HARD' ? '🔧 Hard Skills' : '💬 Soft Skills'}
                            </p>
                            <div className="space-y-1">
                              {skills.map(s => (
                                <div key={s.skill_nombre} className="flex items-center justify-between gap-2 py-1 px-2 bg-white rounded-lg border border-stone-100">
                                  <p className="text-sm text-slate-700 flex-1 truncate" title={s.skill_nombre}>{s.skill_nombre}</p>
                                  <span className={`flex-shrink-0 min-w-7 h-7 px-1.5 rounded-full flex items-center justify-center text-xs font-bold ${scoreColorForAvg(s.promedio)}`}>
                                    {fmtScore(s.promedio)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {g.autoEval?.comentario && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-bold text-amber-600 mb-1">💬 Tu comentario</p>
                          <p className="text-sm text-slate-700 italic">"{g.autoEval.comentario}"</p>
                        </div>
                      )}
                      <p className="text-xs text-stone-400 italic">
                        La evaluación de tu líder no se muestra acá — la vas a recibir por PDF.
                      </p>
                    </>
                  ) : (
                    // ── Un miembro de mi equipo: lo que respondió + lo que le puse, y el promedio ──
                    <>
                      <p className="text-xs text-stone-400 italic">
                        El promedio pondera más tu evaluación: nunca supera el puntaje que vos pusiste, aunque la autoevaluación haya sido más alta.
                      </p>
                      {(['HARD', 'SOFT'] as const).map(tipo => {
                        const rows = tipo === 'HARD' ? hardRows : softRows;
                        if (!rows.length) return null;
                        return (
                          <div key={tipo}>
                            <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">
                              {tipo === 'HARD' ? '🔧 Hard Skills' : '💬 Soft Skills'}
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 px-2 text-[10px] font-semibold text-stone-400 uppercase">
                                <span className="flex-1">Skill</span>
                                <span className="w-14 text-center">👤 Autoeval.</span>
                                <span className="w-14 text-center">⭐ Vos</span>
                                <span className="w-14 text-center" title="Promedio ponderado: no puede superar el puntaje que vos pusiste">Prom.</span>
                              </div>
                              {rows.map(r => (
                                <div key={r.skill_nombre} className="flex items-center gap-2 py-1 px-2 bg-white rounded-lg border border-stone-100">
                                  <p className="text-sm text-slate-700 flex-1 truncate" title={r.skill_nombre}>{r.skill_nombre}</p>
                                  <span className={`w-14 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full h-7 ${r.auto != null ? scoreColorForAvg(r.auto) : 'bg-stone-50 text-stone-300'}`}>
                                    {r.auto != null ? fmtScore(r.auto) : '—'}
                                  </span>
                                  <span className={`w-14 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full h-7 ${r.jefe != null ? scoreColorForAvg(r.jefe) : 'bg-stone-50 text-stone-300'}`}>
                                    {r.jefe != null ? fmtScore(r.jefe) : '—'}
                                  </span>
                                  <span className={`w-14 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-full h-7 ${r.promedio != null ? scoreColorForAvg(r.promedio) : 'bg-stone-50 text-stone-300'}`}>
                                    {r.promedio != null ? r.promedio.toFixed(1) : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {g.autoEval?.comentario && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-bold text-blue-600 mb-1">💬 Comentario de {g.evaluado_nombre}</p>
                          <p className="text-sm text-slate-700 italic">"{g.autoEval.comentario}"</p>
                        </div>
                      )}
                      {g.jefeEval?.comentario && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-bold text-amber-600 mb-1">💬 Tu comentario</p>
                          <p className="text-sm text-slate-700 italic">"{g.jefeEval.comentario}"</p>
                        </div>
                      )}
                    </>
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
