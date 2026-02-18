// src/components/Dashboard.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { filterEvaluationsByRole, getUniqueAreas, getUniqueEvaluados, canSeeAll, getUniqueHardSkillAreas } from '../utils/filters';
import {
  transformarARadarData,
  calcularPromedioGeneral,
  calcularSeniorityAlcanzado,
  calcularEvolucionTrimestral,
} from '../utils/calculations';
import { filterByPeriod, comparePersonaBetweenPeriods, PERIODOS, type PeriodoType } from '../utils/dateUtils';
import { generarPDFIndividual, type PDFReporteData } from '../utils/pdfGenerator';
import RadarChart from '../components/RadarChart';
import DumbbellChart, { type DumbbellDataPoint } from '../components/DumbbellChart';
import EvolucionChart from '../components/EvolucionChart';
import MetricasRRHH from '../components/MetricasRRHH';
import MetricasLider from '../components/MetricasLider';
import type { Seniority } from '../types';

type VistaType = 'individual' | 'metricas' | 'equipo';

// Función para normalizar texto (sin acentos, minúsculas)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function Dashboard() {
  const { currentUser, users, evaluations, skillsMatrix, logout } = useApp();
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [seniorityEsperado] = useState<Seniority>('Junior');
  const [hasAutoSelected, setHasAutoSelected] = useState<boolean>(false);
  
  // Vista inicial depende del rol
  const [vista, setVista] = useState<VistaType>(
    currentUser?.rol === 'Lider' ? 'equipo' : 'individual'
  );
  
  const [selectedFormulario, setSelectedFormulario] = useState<'LIDER' | 'ANALISTA' | ''>(''); // '' = ambos
  const [selectedPeriodo, setSelectedPeriodo] = useState<PeriodoType>('HISTORICO');
  const [hardSkillAreaIndexLider, setHardSkillAreaIndexLider] = useState<number>(0);
  const [hardSkillAreaIndexAnalista, setHardSkillAreaIndexAnalista] = useState<number>(0);
  const [filtrosCollapsed, setFiltrosCollapsed] = useState<boolean>(false);
  const [showPDFModal, setShowPDFModal] = useState<boolean>(false);
  const [comentarioRRHH, setComentarioRRHH] = useState<string>('');

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

  if (!currentUser) return null;

  // Filtrar evaluaciones según permisos
  const visibleEvaluations = useMemo(
    () => filterEvaluationsByRole(evaluations, currentUser),
    [evaluations, currentUser]
  );

  // Aplicar filtros adicionales
  const filteredEvaluations = useMemo(() => {
    // Primero filtrar por período
    let result = filterByPeriod(visibleEvaluations, selectedPeriodo);

    if (selectedArea) {
      result = result.filter((e) => e.area === selectedArea);
    }

    if (selectedEmail) {
      result = result.filter((e) => e.evaluadoEmail === selectedEmail);
    }

    return result;
  }, [visibleEvaluations, selectedArea, selectedEmail, selectedPeriodo]);

  // Obtener datos para filtros
  const areas = useMemo(() => {
    if (selectedEmail) {
      // Si hay evaluado seleccionado, mostrar solo su área
      const evalsPorEmail = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
      return getUniqueAreas(evalsPorEmail);
    }
    return getUniqueAreas(visibleEvaluations);
  }, [visibleEvaluations, selectedEmail]);
  
  const evaluados = useMemo(() => {
    const evals = selectedArea
      ? visibleEvaluations.filter(e => e.area === selectedArea)
      : visibleEvaluations;
    return getUniqueEvaluados(evals);
  }, [visibleEvaluations, selectedArea]);

  // Filtrar evaluados por término de búsqueda
  const filteredEvaluados = useMemo(() => {
    if (!searchTerm.trim()) return evaluados;
    const normalized = normalizeText(searchTerm);
    return evaluados.filter(e => normalizeText(e.nombre).includes(normalized));
  }, [evaluados, searchTerm]);

  // Seleccionar automáticamente el primer evaluado en la carga inicial
  useEffect(() => {
    if (!hasAutoSelected && !selectedEmail && evaluados.length > 0) {
      const firstEvaluado = evaluados[0];
      setSelectedEmail(firstEvaluado.email);
      setSearchTerm(firstEvaluado.nombre);
      setHasAutoSelected(true);
    }
  }, [evaluados, selectedEmail, hasAutoSelected]);

  // Resetear email seleccionado si ya no está en la lista de evaluados (por cambio de filtros)
  useEffect(() => {
    if (selectedEmail && evaluados.length > 0) {
      const isStillAvailable = evaluados.some(e => e.email === selectedEmail);
      if (!isStillAvailable) {
        // El evaluado seleccionado ya no está disponible, seleccionar el primero de la nueva lista
        const firstEvaluado = evaluados[0];
        setSelectedEmail(firstEvaluado.email);
        setSearchTerm(firstEvaluado.nombre);
      }
    }
  }, [evaluados, selectedEmail]);

  const mostrarEvaluado = evaluados.find(e => e.email === selectedEmail);
  
  // ===== EVALUACIONES DE LÍDER =====
  // Áreas únicas de Hard Skills para el carrusel de Líder
  const hardSkillAreasLider = useMemo(() => {
    const allHard = filteredEvaluations.filter(e => e.skillTipo === 'HARD' && e.origen === 'LIDER');
    const hardByEmail = selectedEmail
      ? allHard.filter(e => e.evaluadoEmail === selectedEmail)
      : allHard;
    return getUniqueHardSkillAreas(hardByEmail);
  }, [filteredEvaluations, selectedEmail]);

  // Hard Skills de Líder
  const hardSkillsLider = useMemo(() => {
    const hard = filteredEvaluations.filter(e => e.skillTipo === 'HARD' && e.origen === 'LIDER');
    const hardByEmail = selectedEmail
      ? hard.filter(e => e.evaluadoEmail === selectedEmail)
      : hard;
    
    if (hardSkillAreasLider.length > 0) {
      const currentArea = hardSkillAreasLider[hardSkillAreaIndexLider];
      return hardByEmail.filter(e => e.area === currentArea);
    }
    return hardByEmail;
  }, [filteredEvaluations, hardSkillAreasLider, hardSkillAreaIndexLider, selectedEmail]);

  // Soft Skills de Líder
  const softSkillsLider = useMemo(() => {
    const soft = filteredEvaluations.filter(e => e.skillTipo === 'SOFT' && e.origen === 'LIDER');
    return selectedEmail
      ? soft.filter(e => e.evaluadoEmail === selectedEmail)
      : soft;
  }, [filteredEvaluations, selectedEmail]);

  // ===== EVALUACIONES DE ANALISTA =====
  // Áreas únicas de Hard Skills para el carrusel de Analista
  const hardSkillAreasAnalista = useMemo(() => {
    const allHard = filteredEvaluations.filter(e => e.skillTipo === 'HARD' && e.origen === 'ANALISTA');
    const hardByEmail = selectedEmail
      ? allHard.filter(e => e.evaluadoEmail === selectedEmail)
      : allHard;
    return getUniqueHardSkillAreas(hardByEmail);
  }, [filteredEvaluations, selectedEmail]);

  // Hard Skills de Analista
  const hardSkillsAnalista = useMemo(() => {
    const hard = filteredEvaluations.filter(e => e.skillTipo === 'HARD' && e.origen === 'ANALISTA');
    const hardByEmail = selectedEmail
      ? hard.filter(e => e.evaluadoEmail === selectedEmail)
      : hard;
    
    if (hardSkillAreasAnalista.length > 0) {
      const currentArea = hardSkillAreasAnalista[hardSkillAreaIndexAnalista];
      return hardByEmail.filter(e => e.area === currentArea);
    }
    return hardByEmail;
  }, [filteredEvaluations, hardSkillAreasAnalista, hardSkillAreaIndexAnalista, selectedEmail]);

  // Soft Skills de Analista
  const softSkillsAnalista = useMemo(() => {
    const soft = filteredEvaluations.filter(e => e.skillTipo === 'SOFT' && e.origen === 'ANALISTA');
    return selectedEmail
      ? soft.filter(e => e.evaluadoEmail === selectedEmail)
      : soft;
  }, [filteredEvaluations, selectedEmail]);

  // Transformar datos para el radar - Líder
  const radarDataHardLider = useMemo(() => {
    if (hardSkillsLider.length === 0) return [];
    const firstEval = hardSkillsLider[0];
    return transformarARadarData(
      hardSkillsLider,
      skillsMatrix,
      seniorityEsperado,
      'Líder',
      firstEval.area
    );
  }, [hardSkillsLider, skillsMatrix, seniorityEsperado]);

  const radarDataSoftLider = useMemo(() => {
    if (softSkillsLider.length === 0) return [];
    const firstEval = softSkillsLider[0];
    return transformarARadarData(
      softSkillsLider,
      skillsMatrix,
      seniorityEsperado,
      'Líder',
      firstEval.area
    );
  }, [softSkillsLider, skillsMatrix, seniorityEsperado]);

  // Transformar datos para el radar - Analista
  const radarDataHardAnalista = useMemo(() => {
    if (hardSkillsAnalista.length === 0) return [];
    const firstEval = hardSkillsAnalista[0];
    return transformarARadarData(
      hardSkillsAnalista,
      skillsMatrix,
      seniorityEsperado,
      'Analista',
      firstEval.area
    );
  }, [hardSkillsAnalista, skillsMatrix, seniorityEsperado]);

  const radarDataSoftAnalista = useMemo(() => {
    if (softSkillsAnalista.length === 0) return [];
    const firstEval = softSkillsAnalista[0];
    return transformarARadarData(
      softSkillsAnalista,
      skillsMatrix,
      seniorityEsperado,
      'Analista',
      firstEval.area
    );
  }, [softSkillsAnalista, skillsMatrix, seniorityEsperado]);

  // Calcular métricas del promedio general (HARD + SOFT de ambos orígenes)
  const allRadarData = [...radarDataHardLider, ...radarDataSoftLider, ...radarDataHardAnalista, ...radarDataSoftAnalista];
  const promedioGeneral = useMemo(() => calcularPromedioGeneral(allRadarData), [allRadarData]);
  const seniorityAlcanzado = useMemo(
    () => calcularSeniorityAlcanzado(promedioGeneral),
    [promedioGeneral]
  );


  // Comparación trimestral (Q anterior vs Q actual) solo si hay un evaluado seleccionado
  const comparacionTrimestral = useMemo(() => {
    if (!selectedEmail) return null;
    
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    return comparePersonaBetweenPeriods(evalsPersona);
  }, [selectedEmail, visibleEvaluations]);

  // Preparar datos para gráfico de barras apiladas
  const barrasComparacion = useMemo(() => {
    if (!comparacionTrimestral) return [];
    
    const { qAnterior, qActual } = comparacionTrimestral;
    
    // Combinar skills de ambos períodos
    const allSkills = new Set([
      ...qAnterior.map(s => s.skill),
      ...qActual.map(s => s.skill)
    ]);
    
    return Array.from(allSkills).map(skill => {
      const anterior = qAnterior.find(s => s.skill === skill);
      const actual = qActual.find(s => s.skill === skill);
      
      return {
        skill: skill.length > 15 ? skill.substring(0, 15) + '...' : skill,
        skillCompleto: skill,
        'Q Anterior': anterior?.promedio || 0,
        'Q Actual': actual?.promedio || 0,
        tipo: anterior?.tipo || actual?.tipo || 'HARD',
        mejora: (actual?.promedio || 0) - (anterior?.promedio || 0)
      };
    }).sort((a, b) => b.mejora - a.mejora); // Ordenar por mejora descendente
  }, [comparacionTrimestral]);

  // Datos para el Dumbbell Chart: combina comparación trimestral con esperado directo de skillsMatrix
  const dumbbellData = useMemo((): DumbbellDataPoint[] => {
    if (!comparacionTrimestral || !selectedEmail) return [];
    const { qAnterior, qActual } = comparacionTrimestral;

    const allSkills = new Set([
      ...qAnterior.map(s => s.skill),
      ...qActual.map(s => s.skill)
    ]);

    // Obtener area del usuario seleccionado
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const area = evalsPersona.length > 0 ? evalsPersona[0].area : '';

    return Array.from(allSkills).map(skill => {
      const anterior = qAnterior.find(s => s.skill === skill);
      const actual = qActual.find(s => s.skill === skill);

      // Calcular esperado directamente desde skillsMatrix (no depende de filtros)
      const matchSkill = skillsMatrix.find(
        s => s.skillNombre === skill && s.seniority === seniorityEsperado && s.area === area
      );

      return {
        skill,
        autoAnterior: anterior?.auto || 0,
        jefeAnterior: anterior?.jefe || 0,
        autoActual: actual?.auto || 0,
        jefeActual: actual?.jefe || 0,
        esperado: matchSkill?.valorEsperado || 0,
      };
    });
  }, [comparacionTrimestral, selectedEmail, visibleEvaluations, skillsMatrix, seniorityEsperado]);

  // Datos para el gráfico de evolución trimestral (múltiples Q)
  const evolucionData = useMemo(() => {
    if (!selectedEmail) return [];
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const area = evalsPersona.length > 0 ? evalsPersona[0].area : '';
    return calcularEvolucionTrimestral(evalsPersona, skillsMatrix, seniorityEsperado, area);
  }, [selectedEmail, visibleEvaluations, skillsMatrix, seniorityEsperado]);

  const handleResetFilters = () => {
    setSelectedArea('');
    setSelectedEmail('');
    setSelectedFormulario('');
    setSelectedPeriodo('HISTORICO');
    setHardSkillAreaIndexLider(0);
    setHardSkillAreaIndexAnalista(0);
  };

  // ===== GENERAR PDF INDIVIDUAL =====
  const handleDescargarPDF = () => {
    if (!selectedEmail || !mostrarEvaluado) return;

    const evalsPersona = filteredEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const evalsHard = evalsPersona.filter(e => e.skillTipo === 'HARD');
    const evalsSoft = evalsPersona.filter(e => e.skillTipo === 'SOFT');

    // Derivar area y rol de las evaluaciones
    const firstEval = evalsPersona[0];
    const evalArea = firstEval?.area || '';
    const evalRol = firstEval?.origen === 'LIDER' ? 'Líder' : 'Analista';

    const radarDataHard = transformarARadarData(evalsHard, skillsMatrix, seniorityEsperado, 'Analista', evalArea);
    const radarDataSoft = transformarARadarData(evalsSoft, skillsMatrix, seniorityEsperado, 'Analista', evalArea);

    // Líder evaluador
    const evalJefe = evalsPersona.find(e => e.tipoEvaluador === 'JEFE');
    const liderEmail = evalJefe?.evaluadorEmail || '';
    const liderUser = users.find(u => u.email === liderEmail);
    const liderNombre = liderUser?.nombre || liderEmail || 'No asignado';

    // Período evaluado
    const periodoObj = PERIODOS.find(p => p.value === selectedPeriodo);
    const periodoLabel = periodoObj?.label || 'Histórico';

    // Evolución Q anterior vs actual
    let evolucion: PDFReporteData['evolucion'] = undefined;
    const allEvals = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const comp = comparePersonaBetweenPeriods(allEvals);
    if (comp.qAnterior.length > 0 && comp.qActual.length > 0) {
      const promAnt = comp.qAnterior.reduce((s, c) => s + c.promedio, 0) / comp.qAnterior.length;
      const promAct = comp.qActual.reduce((s, c) => s + c.promedio, 0) / comp.qActual.length;
      const diff = promAct - promAnt;
      evolucion = {
        promedioAnterior: promAnt,
        promedioActual: promAct,
        tendencia: diff > 0.15 ? 'mejora' : diff < -0.15 ? 'descenso' : 'estable',
      };
    }

    // Comentarios del líder
    const comentarios = evalsPersona
      .filter(e => e.tipoEvaluador === 'JEFE' && e.comentarios && e.comentarios.trim() !== '')
      .map(e => ({
        fecha: new Date(e.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }),
        skill: e.skillNombre,
        comentario: e.comentarios!,
        puntaje: e.puntaje,
      }));

    const pdfData: PDFReporteData = {
      evaluadoNombre: mostrarEvaluado.nombre,
      evaluadoEmail: selectedEmail,
      rol: evalRol,
      area: evalArea,
      periodoEvaluado: periodoLabel,
      liderEvaluadorNombre: liderNombre,
      promedioGeneral,
      seniorityAlcanzado,
      radarDataHard,
      radarDataSoft,
      evolucion,
      seniorityEsperado,
      comentarios,
      comentarioRRHH: comentarioRRHH.trim() || undefined,
    };

    const pdf = generarPDFIndividual(pdfData);
    const nombreArchivo = `Evaluacion_${mostrarEvaluado.nombre.replace(/\s+/g, '_')}.pdf`;
    pdf.save(nombreArchivo);
    setShowPDFModal(false);
    setComentarioRRHH('');
  };

  const handlePrevAreaLider = () => {
    setHardSkillAreaIndexLider((prev) => (prev === 0 ? hardSkillAreasLider.length - 1 : prev - 1));
  };

  const handleNextAreaLider = () => {
    setHardSkillAreaIndexLider((prev) => (prev === hardSkillAreasLider.length - 1 ? 0 : prev + 1));
  };

  const handlePrevAreaAnalista = () => {
    setHardSkillAreaIndexAnalista((prev) => (prev === 0 ? hardSkillAreasAnalista.length - 1 : prev - 1));
  };

  const handleNextAreaAnalista = () => {
    setHardSkillAreaIndexAnalista((prev) => (prev === hardSkillAreasAnalista.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard RRHH</h1>
              <p className="text-sm text-stone-500">
                {currentUser.nombre} · {currentUser.rol} · {currentUser.area}
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
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs para alternar vista */}
        <div className="mb-6 flex flex-wrap gap-2">
          {/* Vista Individual - Todos pueden verla */}
          {canSeeAll(currentUser.rol) && (
            <button
              onClick={() => setVista('individual')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                vista === 'individual'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Vista Individual
              </span>
            </button>
          )}

          {/* Mi Equipo - Solo Lider */}
          {currentUser.rol === 'Lider' && (
            <button
              onClick={() => setVista('equipo')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                vista === 'equipo'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-stone-700 hover:bg-purple-50 border border-stone-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Mi Equipo
              </span>
            </button>
          )}

          {/* Métricas Generales - Solo RRHH y Director */}
          {canSeeAll(currentUser.rol) && (
            <button
              onClick={() => setVista('metricas')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                vista === 'metricas'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Métricas Generales
              </span>
            </button>
          )}
        </div>

        {/* Vista de Mi Equipo (Solo Lider) */}
        {vista === 'equipo' && currentUser.rol === 'Lider' ? (
          <MetricasLider
            evaluations={visibleEvaluations}
            users={users}
            skillsMatrix={skillsMatrix}
            currentUser={currentUser}
          />
        ) : null}

        {/* Vista de Métricas (solo RRHH/Director) */}
        {vista === 'metricas' && canSeeAll(currentUser.rol) ? (
          <MetricasRRHH 
            evaluations={visibleEvaluations} 
            users={users} 
            skillsMatrix={skillsMatrix}
            onSelectPersona={(email) => {
              setSelectedEmail(email);
              setVista('individual');
              // Scroll al top para ver los gráficos
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : null}

        {/* Vista Individual */}
        {vista === 'individual' && (
          <>
            {/* Filtros - Sticky con botón de colapsar */}
            {canSeeAll(currentUser.rol) && (
              <div className="sticky top-0 z-10 bg-stone-50 pt-4 pb-2 mb-6">
                <div className="bg-white rounded-2xl shadow-md border border-stone-100">
                  <div className="flex items-center justify-between p-4 border-b border-stone-100">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Filtros
                    </h2>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-800 mb-2">
                      Período
                    </label>
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
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-stone-800 mb-2">
                      Área
                    </label>
                    <select
                      value={selectedArea}
                      onChange={(e) => {
                        setSelectedArea(e.target.value);
                      }}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white transition"
                    >
                      <option value="">Todas las áreas</option>
                      {areas.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
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

                  <div>
                    <label className="block text-sm font-semibold text-stone-800 mb-2">
                      Formulario
                    </label>
                    <select
                      value={selectedFormulario}
                      onChange={(e) => setSelectedFormulario(e.target.value as 'LIDER' | 'ANALISTA' | '')}
                      className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white transition"
                    >
                      <option value="">Ambos</option>
                      <option value="LIDER">Líder</option>
                      <option value="ANALISTA">Analista</option>
                    </select>
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
            )}

            {/* Métricas */}
            {filteredEvaluations.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
                  <p className="text-sm font-semibold text-stone-500 mb-2">Promedio General</p>
                  <p className="text-4xl font-bold text-slate-900">{promedioGeneral.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
                  <p className="text-sm font-semibold text-stone-500 mb-2">Seniority Alcanzado</p>
                  <p className="text-2xl font-bold text-orange-600">{seniorityAlcanzado}</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
                  <p className="text-sm font-semibold text-stone-500 mb-2">Seniority Esperado</p>
                  <p className="text-2xl font-bold text-slate-700">{seniorityEsperado}</p>
                </div>
              </div>
            )}

            {/* Botón exportar PDF (solo con persona seleccionada) */}
            {selectedEmail && mostrarEvaluado && filteredEvaluations.length > 0 && canSeeAll(currentUser.rol) && (
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => setShowPDFModal(true)}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar Reporte PDF
                </button>
              </div>
            )}

            {/* Dumbbell Chart - Brecha Auto vs Jefe (solo con persona seleccionada) */}
            {selectedEmail && dumbbellData.length > 0 && (
              <DumbbellChart
                data={dumbbellData}
                title={`Brecha Auto vs Lider${mostrarEvaluado ? ` - ${mostrarEvaluado.nombre}` : ''}`}
              />
            )}

            {/* Evolución Trimestral - Histórico con múltiples Q */}
            {selectedEmail && evolucionData.length > 0 && (
              <EvolucionChart
                data={evolucionData}
                title={`Evolución Trimestral${mostrarEvaluado ? ` - ${mostrarEvaluado.nombre}` : ''}`}
              />
            )}

            {/* Gráficos Radar - 4 gráficos (Hard Líder, Hard Analista, Soft Líder, Soft Analista) */}
            {filteredEvaluations.length > 0 ? (
              <div className="flex flex-col items-center gap-8 max-w-7xl mx-auto">
                
                {/* ===== HARD SKILLS LÍDER ===== */}
                {radarDataHardLider.length > 0 && (!selectedFormulario || selectedFormulario === 'LIDER') && (
                  <div className="space-y-4 w-full">
                    <div className="flex items-center justify-center gap-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Hard Skills - Líder
                        </span>
                      </div>
                      
                      {/* Carrusel de Áreas para Hard Skills Líder */}
                      {hardSkillAreasLider.length > 1 && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handlePrevAreaLider}
                            className="w-8 h-8 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-orange-300 transition flex items-center justify-center group"
                            aria-label="Área anterior"
                          >
                            <svg className="w-4 h-4 text-stone-400 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          <div className="flex flex-col items-center min-w-[120px]">
                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">
                              {hardSkillAreasLider[hardSkillAreaIndexLider]}
                            </span>
                            <div className="flex gap-1 mt-1">
                              {hardSkillAreasLider.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`h-1 rounded-full transition-all ${
                                    idx === hardSkillAreaIndexLider
                                      ? 'w-6 bg-orange-500'
                                      : 'w-1.5 bg-stone-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          
                          <button
                            onClick={handleNextAreaLider}
                            className="w-8 h-8 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-orange-300 transition flex items-center justify-center group"
                            aria-label="Área siguiente"
                          >
                            <svg className="w-4 h-4 text-stone-400 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Layout: Pentágono + Análisis al costado */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Pentágono */}
                      <div className="lg:col-span-2">
                        <RadarChart
                          data={radarDataHardLider}
                          title={hardSkillAreasLider.length > 0 ? `${hardSkillAreasLider[hardSkillAreaIndexLider]} - Líder` : 'Hard Skills Líder'}
                        />
                      </div>
                      
                      {/* Análisis al costado */}
                      {selectedEmail && barrasComparacion.length > 0 && (
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
                                <p className="text-xs text-green-600 font-semibold">Todo bien! 🎉</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== HARD SKILLS ANALISTA ===== */}
                {radarDataHardAnalista.length > 0 && (!selectedFormulario || selectedFormulario === 'ANALISTA') && (
                  <div className="space-y-4 w-full">
                    <div className="flex items-center justify-center gap-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                          Hard Skills - Analista
                        </span>
                      </div>
                      
                      {/* Carrusel de Áreas para Hard Skills Analista */}
                      {hardSkillAreasAnalista.length > 1 && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handlePrevAreaAnalista}
                            className="w-8 h-8 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-blue-300 transition flex items-center justify-center group"
                            aria-label="Área anterior"
                          >
                            <svg className="w-4 h-4 text-stone-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          <div className="flex flex-col items-center min-w-[120px]">
                            <span className="text-xs font-semibold text-blue-700 truncate max-w-[120px]">
                              {hardSkillAreasAnalista[hardSkillAreaIndexAnalista]}
                            </span>
                            <div className="flex gap-1 mt-1">
                              {hardSkillAreasAnalista.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`h-1 rounded-full transition-all ${
                                    idx === hardSkillAreaIndexAnalista
                                      ? 'w-6 bg-blue-500'
                                      : 'w-1.5 bg-stone-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          
                          <button
                            onClick={handleNextAreaAnalista}
                            className="w-8 h-8 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-blue-300 transition flex items-center justify-center group"
                            aria-label="Área siguiente"
                          >
                            <svg className="w-4 h-4 text-stone-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Layout: Pentágono + Análisis al costado */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Pentágono */}
                      <div className="lg:col-span-2">
                        <RadarChart
                          data={radarDataHardAnalista}
                          title={hardSkillAreasAnalista.length > 0 ? `${hardSkillAreasAnalista[hardSkillAreaIndexAnalista]} - Analista` : 'Hard Skills Analista'}
                        />
                      </div>
                      
                      {/* Análisis al costado */}
                      {selectedEmail && barrasComparacion.length > 0 && (
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
                                <p className="text-xs text-green-600 font-semibold">Todo bien! 🎉</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* ===== SOFT SKILLS LÍDER ===== */}
                {radarDataSoftLider.length > 0 && (!selectedFormulario || selectedFormulario === 'LIDER') && (
                  <div className="space-y-4 w-full">
                    <div className="flex items-center justify-center gap-2 px-4">
                      <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                        Soft Skills - Líder
                      </span>
                    </div>
                    
                    {/* Layout: Pentágono + Análisis al costado */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Pentágono */}
                      <div className="lg:col-span-2">
                        <RadarChart
                          data={radarDataSoftLider}
                          title={mostrarEvaluado ? `${mostrarEvaluado.nombre} - Soft Skills Líder` : 'Soft Skills Líder'}
                        />
                      </div>
                      
                      {/* Análisis al costado */}
                      {selectedEmail && barrasComparacion.length > 0 && (
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
                                <p className="text-xs text-green-600 font-semibold">Todo bien! 🎉</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== SOFT SKILLS ANALISTA ===== */}
                {radarDataSoftAnalista.length > 0 && (!selectedFormulario || selectedFormulario === 'ANALISTA') && (
                  <div className="space-y-4 w-full">
                    <div className="flex items-center justify-center gap-2 px-4">
                      <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                        Soft Skills - Analista
                      </span>
                    </div>
                    
                    {/* Layout: Pentágono + Análisis al costado */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Pentágono */}
                      <div className="lg:col-span-2">
                        <RadarChart
                          data={radarDataSoftAnalista}
                          title={mostrarEvaluado ? `${mostrarEvaluado.nombre} - Soft Skills Analista` : 'Soft Skills Analista'}
                        />
                      </div>
                      
                      {/* Análisis al costado */}
                      {selectedEmail && barrasComparacion.length > 0 && (
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
                                <p className="text-xs text-green-600 font-semibold">Todo bien! 🎉</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-12 text-center">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-stone-600 text-lg font-semibold mb-2">
                  No hay evaluaciones para mostrar
                </p>
                <p className="text-stone-500 text-sm">
                  Seleccioná un área o evaluado para ver los resultados
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal PDF */}
      {showPDFModal && mostrarEvaluado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Generar Reporte PDF</h3>
              <button
                onClick={() => { setShowPDFModal(false); setComentarioRRHH(''); }}
                className="p-1.5 hover:bg-stone-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              Reporte de <span className="font-semibold">{mostrarEvaluado.nombre}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-stone-700 mb-2">
                Observaciones de RRHH (opcional)
              </label>
              <textarea
                value={comentarioRRHH}
                onChange={(e) => setComentarioRRHH(e.target.value)}
                placeholder="Agregar comentario para incluir en el reporte..."
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-28 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPDFModal(false); setComentarioRRHH(''); }}
                className="flex-1 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDescargarPDF}
                className="flex-1 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition font-semibold text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
