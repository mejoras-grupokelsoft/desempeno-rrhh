// src/components/MetricasLider.tsx
import { useMemo, useState, useRef, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell, ZAxis } from 'recharts';
import type { Evaluation, User } from '../types';
import { calcularSeniorityAlcanzado } from '../utils/calculations';
import { getUniqueEvaluados } from '../utils/filters';
import { filterByPeriod, comparePersonaBetweenPeriods, PERIODOS, type PeriodoType } from '../utils/dateUtils';
import { transformarARadarData, calcularPromedioGeneral } from '../utils/calculations';
import { useApp } from '../context/AppContext';
import { logger } from '../utils/sanitize';
import RadarChart from '../components/RadarChart';
import type { Seniority } from '../types';

// Función para normalizar texto (sin acentos, minúsculas)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

interface MetricasLiderProps {
  evaluations: Evaluation[];
  users: User[];
  skillsMatrix: any[];
  currentUser: User;
}

export default function MetricasLider({ evaluations, skillsMatrix, currentUser }: MetricasLiderProps) {
  const { logout } = useApp();

  // Estados para filtros
  const [subVista, setSubVista] = useState<'desempeno' | 'equipo'>('desempeno');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedPeriodo, setSelectedPeriodo] = useState<PeriodoType>('HISTORICO');
  const [filtroModo, setFiltroModo] = useState<'periodo' | 'rango'>('periodo');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filtrosCollapsed, setFiltrosCollapsed] = useState<boolean>(false);
  const [seniorityEsperado] = useState<Seniority>('Senior'); // Líder se espera que sea Senior
  const [selectedPersonChart, setSelectedPersonChart] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState<boolean>(false);
  const itemsPerPage = 10;

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Evaluaciones del equipo (personas que este líder evaluó)
  const evaluacionesEquipo = useMemo(() => {
    // Verificar si hay evaluaciones con evaluadorEmail
    const conEvaluadorEmail = evaluations.filter(e => 
      e.tipoEvaluador === 'JEFE' && e.evaluadorEmail && e.evaluadorEmail.trim() !== ''
    );
    
    if (conEvaluadorEmail.length > 0) {
      // Caso ideal: usar evaluadorEmail
      return conEvaluadorEmail.filter(e =>
        e.evaluadorEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
      );
    }
    
    // FALLBACK: evaluadorEmail no está siendo parseado por el backend
    // Usar área + origen como alternativa temporal
    logger.warn('El campo evaluadorEmail no está llegando desde el backend. Usando fallback por área + origen.');
    
    return evaluations.filter(e => {
      // Mostrar solo evaluaciones JEFE de tu área donde el origen sea LIDER
      // Y excluir evaluaciones donde TÚ eres el evaluado
      return (
        e.tipoEvaluador === 'JEFE' &&
        e.area === currentUser.area &&
        e.origen === 'LIDER' &&
        e.evaluadoEmail !== currentUser.email
      );
    });
  }, [evaluations, currentUser]);

  // Evaluaciones propias del líder
  const evaluacionesPropias = useMemo(() => {
    return evaluations.filter(e => e.evaluadoEmail === currentUser.email);
  }, [evaluations, currentUser]);

  // Aplicar filtros a evaluaciones del equipo
  const filteredEvaluacionesEquipo = useMemo(() => {
    let result: Evaluation[];
    
    if (filtroModo === 'periodo') {
      result = filterByPeriod(evaluacionesEquipo, selectedPeriodo);
    } else if (filtroModo === 'rango' && fechaInicio && fechaFin) {
      result = evaluacionesEquipo.filter(e => {
        const fecha = new Date(e.fecha);
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        return fecha >= inicio && fecha <= fin;
      });
    } else {
      result = evaluacionesEquipo;
    }

    if (selectedEmail) {
      result = result.filter((e) => e.evaluadoEmail === selectedEmail);
    }

    return result;
  }, [evaluacionesEquipo, selectedEmail, selectedPeriodo, filtroModo, fechaInicio, fechaFin]);

  // Datos para filtros
  const evaluados = useMemo(() => {
    return getUniqueEvaluados(evaluacionesEquipo);
  }, [evaluacionesEquipo]);

  // Filtrar evaluados por término de búsqueda
  const filteredEvaluados = useMemo(() => {
    if (!searchTerm.trim()) return evaluados;
    const normalized = normalizeText(searchTerm);
    return evaluados.filter(e => normalizeText(e.nombre).includes(normalized));
  }, [evaluados, searchTerm]);

  // Agrupar evaluaciones del equipo por persona
  const resultadosEquipo = useMemo(() => {
    const map = new Map<string, {
      email: string;
      nombre: string;
      area: string;
      rol: string;
      promedioAuto: number;
      promedioJefe: number;
      promedioFinal: number;
      seniorityAlcanzado: Seniority;
      gap: number;
    }>();

    const evalsPorEmail = new Map<string, Evaluation[]>();
    filteredEvaluacionesEquipo.forEach(e => {
      if (!evalsPorEmail.has(e.evaluadoEmail)) {
        evalsPorEmail.set(e.evaluadoEmail, []);
      }
      evalsPorEmail.get(e.evaluadoEmail)!.push(e);
    });

    evalsPorEmail.forEach((evals, email) => {
      // Para obtener TODAS las evaluaciones (AUTO + JEFE) de esta persona
      const todasEvaluaciones = evaluations.filter(e => e.evaluadoEmail === email);
      const evalsAuto = todasEvaluaciones.filter(e => e.tipoEvaluador === 'AUTO');
      const evalsJefe = todasEvaluaciones.filter(e => e.tipoEvaluador === 'JEFE');

      const promedioAuto = evalsAuto.length > 0
        ? evalsAuto.reduce((sum, e) => sum + e.puntaje, 0) / evalsAuto.length
        : 0;

      const promedioJefe = evalsJefe.length > 0
        ? evalsJefe.reduce((sum, e) => sum + e.puntaje, 0) / evalsJefe.length
        : 0;

      const promedioFinal = (promedioAuto + promedioJefe) / 2;
      const seniorityAlcanzado = calcularSeniorityAlcanzado(promedioFinal);
      const gap = Math.abs(promedioJefe - promedioAuto);

      const firstEval = evals[0];
      map.set(email, {
        email,
        nombre: `${firstEval.evaluadoNombre} ${firstEval.evaluadoApellido || ''}`.trim(),
        area: firstEval.area,
        rol: firstEval.origen,
        promedioAuto,
        promedioJefe,
        promedioFinal,
        seniorityAlcanzado,
        gap,
      });
    });

    // Excluir al usuario actual de los resultados
    return Array.from(map.values()).filter(r => r.email !== currentUser.email);
  }, [filteredEvaluacionesEquipo, evaluations, currentUser]);

  // Pentágonos propios
  const miRadarDataHard = useMemo(() => {
    const hardSkills = evaluacionesPropias.filter(e => e.skillTipo === 'HARD');
    return transformarARadarData(hardSkills, skillsMatrix, seniorityEsperado, currentUser.rol, currentUser.area);
  }, [evaluacionesPropias, skillsMatrix, seniorityEsperado, currentUser]);

  const miRadarDataSoft = useMemo(() => {
    const softSkills = evaluacionesPropias.filter(e => e.skillTipo === 'SOFT');
    return transformarARadarData(softSkills, skillsMatrix, seniorityEsperado, currentUser.rol, currentUser.area);
  }, [evaluacionesPropias, skillsMatrix, seniorityEsperado, currentUser]);

  // Combinar todos los datos para calcular el promedio general
  const allRadarData = useMemo(() => {
    return [...miRadarDataHard, ...miRadarDataSoft];
  }, [miRadarDataHard, miRadarDataSoft]);

  // Calcular datos propios del líder
  const miPromedioGeneral = useMemo(
    () => calcularPromedioGeneral(allRadarData),
    [allRadarData]
  );

  const miSeniorityAlcanzado = useMemo(
    () => calcularSeniorityAlcanzado(miPromedioGeneral),
    [miPromedioGeneral]
  );

  // Comparación trimestral propia
  const miComparacion = useMemo(() => {
    return comparePersonaBetweenPeriods(evaluacionesPropias);
  }, [evaluacionesPropias]);

  // Análisis de mejora/empeoramiento
  const analisisSkills = useMemo(() => {
    if (!miComparacion) return { mejoraron: [], iguales: [], empeoraron: [], nuevas: [] };
    
    const { qAnterior, qActual } = miComparacion;
    const mejoraron: string[] = [];
    const iguales: string[] = [];
    const empeoraron: string[] = [];
    const nuevas: string[] = [];

    qActual.forEach(actual => {
      const anterior = qAnterior.find(s => s.skill === actual.skill);
      if (!anterior) {
        nuevas.push(actual.skill);
      } else {
        const diff = actual.promedio - anterior.promedio;
        if (diff > 0.2) mejoraron.push(actual.skill);
        else if (diff < -0.2) empeoraron.push(actual.skill);
        else iguales.push(actual.skill);
      }
    });

    return { mejoraron, iguales, empeoraron, nuevas };
  }, [miComparacion]);

  // Análisis detallado para Hard/Soft Skills (similar a Director)
  const barrasComparacion = useMemo(() => {
    if (!miComparacion) return [];
    
    const { qAnterior, qActual } = miComparacion;
    const allSkills = new Set([...qAnterior.map(s => s.skill), ...qActual.map(s => s.skill)]);
    
    return Array.from(allSkills).map(skill => {
      const anterior = qAnterior.find(s => s.skill === skill);
      const actual = qActual.find(s => s.skill === skill);
      
      return {
        skillCompleto: skill,
        mejora: (actual?.promedio || 0) - (anterior?.promedio || 0),
        tipo: actual?.tipo || anterior?.tipo || 'HARD'
      };
    });
  }, [miComparacion]);

  // Datos para gráfico de línea
  const lineChartData = useMemo(() => {
    if (!miComparacion) return [];
    
    const { qAnterior, qActual } = miComparacion;
    const allSkills = new Set([...qAnterior.map(s => s.skill), ...qActual.map(s => s.skill)]);
    
    return Array.from(allSkills).map(skill => {
      const anterior = qAnterior.find(s => s.skill === skill);
      const actual = qActual.find(s => s.skill === skill);
      
      return {
        skill: skill.length > 15 ? skill.substring(0, 15) + '...' : skill,
        skillCompleto: skill,
        'Q Anterior': anterior?.promedio || 0,
        'Q Actual': actual?.promedio || 0,
        tipo: anterior?.tipo || actual?.tipo || 'HARD'
      };
    }).sort((a, b) => {
      const diffA = a['Q Actual'] - a['Q Anterior'];
      const diffB = b['Q Actual'] - b['Q Anterior'];
      return diffB - diffA; // Ordenar por mayor mejora
    });
  }, [miComparacion]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEmail, selectedPeriodo]);

  const handleResetFilters = () => {
    setSelectedEmail('');
    setSearchTerm('');
    setSelectedPeriodo('HISTORICO');
    setCurrentPage(1);
  };

  // Gráfico de línea para persona seleccionada del equipo
  const selectedPersonLineData = useMemo(() => {
    if (!selectedPersonChart) return null;
    
    const personEvals = evaluations.filter(e => e.evaluadoEmail === selectedPersonChart);
    if (personEvals.length === 0) return null;
    
    const comparison = comparePersonaBetweenPeriods(personEvals);
    if (!comparison) return null;
    
    const { qAnterior, qActual } = comparison;
    
    // Obtener ROL de la persona para saber su seniority esperado
    const personaInfo = resultadosEquipo.find(p => p.email === selectedPersonChart);
    const seniorityEsperadoPersona: Seniority = 
      personaInfo?.rol === 'ANALISTA' ? 'Junior' : 
      personaInfo?.rol === 'LIDER' ? 'Semi Senior' : 'Senior';
    
    // Mapear seniority a puntaje esperado
    const puntajeEsperado = 
      seniorityEsperadoPersona === 'Senior' ? 3.0 :
      seniorityEsperadoPersona === 'Semi Senior' ? 2.0 :
      seniorityEsperadoPersona === 'Junior' ? 1.0 : 0.0;
    
    // Separar por tipo de skill
    const hardSkills = new Set<string>();
    const softSkills = new Set<string>();
    
    [...qAnterior, ...qActual].forEach(s => {
      if (s.tipo === 'HARD') hardSkills.add(s.skill);
      else softSkills.add(s.skill);
    });
    
    const hardData = Array.from(hardSkills).map(skill => {
      const anterior = qAnterior.find(s => s.skill === skill && s.tipo === 'HARD');
      const actual = qActual.find(s => s.skill === skill && s.tipo === 'HARD');
      
      return {
        skill: skill.length > 20 ? skill.substring(0, 20) + '...' : skill,
        skillCompleto: skill,
        'Q Anterior': anterior?.promedio || 0,
        'Q Actual': actual?.promedio || 0
      };
    }).sort((a, b) => (b['Q Actual'] - b['Q Anterior']) - (a['Q Actual'] - a['Q Anterior']));
    
    const softData = Array.from(softSkills).map(skill => {
      const anterior = qAnterior.find(s => s.skill === skill && s.tipo === 'SOFT');
      const actual = qActual.find(s => s.skill === skill && s.tipo === 'SOFT');
      
      return {
        skill: skill.length > 20 ? skill.substring(0, 20) + '...' : skill,
        skillCompleto: skill,
        'Q Anterior': anterior?.promedio || 0,
        'Q Actual': actual?.promedio || 0
      };
    }).sort((a, b) => (b['Q Actual'] - b['Q Anterior']) - (a['Q Actual'] - a['Q Anterior']));
    
    return {
      nombre: personEvals[0].evaluadoNombre,
      hardData,
      softData,
      puntajeEsperado,
      seniorityEsperado: seniorityEsperadoPersona
    };
  }, [selectedPersonChart, evaluations, resultadosEquipo]);

  // Paginación
  const totalPages = Math.ceil(resultadosEquipo.length / itemsPerPage);
  const paginatedResultados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return resultadosEquipo
      .sort((a, b) => b.promedioFinal - a.promedioFinal)
      .slice(startIndex, endIndex);
  }, [resultadosEquipo, currentPage]);

  // Ocultar Mi Equipo para RRHH y Director
  const showEquipoSection = currentUser.rol !== 'RRHH' && currentUser.rol !== 'Director';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-stone-100">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Mi Equipo</h1>
              <p className="text-stone-600">
                {currentUser.nombre} • {currentUser.rol} • {currentUser.area}
              </p>
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
      </div>

      <div className="p-6 max-w-[1600px] mx-auto">
      {/* Botones de Navegación */}
      {showEquipoSection && (
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setSubVista('desempeno')}
          className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
            subVista === 'desempeno'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white text-slate-700 border border-stone-200 hover:border-purple-300 hover:bg-purple-50'
          }`}
        >
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Mi Desempeño
          </div>
        </button>
        <button
          onClick={() => setSubVista('equipo')}
          className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all ${
            subVista === 'equipo'
              ? 'bg-orange-600 text-white shadow-lg'
              : 'bg-white text-slate-700 border border-stone-200 hover:border-orange-300 hover:bg-orange-50'
          }`}
        >
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Mi Equipo ({resultadosEquipo.length})
          </div>
        </button>
      </div>
      )}

      {/* Sección: Mi Desempeño */}
      {(subVista === 'desempeno' || !showEquipoSection) && (
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-sm border border-purple-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          Mi Desempeño
        </h2>

        {/* Métricas Propias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
            <p className="text-sm font-semibold text-stone-500 mb-2">Promedio General</p>
            <p className="text-4xl font-bold text-slate-900">{miPromedioGeneral.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
            <p className="text-sm font-semibold text-stone-500 mb-2">Seniority Alcanzado</p>
            <p className="text-2xl font-bold text-purple-600">{miSeniorityAlcanzado}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
            <p className="text-sm font-semibold text-stone-500 mb-2">Seniority Esperado</p>
            <p className="text-2xl font-bold text-slate-700">{seniorityEsperado}</p>
          </div>
        </div>

        {/* Mensaje informativo para primera evaluación */}
        {evaluacionesPropias.length > 0 && !(analisisSkills.mejoraron.length > 0 || analisisSkills.empeoraron.length > 0 || analisisSkills.iguales.length > 0) && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-blue-900 mb-2">📊 Esta es tu evaluación inicial</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Este es tu punto de partida. En las próximas evaluaciones (cada 6 meses), podrás ver tu evolución y 
                  comparar tus resultados con evaluaciones anteriores.
                </p>
                <div className="bg-white/80 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-stone-600">
                    💡 <strong>Próximos pasos:</strong> Revisá tu promedio, las áreas donde destacás y las oportunidades de mejora. 
                    Coordiná con tu líder un plan de acción para alcanzar tus objetivos de desarrollo profesional.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Análisis de Mejora/Empeoramiento */}
        {evaluacionesPropias.length > 0 && (analisisSkills.mejoraron.length > 0 || analisisSkills.empeoraron.length > 0 || analisisSkills.iguales.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Mejoraron */}
            {analisisSkills.mejoraron.length > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-green-900">En qué mejoré ({analisisSkills.mejoraron.length})</h4>
                </div>
                <ul className="space-y-1.5">
                  {analisisSkills.mejoraron.slice(0, 5).map(skill => (
                    <li key={skill} className="text-xs text-green-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      {skill}
                    </li>
                  ))}
                  {analisisSkills.mejoraron.length > 5 && (
                    <li className="text-xs text-green-600 italic">+{analisisSkills.mejoraron.length - 5} más...</li>
                  )}
                </ul>
              </div>
            )}

            {/* Empeoraron - WARNING */}
            {analisisSkills.empeoraron.length > 0 && (
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl border-2 border-red-300 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-red-900">⚠️ Debería mejorar ({analisisSkills.empeoraron.length})</h4>
                </div>
                <ul className="space-y-1.5">
                  {analisisSkills.empeoraron.slice(0, 5).map(skill => (
                    <li key={skill} className="text-xs text-red-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      {skill}
                    </li>
                  ))}
                  {analisisSkills.empeoraron.length > 5 && (
                    <li className="text-xs text-red-600 italic">+{analisisSkills.empeoraron.length - 5} más...</li>
                  )}
                </ul>
              </div>
            )}

            {/* Iguales */}
            {analisisSkills.iguales.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-blue-900">Mantuve nivel ({analisisSkills.iguales.length})</h4>
                </div>
                <ul className="space-y-1.5">
                  {analisisSkills.iguales.slice(0, 5).map(skill => (
                    <li key={skill} className="text-xs text-blue-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      {skill}
                    </li>
                  ))}
                  {analisisSkills.iguales.length > 5 && (
                    <li className="text-xs text-blue-600 italic">+{analisisSkills.iguales.length - 5} más...</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Gráfico de Línea - Evolución de Skills */}
        {lineChartData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <span>Evolución de Competencias</span>
            </h3>
            <p className="text-xs text-stone-500 mb-6">Comparación entre el trimestre anterior y el actual, separado por tipo de competencia</p>

            {/* Hard Skills */}
            {lineChartData.filter(d => d.tipo === 'HARD').length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-800">Hard Skills</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData.filter(d => d.tipo === 'HARD')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="skill" 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis 
                      domain={[0, 5]} 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      label={{ value: 'Puntaje', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151' } }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.skillCompleto;
                        }
                        return label;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="Q Anterior" 
                      stroke="#93c5fd"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ fill: '#93c5fd', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      name="Q Anterior (Hard)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Q Actual" 
                      stroke="#1e40af" 
                      strokeWidth={3}
                      dot={{ fill: '#1e40af', r: 5, strokeWidth: 0 }}
                      activeDot={{ r: 7 }}
                      name="Q Actual (Hard)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Soft Skills */}
            {lineChartData.filter(d => d.tipo === 'SOFT').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-purple-50 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-800">Soft Skills</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData.filter(d => d.tipo === 'SOFT')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="skill" 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis 
                      domain={[0, 5]} 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      label={{ value: 'Puntaje', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151' } }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.skillCompleto;
                        }
                        return label;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="Q Anterior" 
                      stroke="#d8b4fe"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={{ fill: '#d8b4fe', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      name="Q Anterior (Soft)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Q Actual" 
                      stroke="#7c3aed" 
                      strokeWidth={3}
                      dot={{ fill: '#7c3aed', r: 5, strokeWidth: 0 }}
                      activeDot={{ r: 7 }}
                      name="Q Actual (Soft)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Pentágonos Propios con Detalle Expandible */}
        {evaluacionesPropias.length > 0 ? (
          <div className="space-y-6 mb-6">
            {/* Vista Compacta - Grid de 2 columnas */}
            {!showDetailedView && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {miRadarDataHard.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <span>Hard Skills</span>
                    </h3>
                    <RadarChart 
                      data={miRadarDataHard} 
                      title="Mis Hard Skills" 
                      onClick={() => setShowDetailedView(true)}
                    />
                  </div>
                )}
                {miRadarDataSoft.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span>Soft Skills</span>
                    </h3>
                    <RadarChart 
                      data={miRadarDataSoft} 
                      title="Mis Soft Skills"
                      onClick={() => setShowDetailedView(true)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Vista Detallada - Ambos Skills */}
            {showDetailedView && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700 border border-purple-200">
                      Vista Detallada Completa
                    </span>
                  </div>
                  <button
                    onClick={() => setShowDetailedView(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cerrar
                  </button>
                </div>

                {/* Hard Skills */}
                {miRadarDataHard.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                        Hard Skills
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <RadarChart data={miRadarDataHard} title="Mis Hard Skills" />
                      </div>
                  
                  {barrasComparacion.length > 0 && (
                    <div className="space-y-4">
                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <p className="text-xs font-semibold text-green-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Mejoras Destacadas
                        </p>
                        <div className="space-y-2">
                          {barrasComparacion
                            .filter(s => s.mejora > 0.3 && s.tipo === 'HARD')
                            .slice(0, 3)
                            .map((s, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-2">
                                <span className="text-xs text-stone-700 line-clamp-2" title={s.skillCompleto}>
                                  {s.skillCompleto}
                                </span>
                                <span className="text-xs font-bold text-green-600 whitespace-nowrap">+{s.mejora.toFixed(2)}</span>
                              </div>
                            ))}
                          {barrasComparacion.filter(s => s.mejora > 0.3 && s.tipo === 'HARD').length === 0 && (
                            <p className="text-xs text-stone-500">Sin mejoras significativas</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <p className="text-xs font-semibold text-red-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                          </svg>
                          Áreas de Atención
                        </p>
                        <div className="space-y-2">
                          {barrasComparacion
                            .filter(s => s.mejora < -0.1 && s.tipo === 'HARD')
                            .slice(0, 3)
                            .map((s, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-2">
                                <span className="text-xs text-stone-700 line-clamp-2" title={s.skillCompleto}>
                                  {s.skillCompleto}
                                </span>
                                <span className="text-xs font-bold text-red-600 whitespace-nowrap">{s.mejora.toFixed(2)}</span>
                              </div>
                            ))}
                          {barrasComparacion.filter(s => s.mejora < -0.1 && s.tipo === 'HARD').length === 0 && (
                            <p className="text-xs text-green-600 font-semibold">Todo bien!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                )}

                {/* Soft Skills */}
                {miRadarDataSoft.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                        Soft Skills
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <RadarChart data={miRadarDataSoft} title="Mis Soft Skills" />
                      </div>
                  
                  {barrasComparacion.length > 0 && (
                    <div className="space-y-4">
                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <p className="text-xs font-semibold text-green-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Mejoras Destacadas
                        </p>
                        <div className="space-y-2">
                          {barrasComparacion
                            .filter(s => s.mejora > 0.3 && s.tipo === 'SOFT')
                            .slice(0, 3)
                            .map((s, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-2">
                                <span className="text-xs text-stone-700 line-clamp-2" title={s.skillCompleto}>
                                  {s.skillCompleto}
                                </span>
                                <span className="text-xs font-bold text-green-600 whitespace-nowrap">+{s.mejora.toFixed(2)}</span>
                              </div>
                            ))}
                          {barrasComparacion.filter(s => s.mejora > 0.3 && s.tipo === 'SOFT').length === 0 && (
                            <p className="text-xs text-stone-500">Sin mejoras significativas</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <p className="text-xs font-semibold text-red-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                          </svg>
                          Áreas de Atención
                        </p>
                        <div className="space-y-2">
                          {barrasComparacion
                            .filter(s => s.mejora < -0.1 && s.tipo === 'SOFT')
                            .slice(0, 3)
                            .map((s, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-2">
                                <span className="text-xs text-stone-700 line-clamp-2" title={s.skillCompleto}>
                                  {s.skillCompleto}
                                </span>
                                <span className="text-xs font-bold text-red-600 whitespace-nowrap">{s.mejora.toFixed(2)}</span>
                              </div>
                            ))}
                          {barrasComparacion.filter(s => s.mejora < -0.1 && s.tipo === 'SOFT').length === 0 && (
                            <p className="text-xs text-green-600 font-semibold">Todo bien!</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-amber-900 text-lg font-semibold mb-2">
              No se encontraron evaluaciones propias
            </p>
            <p className="text-amber-700 text-sm">
              Tu email: <span className="font-mono bg-amber-100 px-2 py-1 rounded">{currentUser.email}</span>
            </p>
            <p className="text-amber-600 text-sm mt-2">
              Verificá que el email coincida con el de las evaluaciones en el CSV
            </p>
          </div>
        )}
      </div>
      )}

      {/* Sección: Mi Equipo */}
      {subVista === 'equipo' && showEquipoSection && (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100">
        <div className="p-6 border-b border-stone-100">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            Mi Equipo ({resultadosEquipo.length} personas)
          </h2>
        </div>

        {/* Filtros - Sticky con botón de colapsar */}
        <div className="sticky top-0 z-10 bg-stone-50">
          <div className="bg-white border-b border-stone-100">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filtros
              </h3>
              <button
                onClick={() => setFiltrosCollapsed(!filtrosCollapsed)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-all text-stone-600 hover:text-orange-600"
                title={filtrosCollapsed ? 'Expandir filtros' : 'Colapsar filtros'}
              >
                <svg className="w-5 h-5 transition-transform" style={{ transform: filtrosCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {!filtrosCollapsed && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-800 mb-3">
                      Filtro Temporal
                    </label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => setFiltroModo('periodo')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          filtroModo === 'periodo'
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-white text-stone-600 border border-stone-200 hover:border-orange-300'
                        }`}
                      >
                        📅 Periodos
                      </button>
                      <button
                        onClick={() => setFiltroModo('rango')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          filtroModo === 'rango'
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-white text-stone-600 border border-stone-200 hover:border-orange-300'
                        }`}
                      >
                        🗓️ Rango
                      </button>
                    </div>

                    {filtroModo === 'periodo' ? (
                      <select
                        value={selectedPeriodo}
                        onChange={(e) => setSelectedPeriodo(e.target.value as PeriodoType)}
                        className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white transition"
                      >
                        {PERIODOS.map((periodo) => (
                          <option key={periodo.value} value={periodo.value}>
                            {periodo.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            max={fechaFin || undefined}
                            placeholder="Desde"
                            className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white transition text-sm"
                          />
                        </div>
                        <div>
                          <input
                            type="date"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                            min={fechaInicio || undefined}
                            placeholder="Hasta"
                            className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white transition text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-sm font-semibold text-stone-800 mb-2">
                      Evaluado
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Buscar evaluado..."
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white transition"
                    />
                    {showDropdown && filteredEvaluados.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedEmail('');
                            setSearchTerm('');
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition text-sm font-semibold text-stone-600 border-b border-stone-100"
                        >
                          Todos los evaluados
                        </button>
                        {filteredEvaluados.map((evaluado) => (
                          <button
                            key={evaluado.email}
                            onClick={() => {
                              setSelectedEmail(evaluado.email);
                              setSearchTerm(evaluado.nombre);
                              setShowDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition text-sm text-stone-700"
                          >
                            <div className="font-medium">{evaluado.nombre}</div>
                            <div className="text-xs text-stone-500">{evaluado.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-all font-semibold text-sm"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Limpiar Filtros
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico de Bandas de Seniority - Mi Equipo */}
        {resultadosEquipo.length > 0 ? (
          <div className="p-6 pt-0 space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span>Bandas de Seniority - Mi Equipo ({resultadosEquipo.length} personas)</span>
              </h3>
              <p className="text-xs text-blue-700 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                Click en cualquier punto para ver el desglose de Hard y Soft Skills
              </p>
              
              {/* Leyenda de bandas */}
              <div className="flex flex-wrap gap-4 mb-4 justify-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fef3c7' }}></div>
                  <span className="text-stone-600">Trainee (0-1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#bfdbfe' }}></div>
                  <span className="text-stone-600">Junior (1-2)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#a5f3fc' }}></div>
                  <span className="text-stone-600">Semi Senior (2-3)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: '#bbf7d0' }}></div>
                  <span className="text-stone-600">Senior (3-4)</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 80, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  
                  {/* Bandas de color para los rangos de seniority */}
                  <ReferenceArea y1={0} y2={1} fill="#fef3c7" fillOpacity={0.6} />
                  <ReferenceArea y1={1} y2={2} fill="#bfdbfe" fillOpacity={0.6} />
                  <ReferenceArea y1={2} y2={3} fill="#a5f3fc" fillOpacity={0.6} />
                  <ReferenceArea y1={3} y2={4} fill="#bbf7d0" fillOpacity={0.6} />
                  
                  {/* Líneas de referencia */}
                  <ReferenceLine y={1} stroke="#78350f" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={2} stroke="#1e40af" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine y={3} stroke="#0e7490" strokeDasharray="3 3" strokeWidth={1} />
                  
                  <XAxis 
                    type="number"
                    dataKey="x"
                    tick={{ fontSize: 11, fill: '#334155' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    domain={[0, resultadosEquipo.length - 1]}
                    ticks={resultadosEquipo.map((_, i) => i)}
                    tickFormatter={(value) => {
                      const persona = resultadosEquipo[value];
                      return persona ? persona.nombre.split(' ')[0] : '';
                    }}
                  />
                  <YAxis 
                    type="number"
                    dataKey="y"
                    domain={[0, 5]} 
                    tick={{ fontSize: 11, fill: '#334155' }}
                    label={{ value: 'Puntaje Promedio', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#334155' } }}
                  />
                  <ZAxis range={[100, 200]} />
                  
                  <RechartsTooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '2px solid #3b82f6', 
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '8px'
                    }}
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border-2 border-blue-400">
                            <p className="font-bold text-slate-900 mb-1">{data.nombre}</p>
                            <p className="text-xs text-slate-600">Promedio: <span className="font-semibold text-blue-600">{data.y.toFixed(2)}</span></p>
                            <p className="text-xs text-slate-600">Seniority: <span className="font-semibold text-purple-600">{data.seniorityAlcanzado}</span></p>
                            <p className="text-xs text-amber-600 mt-2">Click para ver detalle</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  <Scatter 
                    name="Mi Equipo"
                    data={resultadosEquipo.map((persona, index) => ({
                      ...persona,
                      x: index,
                      y: persona.promedioFinal
                    }))}
                    fill="#3b82f6"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={8}
                          fill="#3b82f6"
                          stroke="white"
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPersonChart(payload.email);
                          }}
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Gráficos de Barras para Persona Seleccionada */}
            {selectedPersonLineData && (selectedPersonLineData.hardData.length > 0 || selectedPersonLineData.softData.length > 0) && (
              <div className="space-y-4">
                {/* Header con info de la persona */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-md font-bold text-slate-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Desglose: {selectedPersonLineData.nombre}</span>
                      </h4>
                      <div className="flex items-center gap-3 text-xs mt-1">
                        <span className="text-blue-600">Seniority:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700">
                          {selectedPersonLineData.seniorityEsperado}
                        </span>
                        <span className="text-blue-500">|</span>
                        <span className="text-blue-600">Meta:</span>
                        <span className="text-purple-700 font-bold">{selectedPersonLineData.puntajeEsperado.toFixed(1)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPersonChart(null)}
                      className="px-3 py-1.5 bg-white rounded-lg text-sm font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 transition"
                    >
                      ✕ Cerrar
                    </button>
                  </div>
                </div>

                {/* Hard y Soft Skills lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Hard Skills */}
                  {selectedPersonLineData.hardData.length > 0 && (
                    <div className="bg-white rounded-xl border border-blue-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <h5 className="text-sm font-bold text-slate-900">Hard Skills</h5>
                      </div>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={selectedPersonLineData.hardData} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                          <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: '#3b82f6' }} />
                          <YAxis 
                            type="category" 
                            dataKey="skill" 
                            tick={{ fontSize: 9, fill: '#1e40af' }}
                            width={95}
                          />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '11px' }}
                            labelFormatter={(label, payload) => payload && payload[0] ? payload[0].payload.skillCompleto : label}
                          />
                          <ReferenceLine 
                            x={selectedPersonLineData.puntajeEsperado} 
                            stroke="#7c3aed" 
                            strokeWidth={2}
                            strokeDasharray="4 4"
                          />
                          <Bar dataKey="Q Anterior" fill="#cbd5e1" radius={[0, 3, 3, 0]} />
                          <Bar dataKey="Q Actual" fill="#3b82f6" radius={[0, 3, 3, 0]}>
                            {selectedPersonLineData.hardData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry['Q Actual'] >= selectedPersonLineData.puntajeEsperado ? '#10b981' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Soft Skills */}
                  {selectedPersonLineData.softData.length > 0 && (
                    <div className="bg-white rounded-xl border border-purple-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h5 className="text-sm font-bold text-slate-900">Soft Skills</h5>
                      </div>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={selectedPersonLineData.softData} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
                          <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: '#9333ea' }} />
                          <YAxis 
                            type="category" 
                            dataKey="skill" 
                            tick={{ fontSize: 9, fill: '#6b21a8' }}
                            width={95}
                          />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #d8b4fe', borderRadius: '6px', fontSize: '11px' }}
                            labelFormatter={(label, payload) => payload && payload[0] ? payload[0].payload.skillCompleto : label}
                          />
                          <ReferenceLine 
                            x={selectedPersonLineData.puntajeEsperado} 
                            stroke="#7c3aed" 
                            strokeWidth={2}
                            strokeDasharray="4 4"
                          />
                          <Bar dataKey="Q Anterior" fill="#cbd5e1" radius={[0, 3, 3, 0]} />
                          <Bar dataKey="Q Actual" fill="#9333ea" radius={[0, 3, 3, 0]}>
                            {selectedPersonLineData.softData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry['Q Actual'] >= selectedPersonLineData.puntajeEsperado ? '#10b981' : '#9333ea'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Leyenda unificada */}
                <div className="flex items-center justify-center gap-6 text-xs bg-stone-50 rounded-lg py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-300 rounded"></div>
                    <span className="text-stone-600">Q Anterior</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-stone-600">Hard Actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                    <span className="text-stone-600">Soft Actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-stone-600">Dentro del rango</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-purple-600 border-dashed rounded"></div>
                    <span className="text-stone-600">Meta {selectedPersonLineData.puntajeEsperado.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 pt-0">
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
              <p className="text-amber-900 font-semibold">No hay datos del equipo para mostrar</p>
              <p className="text-amber-700 text-sm mt-2">Verificá que haya evaluaciones de tu equipo en Google Sheets</p>
              <p className="text-amber-600 text-xs mt-2">Email actual: {currentUser.email}</p>
            </div>
          </div>
        )}

        {/* Tabla de Equipo */}
        <div className="p-6 overflow-x-auto">
          {resultadosEquipo.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-stone-200">
                    <th className="text-left p-3 font-bold text-stone-700">Nombre</th>
                    <th className="text-left p-3 font-bold text-stone-700">Área</th>
                    <th className="text-left p-3 font-bold text-stone-700">Rol</th>
                    <th className="text-center p-3 font-bold text-stone-700">Fecha</th>
                    <th className="text-center p-3 font-bold text-stone-700">Auto</th>
                    <th className="text-center p-3 font-bold text-stone-700">Mi Evaluación</th>
                    <th className="text-center p-3 font-bold text-stone-700">Final</th>
                    <th className="text-center p-3 font-bold text-stone-700">Seniority</th>
                    <th className="text-center p-3 font-bold text-stone-700">Gap</th>
                  </tr>
                </thead>
                <tbody>
              {paginatedResultados.map((persona) => (
                <tr 
                  key={persona.email}
                  className="border-b border-stone-100 hover:bg-purple-50 transition"
                >
                  <td className="p-3 font-medium text-slate-900">{persona.nombre}</td>
                  <td className="p-3 text-stone-600">{persona.area}</td>
                  <td className="p-3 text-stone-600">{persona.rol}</td>
                  <td className="text-center p-3 text-xs text-stone-600">
                    {(() => {
                      const evalsPersona = filteredEvaluacionesEquipo.filter(e => e.evaluadoEmail === persona.email);
                      if (evalsPersona.length === 0) return '-';
                      const fechas = evalsPersona.map(e => new Date(e.fecha));
                      const fechaMasReciente = new Date(Math.max(...fechas.map(f => f.getTime())));
                      return fechaMasReciente.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
                    })()}
                  </td>
                  <td className="text-center p-3 font-semibold text-blue-600">{persona.promedioAuto.toFixed(2)}</td>
                  <td className="text-center p-3 font-semibold text-orange-600">{persona.promedioJefe.toFixed(2)}</td>
                  <td className="text-center p-3 font-bold text-slate-900">{persona.promedioFinal.toFixed(2)}</td>
                  <td className="text-center p-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      persona.seniorityAlcanzado === 'Senior' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                      persona.seniorityAlcanzado === 'Semi Senior' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                      persona.seniorityAlcanzado === 'Junior' ? 'bg-stone-100 text-stone-600 border border-stone-200' :
                      'bg-stone-50 text-stone-500 border border-stone-100'
                    }`}>
                      {persona.seniorityAlcanzado}
                    </span>
                  </td>
                  <td className="text-center p-3">
                    <span className={`font-bold ${
                      persona.gap > 1 ? 'text-orange-600' :
                      persona.gap > 0.5 ? 'text-slate-600' :
                      'text-stone-500'
                    }`}>
                      {persona.gap.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Controles de paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-200">
              <div className="text-sm text-stone-600">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, resultadosEquipo.length)} de {resultadosEquipo.length} resultados
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 font-semibold text-sm hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg font-semibold text-sm transition ${
                        currentPage === page
                          ? 'bg-purple-500 text-white'
                          : 'border border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 font-semibold text-sm hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
            </>
          ) : (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-amber-900 text-lg font-semibold mb-2">
                No hay evaluaciones de equipo para mostrar
              </p>
              <p className="text-amber-700 text-sm mt-4">
                ¿Necesitás ver más información? Contactate con el equipo de Capital Humano:
              </p>
              <p className="text-amber-800 text-sm font-semibold mt-2">
                📧 capitalhumano@kelsoft.com
              </p>
            </div>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
