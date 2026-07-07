// src/components/PersonaRadarPanel.tsx
// Panel de detalle individual con radar real por habilidades (desde responses → questions → skills)
// Incluye capa "Esperado" de la skills_matrix según el seniority configurado en administración.
import { useState, useEffect } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts';
import { fetchPersonaSkillAverages, type SkillAvgRow } from '../lib/supabaseQueries';
import type { SkillMatrix } from '../types';

interface PersonaRadarPanelProps {
  email: string;
  nombre: string;
  area?: string;
  periodos?: string[];
  skillsMatrix?: SkillMatrix[];   // Skills matrix de administración
  rolObjetivo?: string;           // 'ANALISTA' | 'LIDER' — filtra skills según rol
  onClose?: () => void;
}

const COLORS = {
  auto: '#3b82f6',    // azul
  jefe: '#f97316',    // naranja
  total: '#10b981',   // verde
  esperado: '#9ca3af', // gris
};

type SeniorityLevel = 'Trainee' | 'Junior' | 'Semi Senior' | 'Senior';

function seniorityFromAvg(avg: number): SeniorityLevel {
  if (avg >= 3.5) return 'Senior';
  if (avg >= 2.5) return 'Semi Senior';
  if (avg >= 1.5) return 'Junior';
  return 'Trainee';
}

const SENIORITY_ORDER: SeniorityLevel[] = ['Trainee', 'Junior', 'Semi Senior', 'Senior'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const skill = payload[0]?.payload?.skill;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-3 min-w-[200px]">
      <p className="text-sm font-bold text-slate-900 mb-2 border-b border-stone-100 pb-1">{skill}</p>
      {payload.map((entry: any) => (
        entry.value != null && (
          <div key={entry.name} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
              <span className="text-xs text-stone-600">{entry.name}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : '—'}
            </span>
          </div>
        )
      ))}
    </div>
  );
};

const CustomTick = (props: any) => {
  const { x, y, payload } = props;
  const words = payload.value.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');
  return (
    <text x={x} y={y} textAnchor="middle" fill="#57534e" fontSize="10" fontWeight="600">
      {payload.value.length > 18 ? (
        <>
          <tspan x={x} dy="-8">{line1}</tspan>
          <tspan x={x} dy="13">{line2}</tspan>
        </>
      ) : (
        <tspan>{payload.value}</tspan>
      )}
    </text>
  );
};

