// src/components/SkillBarsPanel.tsx
// Panel de desglose de skills como barras horizontales (sin pentágono).
// Se usa en el drill-down de Bandas de Seniority en MetricasRRHH.
import { useState, useEffect } from 'react';
import { fetchPersonaSkillAverages, type SkillAvgRow } from '../lib/supabaseQueries';
import type { SkillMatrix } from '../types';

interface AreaPeer {
  nombre: string;
  promedioFinal: number;
  seniorityAlcanzado: string;
}

interface SkillBarsPanelProps {
  email: string;
  nombre: string;
  area?: string;
  origen: 'ANALISTA' | 'LIDER';
  skillsMatrix?: SkillMatrix[];
  peers?: AreaPeer[];  // otras personas del mismo área para comparación
  onClose?: () => void;
}

const COLORS = {
  auto: '#3b82f6',
  jefe: '#f97316',
  total: '#10b981',
  esperado: '#9ca3af',
};

const SENIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Trainee:      { bg: 'bg-stone-100',  text: 'text-stone-500'  },
  Junior:       { bg: 'bg-slate-100',  text: 'text-slate-600'  },
  'Semi Senior':{ bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Senior:       { bg: 'bg-orange-100', text: 'text-orange-700' },
};

function seniorityFromAvg(avg: number): string {
  if (avg >= 3.5) return 'Senior';
  if (avg >= 2.5) return 'Semi Senior';
  if (avg >= 1.5) return 'Junior';
  return 'Trainee';
}

type SkillTab = 'HARD' | 'SOFT';

