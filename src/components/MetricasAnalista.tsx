import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Evaluation, User } from '../types';
import { calcularSeniorityAlcanzado, transformarARadarData, calcularPromedioGeneral } from '../utils/calculations';
import { filterByPeriod, PERIODOS, type PeriodoType } from '../utils/dateUtils';
import { useApp } from '../context/AppContext';
import RadarChart from './RadarChart';
import type { Seniority } from '../types';

interface MetricasAnalistaProps {
  evaluations: Evaluation[];
  skillsMatrix: any[];
  currentUser: User;
}

export default function MetricasAnalista({ evaluations, skillsMatrix, currentUser }: MetricasAnalistaProps) {
  const { logout } = useApp();
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const [selectedPeriodo, setSelectedPeriodo] = useState<PeriodoType>('HISTORICO');
  const [filtroModo, setFiltroModo] = useState<'periodo' | 'rango'>('periodo');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // Obtener todas las áreas donde el analista tiene evaluaciones
  const areasDelAnalista = useMemo(() => {
    const areas = new Set<string>();
    evaluations
      .filter(e => e.evaluadoEmail === currentUser.email)
      .forEach(e => {
        if (e.area) areas.add(e.area);
      });
    return Array.from(areas).sort();
  }, [evaluations, currentUser.email]);

  // Seleccionar área por defecto
  useMemo(() => {
    if (areasDelAnalista.length > 0 && !selectedArea) {
      setSelectedArea(areasDelAnalista[0]);
    }
  }, [areasDelAnalista, selectedArea]);

  // Filtrar evaluaciones por área seleccionada y período
  const evaluacionesPropias = useMemo(() => {
    let filtered = evaluations.filter(
      e => e.evaluadoEmail === currentUser.email && 
           (!selectedArea || e.area === selectedArea)
    );

    // Aplicar filtro de período
    if (filtroModo === 'periodo') {
      filtered = filterByPeriod(filtered, selectedPeriodo);
    } else if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(e => {
        const fecha = new Date(e.fecha);
        return fecha >= inicio && fecha <= fin;
      });
    }

    return filtered;
  }, [evaluations, currentUser.email, selectedArea, selectedPeriodo, filtroModo, fechaInicio, fechaFin]);

  // Separar por tipo de evaluador y skill
  const evalsAutoHard = useMemo(() => 
    evaluacionesPropias.filter(e => e.tipoEvaluador === 'AUTO' && e.skillTipo === 'HARD'),
    [evaluacionesPropias]
  );

  const evalsAutoSoft = useMemo(() => 
    evaluacionesPropias.filter(e => e.tipoEvaluador === 'AUTO' && e.skillTipo === 'SOFT'),
    [evaluacionesPropias]
  );

  const evalsJefeHard = useMemo(() => 
    evaluacionesPropias.filter(e => e.tipoEvaluador === 'JEFE' && e.skillTipo === 'HARD'),
    [evaluacionesPropias]
  );

  const evalsJefeSoft = useMemo(() => 
    evaluacionesPropias.filter(e => e.tipoEvaluador === 'JEFE' && e.skillTipo === 'SOFT'),
    [evaluacionesPropias]
  );

  // Calcular seniority esperado según rol
  const seniorityEsperado: Seniority = useMemo(() => {
    if (currentUser.rol === 'Analista') return 'Junior';
    if (currentUser.rol === 'Lider') return 'Semi Senior';
    return 'Senior';
  }, [currentUser.rol]);

  // Transformar a datos de radar
  const radarDataAutoHard = useMemo(() => 
    transformarARadarData(evalsAutoHard, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea || currentUser.area),
    [evalsAutoHard, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea, currentUser.area]
  );

  const radarDataAutoSoft = useMemo(() => 
    transformarARadarData(evalsAutoSoft, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea || currentUser.area),
    [evalsAutoSoft, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea, currentUser.area]
  );

  const radarDataJefeHard = useMemo(() => 
    transformarARadarData(evalsJefeHard, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea || currentUser.area),
    [evalsJefeHard, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea, currentUser.area]
  );

  const radarDataJefeSoft = useMemo(() => 
    transformarARadarData(evalsJefeSoft, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea || currentUser.area),
    [evalsJefeSoft, skillsMatrix, seniorityEsperado, currentUser.rol, selectedArea, currentUser.area]
  );

  // Calcular promedios
  const promedioAuto = useMemo(() => {
    const allAuto = [...radarDataAutoHard, ...radarDataAutoSoft];
    return calcularPromedioGeneral(allAuto);
  }, [radarDataAutoHard, radarDataAutoSoft]);

  const promedioJefe = useMemo(() => {
    const allJefe = [...radarDataJefeHard, ...radarDataJefeSoft];
    return calcularPromedioGeneral(allJefe);
  }, [radarDataJefeHard, radarDataJefeSoft]);

  const promedioFinal = useMemo(() => 
    (promedioAuto + promedioJefe) / 2,
    [promedioAuto, promedioJefe]
  );

  const seniorityAlcanzado = useMemo(() => 
    calcularSeniorityAlcanzado(promedioFinal),
    [promedioFinal]
  );

  // Evolución temporal (últimos 6 meses) - Solo mostrar si hay más de un periodo
  const evolucionTemporal = useMemo(() => {
    const meses: { [key: string]: { auto: number[], jefe: number[] } } = {};
    
    evaluacionesPropias.forEach(e => {
      const fecha = new Date(e.fecha);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      
      if (!meses[mesKey]) {
        meses[mesKey] = { auto: [], jefe: [] };
      }
      
      if (e.tipoEvaluador === 'AUTO') {
        meses[mesKey].auto.push(e.puntaje);
      } else if (e.tipoEvaluador === 'JEFE') {
        meses[mesKey].jefe.push(e.puntaje);
      }
    });

    const datos = Object.keys(meses)
      .sort()
      .slice(-6)
      .map(mesKey => {
        const [year, month] = mesKey.split('-');
        const avgAuto = meses[mesKey].auto.length > 0 
          ? meses[mesKey].auto.reduce((a, b) => a + b, 0) / meses[mesKey].auto.length 
          : null;
        const avgJefe = meses[mesKey].jefe.length > 0 
          ? meses[mesKey].jefe.reduce((a, b) => a + b, 0) / meses[mesKey].jefe.length 
          : null;
        
        return {
          mes: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          auto: avgAuto ? parseFloat(avgAuto.toFixed(2)) : null,
          jefe: avgJefe ? parseFloat(avgJefe.toFixed(2)) : null,
          promedio: (avgAuto && avgJefe) ? parseFloat(((avgAuto + avgJefe) / 2).toFixed(2)) : null
        };
      });
    
    // Solo devolver datos si hay más de un periodo (permite comparación temporal)
    return datos.length > 1 ? datos : [];
  }, [evaluacionesPropias]);

  // Fortalezas y áreas de mejora
  const analisisSkills = useMemo(() => {
    const allSkills = [...radarDataAutoHard, ...radarDataAutoSoft, ...radarDataJefeHard, ...radarDataJefeSoft];
    const skillsAgrupadas = new Map<string, { promedios: number[], esperado: number, tipo: string }>();

    allSkills.forEach(skill => {
      if (!skillsAgrupadas.has(skill.skill)) {
        skillsAgrupadas.set(skill.skill, { 
          promedios: [], 
          esperado: skill.esperado || 0,
          tipo: skill.skill.includes('Hard') ? 'HARD' : 'SOFT'
        });
      }
      skillsAgrupadas.get(skill.skill)!.promedios.push(skill.promedio);
    });

    const resultados = Array.from(skillsAgrupadas.entries()).map(([skill, data]) => {
      const promedio = data.promedios.reduce((a, b) => a + b, 0) / data.promedios.length;
      const diferencia = promedio - data.esperado;
      return {
        skill,
        promedio: parseFloat(promedio.toFixed(2)),
        esperado: data.esperado,
        diferencia: parseFloat(diferencia.toFixed(2)),
        tipo: data.tipo
      };
    });

    const fortalezas = resultados
      .filter(r => r.diferencia >= 0.3)
      .sort((a, b) => b.diferencia - a.diferencia)
      .slice(0, 5);

    const mejoras = resultados
      .filter(r => r.diferencia < 0)
      .sort((a, b) => a.diferencia - b.diferencia)
      .slice(0, 5);

    return { fortalezas, mejoras };
  }, [radarDataAutoHard, radarDataAutoSoft, radarDataJefeHard, radarDataJefeSoft]);

  // Comentarios del líder
  const comentariosLider = useMemo(() => {
    return evaluacionesPropias
      .filter(e => e.tipoEvaluador === 'JEFE' && e.comentarios && e.comentarios.trim() !== '')
      .map(e => ({
        fecha: new Date(e.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        skill: e.skillNombre,
        comentario: e.comentarios,
        puntaje: e.puntaje
      }))
      .slice(0, 5);
  }, [evaluacionesPropias]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-stone-100">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Mi Desempeño</h1>
              <p className="text-stone-600">
                {currentUser.nombre} • {currentUser.rol} • {selectedArea || currentUser.area}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-stone-500 mb-1">Seniority Esperado</p>
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  {seniorityEsperado}
                </span>
              </div>
              <button
                onClick={logout}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar Sesión
                </span>
              </button>
            </div>
          </div>

          {/* Carrusel de áreas */}
          {areasDelAnalista.length > 1 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-semibold text-stone-700">Área:</span>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {areasDelAnalista.map(area => (
                  <button
                    key={area}
                    onClick={() => setSelectedArea(area)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                      selectedArea === area
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selector de Período */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-stone-700">📅 Período:</span>
            <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
              <button
                onClick={() => setFiltroModo('periodo')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filtroModo === 'periodo'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                📅 Períodos
              </button>
              <button
                onClick={() => setFiltroModo('rango')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filtroModo === 'rango'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                📆 Rango
              </button>
            </div>
            {filtroModo === 'periodo' ? (
              <select
                value={selectedPeriodo}
                onChange={(e) => setSelectedPeriodo(e.target.value as PeriodoType)}
                className="px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition text-sm"
              >
                {PERIODOS.map((periodo) => (
                  <option key={periodo.value} value={periodo.value}>
                    {periodo.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                />
                <span className="text-stone-400 text-sm">a</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Cards principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Promedio Auto */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-600">Mi Autopuntuación</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">{promedioAuto.toFixed(2)}</p>
          </div>

          {/* Promedio Líder */}
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-600">Evaluación Líder</p>
            </div>
            <p className="text-3xl font-bold text-orange-600">{promedioJefe.toFixed(2)}</p>
          </div>

          {/* Promedio Final */}
          <div className="bg-white rounded-xl shadow-sm border border-green-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-stone-600">Promedio Final</p>
            </div>
            <p className="text-3xl font-bold text-green-600">{promedioFinal.toFixed(2)}</p>
          </div>

          {/* Seniority Alcanzado */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-purple-700">Seniority Alcanzado</p>
            </div>
            <p className="text-2xl font-bold text-purple-700">{seniorityAlcanzado}</p>
          </div>
        </div>

        {/* Pentágonos con vista expandible */}
        {evaluacionesPropias.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span>Mis Competencias</span>
              </h2>
              <button
                onClick={() => setShowDetailedView(!showDetailedView)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition"
              >
                {showDetailedView ? '📊 Vista Compacta' : '🔍 Ver Detalle'}
              </button>
            </div>

            {!showDetailedView ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hard Skills */}
                {radarDataAutoHard.length > 0 && (
                  <div onClick={() => setShowDetailedView(true)} className="cursor-pointer hover:shadow-lg transition rounded-xl p-4 border border-blue-100">
                    <RadarChart data={radarDataAutoHard} title="Hard Skills" />
                  </div>
                )}
                {/* Soft Skills */}
                {radarDataAutoSoft.length > 0 && (
                  <div onClick={() => setShowDetailedView(true)} className="cursor-pointer hover:shadow-lg transition rounded-xl p-4 border border-purple-100">
                    <RadarChart data={radarDataAutoSoft} title="Soft Skills" />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Hard Skills detallado */}
                {(radarDataAutoHard.length > 0 || radarDataJefeHard.length > 0) && (
                  <div>
                    <h3 className="text-lg font-bold text-blue-700 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      Hard Skills
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {radarDataAutoHard.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-4">
                          <p className="text-sm font-semibold text-blue-700 mb-3">Mi Autoevaluación</p>
                          <RadarChart data={radarDataAutoHard} title="" />
                        </div>
                      )}
                      {radarDataJefeHard.length > 0 && (
                        <div className="bg-orange-50 rounded-xl p-4">
                          <p className="text-sm font-semibold text-orange-700 mb-3">Evaluación del Líder</p>
                          <RadarChart data={radarDataJefeHard} title="" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Soft Skills detallado */}
                {(radarDataAutoSoft.length > 0 || radarDataJefeSoft.length > 0) && (
                  <div>
                    <h3 className="text-lg font-bold text-purple-700 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      Soft Skills
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {radarDataAutoSoft.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-4">
                          <p className="text-sm font-semibold text-blue-700 mb-3">Mi Autoevaluación</p>
                          <RadarChart data={radarDataAutoSoft} title="" />
                        </div>
                      )}
                      {radarDataJefeSoft.length > 0 && (
                        <div className="bg-orange-50 rounded-xl p-4">
                          <p className="text-sm font-semibold text-orange-700 mb-3">Evaluación del Líder</p>
                          <RadarChart data={radarDataJefeSoft} title="" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Evolución Temporal */}
        {evolucionTemporal.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              Mi Evolución (últimos 6 meses)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucionTemporal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                />
                <ReferenceLine y={seniorityEsperado === 'Junior' ? 2.0 : seniorityEsperado === 'Semi Senior' ? 3.0 : 4.0} stroke="#7c3aed" strokeDasharray="5 5" strokeWidth={2} label={{ value: `Meta ${seniorityEsperado}`, fill: '#7c3aed', fontSize: 11 }} />
                <Line type="monotone" dataKey="auto" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Mi Puntuación" />
                <Line type="monotone" dataKey="jefe" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Evaluación Líder" />
                <Line type="monotone" dataKey="promedio" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} name="Promedio" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Mensaje informativo para primera evaluación */}
        {evaluacionesPropias.length > 0 && evolucionTemporal.length === 0 && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-purple-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-purple-900 mb-2">🎯 ¡Bienvenido a tu primera evaluación!</h4>
                <p className="text-sm text-purple-800 mb-3">
                  Este es tu punto de partida en el proceso de evaluación de desempeño. A partir de ahora, podrás seguir 
                  tu progreso y ver cómo evolucionan tus competencias a lo largo del tiempo.
                </p>
                <div className="bg-white/80 rounded-lg p-3 border border-purple-100">
                  <p className="text-xs text-stone-600">
                    💡 <strong>Tip:</strong> En tu próxima evaluación (dentro de 6 meses), esta vista mostrará gráficos de evolución 
                    donde podrás comparar tus resultados actuales con los de hoy. ¡Seguí trabajando en tu desarrollo profesional!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fortalezas y Áreas de Mejora */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fortalezas */}
          {analisisSkills.fortalezas.length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-sm border border-green-200 p-6">
              <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Mis Fortalezas
              </h3>
              <div className="space-y-3">
                {analisisSkills.fortalezas.map((skill, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900 text-sm">{skill.skill}</span>
                      <span className="text-xs font-bold text-green-600">+{skill.diferencia.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                      <span>Promedio: <strong className="text-green-600">{skill.promedio}</strong></span>
                      <span>•</span>
                      <span>Esperado: <strong>{skill.esperado}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Áreas de Mejora */}
          {analisisSkills.mejoras.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm border border-amber-200 p-6">
              <h3 className="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Áreas de Mejora
              </h3>
              <div className="space-y-3">
                {analisisSkills.mejoras.map((skill, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900 text-sm">{skill.skill}</span>
                      <span className="text-xs font-bold text-red-600">{skill.diferencia.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                      <span>Promedio: <strong className="text-orange-600">{skill.promedio}</strong></span>
                      <span>•</span>
                      <span>Esperado: <strong>{skill.esperado}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comentarios del Líder */}
        {comentariosLider.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              Feedback del Líder
            </h2>
            <div className="space-y-4">
              {comentariosLider.map((com, idx) => (
                <div key={idx} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-700">{com.skill}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500">{com.fecha}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                        {com.puntaje}/4
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-stone-700 italic">"{com.comentario}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensaje si no hay evaluaciones */}
        {evaluacionesPropias.length === 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-amber-900 text-lg font-semibold mb-2">No hay evaluaciones disponibles</p>
            <p className="text-amber-700 text-sm">Contactá a tu líder o RRHH para realizar tu evaluación de desempeño.</p>
          </div>
        )}
      </div>
    </div>
  );
}