export default function PersonaRadarPanel({ email, nombre, area, periodos, skillsMatrix = [], rolObjetivo, onClose }: PersonaRadarPanelProps) {
  const [skills, setSkills] = useState<SkillAvgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'HARD' | 'SOFT'>('HARD');
  const [targetSeniority, setTargetSeniority] = useState<SeniorityLevel>('Semi Senior');
  // Guardamos el rol objetivo en una variable local para que TS lo detecte como "leído"
  const rol = rolObjetivo;

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchPersonaSkillAverages(email, periodos, area, rol)
      .then(data => {
        setSkills(data);
        // Auto-tab: priorizar HARD si tiene datos
        const hard = data.filter(s => s.skill_tipo === 'HARD');
        const soft = data.filter(s => s.skill_tipo === 'SOFT');
        if (hard.length === 0 && soft.length > 0) setTab('SOFT');
        // Target seniority: el siguiente nivel al actual
        const overall = data.length > 0
          ? data.reduce((s, r) => s + r.avg_total, 0) / data.length
          : 0;
        const current = seniorityFromAvg(overall);
        const idx = SENIORITY_ORDER.indexOf(current);
        setTargetSeniority(SENIORITY_ORDER[Math.min(idx + 1, SENIORITY_ORDER.length - 1)]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [email, area, periodos?.join(','), rol]);

  // Filtrar por tipo de tab y luego por skillsMatrix del área (si está configurada)
  const areaMatrix = skillsMatrix.filter(m => !area || m.area === area);
  const allowedNames = areaMatrix.length > 0 ? new Set(areaMatrix.map(m => m.skillNombre)) : null;
  const filtered = skills
    .filter(s => s.skill_tipo === tab)
    .filter(s => !allowedNames || allowedNames.has(s.skill_nombre));

  // Obtener valor esperado de la matrix para la skill y seniority objetivo
  const getEsperado = (skillNombre: string): number | null => {
    if (!skillsMatrix.length) return null;
    // Buscar por skill_nombre + seniority. Puede estar en el área o sin área.
    const match = skillsMatrix.find(
      m => m.skillNombre === skillNombre && m.seniority === targetSeniority
    );
    return match?.valorEsperado ?? null;
  };

  // Radar data
  const radarData = filtered.map(s => {
    const esperado = getEsperado(s.skill_nombre);
    return {
      skill: s.skill_nombre,
      'Autoevaluación': s.avg_auto != null ? +s.avg_auto.toFixed(2) : undefined,
      'Evaluación Jefe': s.avg_jefe != null ? +s.avg_jefe.toFixed(2) : undefined,
      'Promedio': +s.avg_total.toFixed(2),
      ...(esperado != null ? { 'Esperado': +esperado.toFixed(2) } : {}),
    };
  });

  const hasEsperado = radarData.some(d => d['Esperado'] != null);
  const hasAuto = radarData.some(d => d['Autoevaluación'] != null);
  const hasJefe = radarData.some(d => d['Evaluación Jefe'] != null);

  const overallAvg = skills.length > 0
    ? skills.reduce((s, r) => s + r.avg_total, 0) / skills.length
    : 0;
  const currentSeniority = seniorityFromAvg(overallAvg);

  const SENIORITY_COLORS: Record<SeniorityLevel, string> = {
    Trainee: 'text-stone-500 bg-stone-50 border-stone-200',
    Junior: 'text-slate-600 bg-slate-50 border-slate-200',
    'Semi Senior': 'text-blue-700 bg-blue-50 border-blue-200',
    Senior: 'text-orange-600 bg-orange-50 border-orange-200',
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-lg overflow-hidden">
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
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${SENIORITY_COLORS[currentSeniority]}`}>
                Actual: {currentSeniority} · {overallAvg.toFixed(2)}
              </span>
              {hasEsperado && (
                <span className="text-xs font-bold px-3 py-1 rounded-full border border-stone-300 bg-stone-100 text-stone-600">
                  Objetivo: {targetSeniority}
                </span>
              )}
            </>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-white rounded-xl transition shrink-0"
            title="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      )}
      {error && <p className="text-red-600 text-sm p-6">❌ {error}</p>}

      {!loading && !error && skills.length === 0 && (
        <div className="text-center py-12 text-stone-400">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-sm font-medium">Sin datos de habilidades — asegurate de que el período tiene respuestas cargadas</p>
        </div>
      )}

      {!loading && !error && skills.length > 0 && (
        <div className="p-6 space-y-5">
          {/* Controles: tabs Hard/Soft + selector seniority objetivo */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-2">
              {(['HARD', 'SOFT'] as const).map(t => {
                // Contar solo las skills que realmente se van a mostrar (filtradas por skillsMatrix)
                const count = skills
                  .filter(s => s.skill_tipo === t)
                  .filter(s => !allowedNames || allowedNames.has(s.skill_nombre))
                  .length;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    disabled={count === 0}
                    className={`px-5 py-2 text-sm font-bold rounded-xl transition border ${
                      tab === t
                        ? t === 'HARD'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {t === 'HARD' ? '⚙️ Hard Skills' : '🤝 Soft Skills'}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                      tab === t ? 'bg-white/30' : 'bg-stone-100 text-stone-500'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Selector seniority objetivo */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-600">Comparar con:</span>
              <select
                value={targetSeniority}
                onChange={e => setTargetSeniority(e.target.value as SeniorityLevel)}
                className="text-xs font-bold px-3 py-1.5 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-orange-400 focus:outline-none"
              >
                {SENIORITY_ORDER.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="text-xs text-stone-400">(esperado por nivel)</span>
            </div>
          </div>

          {radarData.length < 3 ? (
            // Menos de 3 skills → barras
            <div className="space-y-3">
              <p className="text-xs text-stone-500 italic">
                Se necesitan al menos 3 habilidades para el radar — mostrando barras
              </p>
              {radarData.map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{d.skill}</span>
                    <span className="text-orange-600">{d['Promedio'].toFixed(2)}</span>
                  </div>
                  <div className="h-5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all"
                      style={{ width: `${(d['Promedio'] / 4) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar */}
              <div>
                <p className="text-xs text-stone-500 font-semibold mb-2 uppercase tracking-wide">
                  Pentágono de habilidades
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} margin={{ top: 25, right: 35, bottom: 25, left: 35 }}>
                    <PolarGrid stroke="#e7e5e4" />
                    <PolarAngleAxis dataKey="skill" tick={<CustomTick />} />
                    <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 9 }} tickCount={5} />
                    {/* Capa Esperado (gris, fondo) */}
                    {hasEsperado && (
                      <Radar
                        name="Esperado"
                        dataKey="Esperado"
                        stroke={COLORS.esperado}
                        fill={COLORS.esperado}
                        fillOpacity={0.2}
                        strokeWidth={1.5}
                        strokeDasharray="6 3"
                      />
                    )}
                    {/* Autoevaluación (azul) */}
                    {hasAuto && (
                      <Radar
                        name="Autoevaluación"
                        dataKey="Autoevaluación"
                        stroke={COLORS.auto}
                        fill={COLORS.auto}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    )}
                    {/* Evaluación Jefe (naranja) */}
                    {hasJefe && (
                      <Radar
                        name="Evaluación Jefe"
                        dataKey="Evaluación Jefe"
                        stroke={COLORS.jefe}
                        fill={COLORS.jefe}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    )}
                    {/* Promedio final (verde) */}
                    <Radar
                      name="Promedio"
                      dataKey="Promedio"
                      stroke={COLORS.total}
                      fill={COLORS.total}
                      fillOpacity={0.18}
                      strokeWidth={2.5}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Detalle por skill */}
              <div>
                <p className="text-xs text-stone-500 font-semibold mb-3 uppercase tracking-wide">
                  Detalle por habilidad
                </p>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {filtered.map((s, i) => {
                    const esperado = getEsperado(s.skill_nombre);
                    const cumple = esperado != null ? s.avg_total >= esperado : null;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[170px]" title={s.skill_nombre}>
                            {s.skill_nombre}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-green-600">{s.avg_total.toFixed(2)}</span>
                            {cumple !== null && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                cumple ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                              }`}>
                                {cumple ? '✓' : '✗'} {esperado?.toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="relative h-3 bg-stone-100 rounded-full overflow-visible">
                          {/* Barra auto */}
                          {s.avg_auto != null && (
                            <div
                              className="absolute top-0 left-0 h-full rounded-full transition-all opacity-60"
                              style={{ width: `${(s.avg_auto / 4) * 100}%`, background: COLORS.auto }}
                            />
                          )}
                          {/* Barra promedio */}
                          <div
                            className="absolute top-0 left-0 h-full rounded-full transition-all opacity-80"
                            style={{ width: `${(s.avg_total / 4) * 100}%`, background: COLORS.total }}
                          />
                          {/* Marcador esperado */}
                          {esperado != null && esperado > 0 && (
                            <div
                              className="absolute top-[-3px] w-0.5 h-[18px] bg-stone-400 rounded"
                              style={{ left: `${(esperado / 4) * 100}%` }}
                              title={`Esperado ${targetSeniority}: ${esperado}`}
                            />
                          )}
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                          {s.avg_auto != null && <span className="text-blue-400">Auto {s.avg_auto.toFixed(1)}</span>}
                          {s.avg_jefe != null && <span className="text-orange-400">Jefe {s.avg_jefe.toFixed(1)}</span>}
                          <span className="ml-auto text-green-500">Prom {s.avg_total.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Leyenda escala + estado */}
          <div className="flex items-center gap-4 text-xs text-stone-500 border-t border-stone-100 pt-3 flex-wrap">
            <span className="font-semibold text-stone-700">Escala:</span>
            {[['1', 'En desarrollo'], ['2', 'Básico'], ['3', 'Competente'], ['4', 'Sobresaliente']].map(([v, l]) => (
              <span key={v}><strong className="text-slate-700">{v}</strong> = {l}</span>
            ))}
            <span className="ml-auto text-stone-400">
              La línea vertical en cada barra = valor esperado para {targetSeniority}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