export default function SkillBarsPanel({
  email, nombre, area, origen, skillsMatrix = [], peers = [], onClose,
}: SkillBarsPanelProps) {
  const [skills, setSkills] = useState<SkillAvgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<SkillTab>('HARD');
  const [targetSeniority, setTargetSeniority] = useState<string>('Semi Senior');
  const [showComparison, setShowComparison] = useState(false);

  const rolObjetivo = origen;

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchPersonaSkillAverages(email, undefined, area, rolObjetivo)
      .then(data => {
        setSkills(data);
        const hasHard = data.some(s => s.skill_tipo === 'HARD');
        const hasSoft = data.some(s => s.skill_tipo === 'SOFT');
        if (!hasHard && hasSoft) setTab('SOFT');
        // Seniority actual → objetivo = siguiente nivel
        const overall = data.length > 0 ? data.reduce((s, r) => s + r.avg_total, 0) / data.length : 0;
        const current = seniorityFromAvg(overall);
        const order = ['Trainee', 'Junior', 'Semi Senior', 'Senior'];
        const idx = order.indexOf(current);
        setTargetSeniority(order[Math.min(idx + 1, order.length - 1)]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [email, area, rolObjetivo]);

  const filtered = skills.filter(s => s.skill_tipo === tab);

  // Esperado desde skills_matrix
  const getEsperado = (skillNombre: string): number | null => {
    if (!skillsMatrix.length) return null;
    const match = skillsMatrix.find(m => m.skillNombre === skillNombre && m.seniority === targetSeniority);
    return match?.valorEsperado ?? null;
  };

  // allowedNames: si la skillsMatrix tiene entries para el área, usarlas para filtrar
  const areaMatrix = skillsMatrix.filter(m => !area || m.area === area);
  const allowedNames = areaMatrix.length > 0 ? new Set(areaMatrix.map(m => m.skillNombre)) : null;

  // Contar solo las skills que realmente se muestran (únicas, filtradas por matrix si aplica)
  const hardCount = skills
    .filter(s => s.skill_tipo === 'HARD')
    .filter(s => !allowedNames || allowedNames.has(s.skill_nombre))
    .length;
  const softCount = skills
    .filter(s => s.skill_tipo === 'SOFT')
    .filter(s => !allowedNames || allowedNames.has(s.skill_nombre))
    .length;

  const overallAvg = skills.length > 0 ? skills.reduce((s, r) => s + r.avg_total, 0) / skills.length : 0;
  const currentSeniority = seniorityFromAvg(overallAvg);
  const seniorityColors = SENIORITY_COLORS[currentSeniority] ?? SENIORITY_COLORS.Junior;

  // Ordenar: mejor primero; también aplicar filtro allowedNames
  const sorted = [...filtered]
    .filter(s => !allowedNames || allowedNames.has(s.skill_nombre))
    .sort((a, b) => b.avg_total - a.avg_total);

  return (
    <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-lg overflow-hidden mt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-600 text-lg shrink-0">
            {nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-900">{nombre}</p>
            <p className="text-xs text-stone-500">{email}{area ? ` · ${area}` : ''}</p>
          </div>
          {!loading && overallAvg > 0 && (
            <>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${seniorityColors.bg} ${seniorityColors.text} border-current`}>
                Actual: {currentSeniority} · {overallAvg.toFixed(2)}
              </span>
              <span className="text-xs font-bold px-3 py-1 rounded-full border border-stone-300 bg-stone-100 text-stone-600">
                Objetivo: {targetSeniority}
              </span>
            </>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-white rounded-xl transition shrink-0" title="Cerrar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      )}
      {error && <p className="text-red-600 text-sm p-6">❌ {error}</p>}

      {!loading && !error && skills.length === 0 && (
        <div className="text-center py-12 text-stone-400">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-sm font-medium">Sin datos de habilidades para este período</p>
        </div>
      )}

      {!loading && !error && skills.length > 0 && (
        <div className="p-6 space-y-5">
          {/* Controles: tabs + comparación */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-2">
              {(['HARD', 'SOFT'] as const).map(t => {
                const count = t === 'HARD' ? hardCount : softCount;
                return (
                  <button key={t} onClick={() => setTab(t)} disabled={count === 0}
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition border ${
                      tab === t
                        ? t === 'HARD' ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {t === 'HARD' ? '⚙️ Hard' : '🤝 Soft'}
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-white/30' : 'bg-stone-100 text-stone-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            {peers.length > 0 && (
              <button onClick={() => setShowComparison(!showComparison)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  showComparison ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-400'
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Comparar con el área
              </button>
            )}
          </div>

          {/* Layout: barras de skills + comparación */}
          <div className={`grid gap-6 ${showComparison && peers.length > 0 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {/* Barras de skills */}
            <div className={showComparison && peers.length > 0 ? 'lg:col-span-2' : ''}>
              <p className="text-xs text-stone-500 font-semibold mb-3 uppercase tracking-wide">
                Desglose por habilidad — ordenado por promedio
              </p>
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {sorted.map((s, i) => {
                  const esperado = getEsperado(s.skill_nombre);
                  const cumple = esperado != null ? s.avg_total >= esperado : null;
                  const pctAuto = s.avg_auto != null ? (s.avg_auto / 4) * 100 : null;
                  const pctJefe = s.avg_jefe != null ? (s.avg_jefe / 4) * 100 : null;
                  const pctTotal = (s.avg_total / 4) * 100;
                  const pctEsp = esperado != null ? (esperado / 4) * 100 : null;

                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]" title={s.skill_nombre}>
                          {s.skill_nombre}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-green-600">{s.avg_total.toFixed(2)}</span>
                          {cumple !== null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cumple ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {cumple ? '✓' : '✗'}{esperado != null ? ` ${esperado.toFixed(0)}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra auto */}
                      {pctAuto != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-blue-500 w-7 text-right shrink-0">Auto</span>
                          <div className="relative flex-1 h-4 bg-stone-100 rounded-full overflow-visible">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pctAuto}%`, background: COLORS.auto, opacity: 0.65 }} />
                            <span className="absolute right-1.5 top-0 bottom-0 flex items-center text-[9px] font-bold text-white mix-blend-luminosity">
                              {pctAuto > 20 ? s.avg_auto?.toFixed(1) : ''}
                            </span>
                            {pctEsp != null && (
                              <div className="absolute top-[-2px] w-0.5 h-[20px] bg-stone-400 rounded" style={{ left: `${pctEsp}%` }} title={`Esp ${targetSeniority}: ${esperado}`} />
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 w-6 shrink-0">{s.avg_auto?.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Barra jefe */}
                      {pctJefe != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-orange-500 w-7 text-right shrink-0">Jefe</span>
                          <div className="relative flex-1 h-4 bg-stone-100 rounded-full overflow-visible">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pctJefe}%`, background: COLORS.jefe, opacity: 0.65 }} />
                            {pctEsp != null && (
                              <div className="absolute top-[-2px] w-0.5 h-[20px] bg-stone-400 rounded" style={{ left: `${pctEsp}%` }} />
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 w-6 shrink-0">{s.avg_jefe?.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Barra promedio */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-600 w-7 text-right shrink-0">Prom</span>
                        <div className="relative flex-1 h-4 bg-stone-100 rounded-full overflow-visible">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pctTotal}%`, background: COLORS.total }} />
                          {pctEsp != null && (
                            <div className="absolute top-[-2px] w-0.5 h-[20px] bg-stone-400 rounded" style={{ left: `${pctEsp}%` }} title={`Esp ${targetSeniority}: ${esperado}`} />
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400 w-6 shrink-0">{s.avg_total.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel de comparación con el área */}
            {showComparison && peers.length > 0 && (
              <div>
                <p className="text-xs text-stone-500 font-semibold mb-3 uppercase tracking-wide">
                  Comparación en el área
                </p>
                <div className="space-y-3">
                  {peers.map((p, i) => {
                    const pct = Math.round((p.promedioFinal / 4) * 100);
                    const isThis = p.nombre === nombre;
                    const sc = SENIORITY_COLORS[p.seniorityAlcanzado] ?? SENIORITY_COLORS.Junior;
                    return (
                      <div key={i} className={`rounded-xl p-3 border transition-all ${isThis ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-200' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isThis && <span className="text-orange-500 text-xs">►</span>}
                            <span className={`text-xs font-semibold truncate ${isThis ? 'text-orange-700' : 'text-slate-700'}`} title={p.nombre}>
                              {p.nombre}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{p.seniorityAlcanzado}</span>
                            <span className={`text-sm font-bold ${isThis ? 'text-orange-600' : 'text-slate-600'}`}>{p.promedioFinal.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isThis ? 'bg-orange-400' : 'bg-stone-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Stats del área */}
                <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <p className="text-xs font-bold text-stone-600 mb-2">Promedio del área</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-slate-700">
                      {(peers.reduce((s, p) => s + p.promedioFinal, 0) / peers.length).toFixed(2)}
                    </span>
                    <span className={`text-sm font-bold ${overallAvg >= peers.reduce((s, p) => s + p.promedioFinal, 0) / peers.length ? 'text-green-600' : 'text-red-500'}`}>
                      {overallAvg >= peers.reduce((s, p) => s + p.promedioFinal, 0) / peers.length ? '↑ Sobre el promedio' : '↓ Bajo el promedio'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs text-stone-500 border-t border-stone-100 pt-3 flex-wrap">
            <span className="font-semibold text-stone-700">Escala:</span>
            {[['1','En desarrollo'],['2','Básico'],['3','Competente'],['4','Sobresaliente']].map(([v,l]) => (
              <span key={v}><strong className="text-slate-700">{v}</strong> = {l}</span>
            ))}
            {skillsMatrix.length > 0 && (
              <span className="ml-auto text-stone-400">La línea vertical = esperado para {targetSeniority}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
