// src/components/MiDesempenoPanel.tsx
// Panel de "Mi Desempeño" reutilizable para Lider, Director (Analista individual), etc.
import { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Evaluation } from '../types';
import type { Seniority, RadarDataPoint } from '../types';
import { calcularSeniorityAlcanzado, calcularPromedioGeneral } from '../utils/calculations';
import { comparePersonaBetweenPeriods } from '../utils/dateUtils';
import RadarChart from './RadarChart';

interface MiDesempenoPanelProps {
  evaluaciones: Evaluation[];
  skillsMatrix: any[];
  persona: { email: string; nombre: string; area?: string; rol?: string };
  titulo?: string;
  /** Si true, solo muestra los badges y la sección de evolución (sin métricas ni pentágonos) */
  evolutionOnly?: boolean;
}

export default function MiDesempenoPanel({ evaluaciones, skillsMatrix, persona, titulo, evolutionOnly = false }: MiDesempenoPanelProps) {
  const [seniorityEsperado] = useState<Seniority>('Semi Senior');
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState({ mejoraron: false, empeoraron: false, iguales: false });

  const area = persona.area || '';

  const rol = persona.rol || 'ANALISTA';

  // Radar data computado inline (evita depender de la firma de transformarARadarData que varía entre versiones)
  const miRadarDataHard = useMemo((): RadarDataPoint[] => {
    const skillMap = new Map<string, { auto: number[]; jefe: number[] }>();
    evaluaciones.filter(e => e.skillTipo === 'HARD').forEach(e => {
      if (!e.skillNombre) return;
      if (!skillMap.has(e.skillNombre)) skillMap.set(e.skillNombre, { auto: [], jefe: [] });
      const d = skillMap.get(e.skillNombre)!;
      if (e.tipoEvaluador === 'AUTO') d.auto.push(e.puntaje);
      else d.jefe.push(e.puntaje);
    });
    return Array.from(skillMap.entries()).map(([skill, d]) => {
      const auto = d.auto.length > 0 ? d.auto.reduce((a, b) => a + b, 0) / d.auto.length : 0;
      const jefe = d.jefe.length > 0 ? d.jefe.reduce((a, b) => a + b, 0) / d.jefe.length : 0;
      const promedio = auto > 0 && jefe > 0 ? (auto + jefe) / 2 : (auto || jefe);
      const esperado = skillsMatrix.find(m => m.skillNombre === skill && m.area === area)?.valorEsperado ?? 3;
      return { skill, auto, jefe, promedio: parseFloat(promedio.toFixed(2)), esperado };
    });
  }, [evaluaciones, skillsMatrix, rol, area]);

  const miRadarDataSoft = useMemo((): RadarDataPoint[] => {
    const skillMap = new Map<string, { auto: number[]; jefe: number[] }>();
    evaluaciones.filter(e => e.skillTipo === 'SOFT').forEach(e => {
      if (!e.skillNombre) return;
      if (!skillMap.has(e.skillNombre)) skillMap.set(e.skillNombre, { auto: [], jefe: [] });
      const d = skillMap.get(e.skillNombre)!;
      if (e.tipoEvaluador === 'AUTO') d.auto.push(e.puntaje);
      else d.jefe.push(e.puntaje);
    });
    return Array.from(skillMap.entries()).map(([skill, d]) => {
      const auto = d.auto.length > 0 ? d.auto.reduce((a, b) => a + b, 0) / d.auto.length : 0;
      const jefe = d.jefe.length > 0 ? d.jefe.reduce((a, b) => a + b, 0) / d.jefe.length : 0;
      const promedio = auto > 0 && jefe > 0 ? (auto + jefe) / 2 : (auto || jefe);
      const esperado = skillsMatrix.find(m => m.skillNombre === skill && m.area === area)?.valorEsperado ?? 3;
      return { skill, auto, jefe, promedio: parseFloat(promedio.toFixed(2)), esperado };
    });
  }, [evaluaciones, skillsMatrix, rol, area]);

  const allRadarData = useMemo(() => [...miRadarDataHard, ...miRadarDataSoft], [miRadarDataHard, miRadarDataSoft]);
  const miPromedioGeneral = useMemo(() => calcularPromedioGeneral(allRadarData), [allRadarData]);
  const miSeniorityAlcanzado = useMemo(() => calcularSeniorityAlcanzado(miPromedioGeneral), [miPromedioGeneral]);

  const miComparacion = useMemo(() => comparePersonaBetweenPeriods(evaluaciones), [evaluaciones]);

  // agruparPorSemestre implementado inline (no disponible en todos los entornos de build)
  const evolucionHistorica = useMemo(() => {
    const semestreMap = new Map<string, { auto: number[]; jefe: number[] }>();
    evaluaciones.forEach(e => {
      const d = new Date(e.fecha);
      const key = `${d.getFullYear()}-S${Math.floor(d.getMonth() / 6) + 1}`;
      if (!semestreMap.has(key)) semestreMap.set(key, { auto: [], jefe: [] });
      const data = semestreMap.get(key)!;
      if (e.tipoEvaluador === 'AUTO') data.auto.push(e.puntaje);
      else data.jefe.push(e.puntaje);
    });
    return Array.from(semestreMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semestre, data]) => {
        const auto = data.auto.length > 0 ? data.auto.reduce((a, b) => a + b, 0) / data.auto.length : 0;
        const jefe = data.jefe.length > 0 ? data.jefe.reduce((a, b) => a + b, 0) / data.jefe.length : 0;
        const promedio = auto > 0 && jefe > 0 ? (auto + jefe) / 2 : (auto || jefe);
        return { semestre, promedio: Math.round(promedio * 100) / 100, auto: Math.round(auto * 100) / 100, jefe: Math.round(jefe * 100) / 100 };
      });
  }, [evaluaciones]);

  const esHistorico = evolucionHistorica.length > 2;

  // Seniority esperado: siguiente al del semestre anterior
  const SENIORITY_NEXT: Record<string, Seniority> = { 'Trainee': 'Junior', 'Junior': 'Semi Senior', 'Semi Senior': 'Senior', 'Senior': 'Senior' };
  const seniorityEsperadoDisplay = useMemo((): string => {
    const { sAnterior } = miComparacion;
    if (sAnterior.length === 0) return '--';
    const promAnterior = sAnterior.reduce((s, c) => s + c.promedio, 0) / sAnterior.length;
    const seniorityAnterior = calcularSeniorityAlcanzado(promAnterior);
    return SENIORITY_NEXT[seniorityAnterior] || miSeniorityAlcanzado;
  }, [miComparacion, miSeniorityAlcanzado]);

  const analisisSkills = useMemo(() => {
    const { sAnterior, sActual } = miComparacion;
    const mejoraron: string[] = [], iguales: string[] = [], empeoraron: string[] = [], nuevas: string[] = [];
    sActual.forEach(actual => {
      const anterior = sAnterior.find(s => s.skill === actual.skill);
      if (!anterior) nuevas.push(actual.skill);
      else {
        const diff = actual.promedio - anterior.promedio;
        if (diff > 0.2) mejoraron.push(actual.skill);
        else if (diff < -0.2) empeoraron.push(actual.skill);
        else iguales.push(actual.skill);
      }
    });
    return { mejoraron, iguales, empeoraron, nuevas };
  }, [miComparacion]);

  const barrasComparacion = useMemo(() => {
    const { sAnterior, sActual } = miComparacion;
    const allSkills = new Set([...sAnterior.map(s => s.skill), ...sActual.map(s => s.skill)]);
    return Array.from(allSkills).map(skill => {
      const anterior = sAnterior.find(s => s.skill === skill);
      const actual = sActual.find(s => s.skill === skill);
      return { skillCompleto: skill, mejora: (actual?.promedio || 0) - (anterior?.promedio || 0), tipo: actual?.tipo || anterior?.tipo || 'HARD' };
    });
  }, [miComparacion]);

  // Datos para gráfico de línea por skill (usa skillNombre de las evaluaciones)
  const lineChartData = useMemo(() => {
    type LinePoint = {
      skill: string; skillCompleto: string;
      'Semestre Anterior': number; 'Semestre Actual': number;
      tipo: string; labelAnterior?: string; labelActual?: string;
    };

    const buildFromPeriods = (
      periodoAnterior: { skill: string; tipo: string; promedio: number }[],
      periodoActual: { skill: string; tipo: string; promedio: number }[],
      labelAnt?: string, labelAct?: string,
    ): LinePoint[] => {
      const allSkills = new Set([...periodoAnterior.map(s => s.skill), ...periodoActual.map(s => s.skill)]);
      return Array.from(allSkills)
        .filter(skill => skill.toLowerCase() !== 'general')
        .map(skill => {
          const ant = periodoAnterior.find(s => s.skill === skill);
          const act = periodoActual.find(s => s.skill === skill);
          return {
            skill: skill.length > 15 ? skill.substring(0, 15) + '...' : skill,
            skillCompleto: skill,
            'Semestre Anterior': ant?.promedio || 0,
            'Semestre Actual': act?.promedio || 0,
            tipo: ((act?.tipo || ant?.tipo || 'HARD') as string).toUpperCase(),
            labelAnterior: labelAnt, labelActual: labelAct,
          };
        })
        .filter(d => d['Semestre Anterior'] > 0 || d['Semestre Actual'] > 0)
        .sort((a, b) => (b['Semestre Actual'] - b['Semestre Anterior']) - (a['Semestre Actual'] - a['Semestre Anterior']));
    };

    const { sAnterior, sActual } = miComparacion;

    // Caso 1: Hay datos en ambos semestres del calendario
    if (sActual.length > 0 && sAnterior.length > 0) return buildFromPeriods(sAnterior, sActual);

    // Caso 2: No hay semestre actual — usar los dos últimos semestres disponibles
    if (evolucionHistorica.length >= 2) {
      const semestres = evolucionHistorica.map(s => s.semestre);
      const ultimoSem = semestres[semestres.length - 1];
      const penultimoSem = semestres[semestres.length - 2];

      const calcPeriod = (sem: string) => {
        const skillMap = new Map<string, { tipo: string; autos: number[]; jefes: number[] }>();
        evaluaciones
          .filter(e => {
            const d = new Date(e.fecha);
            return `${d.getFullYear()}-S${Math.floor(d.getMonth() / 6) + 1}` === sem;
          })
          .forEach(e => {
            if (!e.skillNombre || e.skillNombre.toLowerCase() === 'general') return;
            if (!skillMap.has(e.skillNombre)) skillMap.set(e.skillNombre, { tipo: (e.skillTipo || 'HARD').toUpperCase(), autos: [], jefes: [] });
            const entry = skillMap.get(e.skillNombre)!;
            if (e.tipoEvaluador === 'AUTO') entry.autos.push(e.puntaje);
            else entry.jefes.push(e.puntaje);
          });
        return Array.from(skillMap.entries()).map(([skill, d]) => {
          const auto = d.autos.length > 0 ? d.autos.reduce((a, b) => a + b) / d.autos.length : 0;
          const jefe = d.jefes.length > 0 ? d.jefes.reduce((a, b) => a + b) / d.jefes.length : 0;
          return { skill, tipo: d.tipo, promedio: auto > 0 && jefe > 0 ? (auto + jefe) / 2 : (auto || jefe) };
        });
      };

      const periodoActual = calcPeriod(ultimoSem);
      const periodoAnterior = calcPeriod(penultimoSem);
      if (periodoActual.length > 0 || periodoAnterior.length > 0) {
        return buildFromPeriods(periodoAnterior, periodoActual, penultimoSem, ultimoSem);
      }
    }
    return [] as LinePoint[];
  }, [miComparacion, evolucionHistorica, evaluaciones]);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-sm border border-purple-200 p-6">
      {titulo && (
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          {titulo}
        </h2>
      )}

      {/* Métricas — solo en modo completo */}
      {!evolutionOnly && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <p className="text-sm font-semibold text-stone-500 mb-2">Promedio General</p>
          <p className="text-4xl font-bold text-slate-900">{miPromedioGeneral.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <p className="text-sm font-semibold text-stone-500 mb-2">Seniority Alcanzado</p>
          <p className="text-2xl font-bold text-purple-600">{miSeniorityAlcanzado}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <p className="text-sm font-semibold text-stone-500 mb-2">Seniority Esperado</p>
          <p className={`text-2xl font-bold ${seniorityEsperadoDisplay === '--' ? 'text-stone-400' : 'text-slate-700'}`}>
            {seniorityEsperadoDisplay}
          </p>
          {seniorityEsperadoDisplay === '--' && <p className="text-xs text-stone-400 mt-1">Primera evaluación</p>}
        </div>
      </div>}

      {/* Badges análisis semestral */}
      {evaluaciones.length > 0 && (analisisSkills.mejoraron.length > 0 || analisisSkills.empeoraron.length > 0 || analisisSkills.iguales.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {analisisSkills.mejoraron.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-300 dark:border-green-600 p-4 shadow-sm">
              <button onClick={() => setExpandedSkills(e => ({...e, mejoraron: !e.mejoraron}))} className="w-full flex items-center justify-between gap-2 mb-3 hover:opacity-80 transition">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-.5 0-1-.2-1.4-.6l-4-4c-.8-.8-.8-2 0-2.8.8-.8 2-.8 2.8 0l2.6 2.6 5.6-5.6c.8-.8 2-.8 2.8 0 .8.8.8 2 0 2.8l-7 7c-.4.4-.9.6-1.4.6z" /></svg>
                  <span className="font-bold text-green-800 dark:text-green-300">En qué mejoré ({analisisSkills.mejoraron.length})</span>
                </div>
                <svg className={`w-4 h-4 text-green-600 transition-transform ${expandedSkills.mejoraron ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </button>
              <ul className="space-y-2">
                {(expandedSkills.mejoraron ? analisisSkills.mejoraron : analisisSkills.mejoraron.slice(0, 5)).map(skill => (
                  <li key={skill} className="text-xs text-green-700 dark:text-green-300 flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span><span>{skill}</span></li>
                ))}
                {!expandedSkills.mejoraron && analisisSkills.mejoraron.length > 5 && <li className="text-xs text-green-600 italic pt-1">+{analisisSkills.mejoraron.length - 5} más...</li>}
              </ul>
            </div>
          )}
          {analisisSkills.empeoraron.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-orange-300 dark:border-orange-600 p-4 shadow-sm">
              <button onClick={() => setExpandedSkills(e => ({...e, empeoraron: !e.empeoraron}))} className="w-full flex items-center justify-between gap-2 mb-3 hover:opacity-80 transition">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6l1.4 1.4L12 13.4l5.6 5.6 1.4-1.4L13.4 12z" /></svg>
                  <span className="font-bold text-orange-800 dark:text-orange-300">⚠️ Debería mejorar ({analisisSkills.empeoraron.length})</span>
                </div>
                <svg className={`w-4 h-4 text-orange-600 transition-transform ${expandedSkills.empeoraron ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </button>
              <ul className="space-y-2">
                {(expandedSkills.empeoraron ? analisisSkills.empeoraron : analisisSkills.empeoraron.slice(0, 5)).map(skill => (
                  <li key={skill} className="text-xs text-orange-700 dark:text-orange-300 flex items-start gap-2"><span className="text-orange-600 font-bold mt-0.5">✕</span><span>{skill}</span></li>
                ))}
                {!expandedSkills.empeoraron && analisisSkills.empeoraron.length > 5 && <li className="text-xs text-orange-600 italic pt-1">+{analisisSkills.empeoraron.length - 5} más...</li>}
              </ul>
            </div>
          )}
          {analisisSkills.iguales.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-300 dark:border-blue-600 p-4 shadow-sm">
              <button onClick={() => setExpandedSkills(e => ({...e, iguales: !e.iguales}))} className="w-full flex items-center justify-between gap-2 mb-3 hover:opacity-80 transition">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16h10M7 12h10m11-8a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="font-bold text-blue-800 dark:text-blue-300">Mantuve nivel ({analisisSkills.iguales.length})</span>
                </div>
                <svg className={`w-4 h-4 text-blue-600 transition-transform ${expandedSkills.iguales ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              </button>
              <ul className="space-y-2">
                {(expandedSkills.iguales ? analisisSkills.iguales : analisisSkills.iguales.slice(0, 5)).map(skill => (
                  <li key={skill} className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2"><span className="text-blue-600 font-bold mt-0.5">−</span><span>{skill}</span></li>
                ))}
                {!expandedSkills.iguales && analisisSkills.iguales.length > 5 && <li className="text-xs text-blue-600 italic pt-1">+{analisisSkills.iguales.length - 5} más...</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Evolución de Competencias */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-6">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          </div>
          <span>Evolución de Competencias (Hard y Soft Skills)</span>
        </div>
        <div>
            {evaluaciones.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-6">Sin evaluaciones disponibles</p>
            ) : esHistorico ? (
              <>
                <p className="text-xs text-stone-500 mb-4">Evolución del promedio a través de todos los semestres</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={evolucionHistorica} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="semestre" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="auto" name="Auto-evaluación" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="jefe" name="Evaluación Jefe" fill="#1e40af" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="promedio" name="Promedio" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {lineChartData.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-stone-100">
                    <p className="text-xs text-stone-500 mb-4">
                      Comparación por skill: {lineChartData[0]?.labelAnterior ?? 'S anterior'} vs {lineChartData[0]?.labelActual ?? 'S actual'}
                    </p>
                    {(['HARD', 'SOFT'] as const).map(tipo => {
                      const data = lineChartData.filter(d => d.tipo === tipo);
                      if (!data.length) return null;
                      const labelAnt = data[0]?.labelAnterior ?? 'S anterior';
                      const labelAct = data[0]?.labelActual ?? 'S actual';
                      return (
                        <div key={tipo} className="mb-6">
                          <p className="text-sm font-bold text-slate-700 mb-3">{tipo === 'HARD' ? '⚙️ Hard Skills' : '🤝 Soft Skills'}</p>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="skill" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={90} />
                              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                              <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} labelFormatter={(_l, p) => p?.[0]?.payload?.skillCompleto || _l} />
                              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                              <Line type="monotone" dataKey="Semestre Anterior" stroke={tipo === 'HARD' ? '#93c5fd' : '#d8b4fe'} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} name={labelAnt} />
                              <Line type="monotone" dataKey="Semestre Actual" stroke={tipo === 'HARD' ? '#1e40af' : '#7c3aed'} strokeWidth={3} dot={{ r: 4 }} name={labelAct} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : lineChartData.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-10 h-10 text-stone-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                <p className="text-stone-500 text-sm font-medium">Aún no hay comparación entre semestres</p>
                <p className="text-stone-400 text-xs mt-1 max-w-xs mx-auto">
                  A partir de la segunda evaluación podrás ver cómo evolucionaron tus habilidades de semestre a semestre.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-stone-500 mb-4">Comparación semestre anterior vs actual por tipo de competencia</p>
                {(['HARD', 'SOFT'] as const).map(tipo => {
                  const data = lineChartData.filter(d => d.tipo === tipo);
                  if (!data.length) return null;
                  const labelAnt = data[0]?.labelAnterior ?? 'S anterior';
                  const labelAct = data[0]?.labelActual ?? 'S actual';
                  return (
                    <div key={tipo} className="mb-6">
                      <p className="text-sm font-bold text-slate-700 mb-3">{tipo === 'HARD' ? '⚙️ Hard Skills' : '🤝 Soft Skills'}</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="skill" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={90} />
                          <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'Puntaje', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151' } }} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} labelFormatter={(_l, p) => p?.[0]?.payload?.skillCompleto || _l} />
                          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                          <Line type="monotone" dataKey="Semestre Anterior" stroke={tipo === 'HARD' ? '#93c5fd' : '#d8b4fe'} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: tipo === 'HARD' ? '#93c5fd' : '#d8b4fe', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} name={labelAnt} />
                          <Line type="monotone" dataKey="Semestre Actual" stroke={tipo === 'HARD' ? '#1e40af' : '#7c3aed'} strokeWidth={3} dot={{ fill: tipo === 'HARD' ? '#1e40af' : '#7c3aed', r: 5, strokeWidth: 0 }} activeDot={{ r: 7 }} name={labelAct} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </>
            )}
        </div>
      </div>

      {/* Pentágonos — solo en modo completo */}
      {!evolutionOnly && (evaluaciones.length > 0 ? (
        <div className="space-y-6">
          {!showDetailedView ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[{ data: miRadarDataHard, tipo: 'HARD', label: 'Hard Skills', color: 'slate' }, { data: miRadarDataSoft, tipo: 'SOFT', label: 'Soft Skills', color: 'purple' }].map(({ data, label }) => (
                <div key={label} className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">{label}</h3>
                  {data.length > 0 ? (
                    <div onClick={() => setShowDetailedView(true)} className="cursor-pointer">
                      <RadarChart data={data} title="" />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-stone-400">
                      <p className="text-sm">Sin evaluaciones de {label}</p>
                    </div>
                  )}
                </div>
              ))}
              {(miRadarDataHard.length > 0 || miRadarDataSoft.length > 0) && (
                <div className="lg:col-span-2 flex justify-center">
                  <button onClick={() => setShowDetailedView(true)} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">
                    🔍 Ver Detalle Completo
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-end">
                <button onClick={() => setShowDetailedView(false)} className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-semibold hover:bg-stone-50 transition">
                  📊 Vista Compacta
                </button>
              </div>
              {[{ data: miRadarDataHard, label: 'Hard Skills ⚙️', barData: barrasComparacion.filter(b => b.tipo === 'HARD') },
                { data: miRadarDataSoft, label: 'Soft Skills 🤝', barData: barrasComparacion.filter(b => b.tipo === 'SOFT') }].map(({ data, label, barData }) => (
                data.length > 0 && (
                  <div key={label} className="bg-white rounded-2xl border border-stone-100 p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">{label}</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <RadarChart data={data} title="" />
                      {barData.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-stone-500 uppercase mb-3">Variación S anterior → S actual</p>
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {barData.sort((a, b) => b.mejora - a.mejora).map((item) => (
                              <div key={item.skillCompleto} className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 w-36 truncate" title={item.skillCompleto}>{item.skillCompleto}</span>
                                <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden relative">
                                  <div className={`h-full rounded-full transition-all ${item.mejora >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                                    style={{ width: `${Math.min(Math.abs(item.mejora) * 20, 100)}%`, marginLeft: item.mejora < 0 ? `${100 - Math.min(Math.abs(item.mejora) * 20, 100)}%` : '0' }} />
                                </div>
                                <span className={`text-xs font-bold w-12 text-right ${item.mejora >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.mejora >= 0 ? '+' : ''}{item.mejora.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Métricas vacías */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Promedio General', desc: 'Aparecerá tu puntaje promedio entre auto-evaluación y evaluación del líder' },
              { label: 'Seniority Alcanzado', desc: 'Tu nivel de seniority según los resultados de la evaluación' },
              { label: 'Seniority Esperado', desc: 'El nivel al que apuntás alcanzar en la próxima evaluación' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-white rounded-2xl border-2 border-dashed border-stone-200 p-6 text-center">
                <p className="text-sm font-semibold text-stone-400 mb-2">{label}</p>
                <p className="text-xs text-stone-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Pentágono vacío */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-stone-200 p-10 text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-stone-500 mb-2">Pentágono de habilidades</p>
            <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed">
              Una vez que completes tu evaluación, acá verás un gráfico radar con tus Hard Skills y Soft Skills comparadas con el nivel esperado para tu rol.
            </p>
          </div>

          {/* Evolución vacía */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-stone-200 p-10 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-stone-500 mb-2">Evolución de competencias</p>
            <p className="text-sm text-stone-400 max-w-sm mx-auto leading-relaxed">
              A partir de la segunda evaluación, acá verás cómo evolucionaron tus habilidades semestre a semestre — qué mejoró, qué se mantuvo y qué necesitás trabajar.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
