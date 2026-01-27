// src/components/MetricasRRHH.tsx
import { useMemo, useState, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Scatter } from 'recharts';
import type { Evaluation, User } from '../types';
import { calcularSeniorityAlcanzado } from '../utils/calculations';
import { getUniqueAreas, getUniqueEvaluados } from '../utils/filters';
import { filterByPeriod, calcularTendenciaSeniority, calcularBandasSeniority, PERIODOS, type PeriodoType } from '../utils/dateUtils';
import { compararSkillsPorPeriodo } from '../utils/newChartCalculations';
import { SkillBreakdownInline } from './SkillBreakdown';
import type { Seniority } from '../types';

// Función para normalizar texto (sin acentos, minúsculas)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

interface MetricasRRHHProps {
  evaluations: Evaluation[];
  users: User[];
  skillsMatrix: any[];
  onSelectPersona?: (email: string) => void; // Callback para cambiar a vista individual
}

export default function MetricasRRHH({ evaluations, onSelectPersona }: MetricasRRHHProps): React.ReactElement {
  // Estados para filtros
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedSeniority, setSelectedSeniority] = useState<Seniority | ''>('');
  const [selectedFormulario, setSelectedFormulario] = useState<'LIDER' | 'ANALISTA' | ''>('');
  const [selectedPeriodo, setSelectedPeriodo] = useState<PeriodoType>('HISTORICO');
  const [currentPage, setCurrentPage] = useState(1);
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

  // Aplicar filtros
  const filteredEvaluations = useMemo(() => {
    // Primero filtrar por período
    let result = filterByPeriod(evaluations, selectedPeriodo);

    if (selectedArea) {
      result = result.filter((e) => e.area === selectedArea);
    }

    if (selectedEmail) {
      result = result.filter((e) => e.evaluadoEmail === selectedEmail);
    }

    if (selectedFormulario) {
      result = result.filter((e) => e.origen === selectedFormulario);
    }

    return result;
  }, [evaluations, selectedArea, selectedEmail, selectedFormulario, selectedPeriodo]);

  // Obtener datos para filtros (con cascada)
  const areas = useMemo(() => {
    if (selectedEmail) {
      // Si hay evaluado seleccionado, mostrar solo su área
      const evalsPorEmail = evaluations.filter(e => e.evaluadoEmail === selectedEmail);
      return getUniqueAreas(evalsPorEmail);
    }
    return getUniqueAreas(evaluations);
  }, [evaluations, selectedEmail]);
  
  const evaluados = useMemo(() => {
    const evals = selectedArea
      ? evaluations.filter(e => e.area === selectedArea)
      : evaluations;
    return getUniqueEvaluados(evals);
  }, [evaluations, selectedArea]);

  // Filtrar evaluados por término de búsqueda
  const filteredEvaluados = useMemo(() => {
    if (!searchTerm.trim()) return evaluados;
    const normalized = normalizeText(searchTerm);
    return evaluados.filter(e => normalizeText(e.nombre).includes(normalized));
  }, [evaluados, searchTerm]);

  // Agrupar evaluaciones por evaluado
  const resultadosPorPersona = useMemo(() => {
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

    // Agrupar por email
    const evalsPorEmail = new Map<string, Evaluation[]>();
    filteredEvaluations.forEach(e => {
      if (!evalsPorEmail.has(e.evaluadoEmail)) {
        evalsPorEmail.set(e.evaluadoEmail, []);
      }
      evalsPorEmail.get(e.evaluadoEmail)!.push(e);
    });

    // Calcular métricas por persona
    evalsPorEmail.forEach((evals, email) => {
      const evalsAuto = evals.filter(e => e.tipoEvaluador === 'AUTO');
      const evalsJefe = evals.filter(e => e.tipoEvaluador === 'JEFE');

      if (evalsAuto.length === 0 && evalsJefe.length === 0) return;

      const promedioAuto = evalsAuto.length > 0
        ? evalsAuto.reduce((sum, e) => sum + e.puntaje, 0) / evalsAuto.length
        : 0;

      const promedioJefe = evalsJefe.length > 0
        ? evalsJefe.reduce((sum, e) => sum + e.puntaje, 0) / evalsJefe.length
        : 0;

      const promedioFinal = promedioAuto > 0 && promedioJefe > 0
        ? (promedioAuto + promedioJefe) / 2
        : promedioAuto > 0 ? promedioAuto : promedioJefe;

      const gap = Math.abs(promedioAuto - promedioJefe);
      const seniorityAlcanzado = calcularSeniorityAlcanzado(promedioFinal);

      const firstEval = evals[0];
      map.set(email, {
        email,
        nombre: `${firstEval.evaluadoNombre} ${firstEval.evaluadoApellido || ''}`.trim(),
        area: firstEval.area,
        rol: firstEval.origen === 'ANALISTA' ? 'Analista' : 'Líder',
        promedioAuto,
        promedioJefe,
        promedioFinal,
        seniorityAlcanzado,
        gap,
      });
    });

    return Array.from(map.values());
  }, [filteredEvaluations]);

  // Filtrar resultados por seniority si está seleccionado
  const filteredResultados = useMemo(() => {
    if (!selectedSeniority) return resultadosPorPersona;
    return resultadosPorPersona.filter(p => p.seniorityAlcanzado === selectedSeniority);
  }, [resultadosPorPersona, selectedSeniority]);

  // Seniority disponibles según filtros activos
  const seniorityDisponibles = useMemo(() => {
    const senioritySet = new Set<Seniority>();
    (selectedEmail || selectedArea ? resultadosPorPersona : filteredResultados).forEach(p => {
      senioritySet.add(p.seniorityAlcanzado);
    });
    return senioritySet;
  }, [resultadosPorPersona, filteredResultados, selectedEmail, selectedArea]);

  // Métricas agregadas
  const metricas = useMemo(() => {
    const porSeniority = {
      'Trainee': 0,
      'Junior': 0,
      'Semi Senior': 0,
      'Senior': 0,
    };

    filteredResultados.forEach(p => {
      porSeniority[p.seniorityAlcanzado]++;
    });

    const gapPromedio = filteredResultados.length > 0
      ? filteredResultados.reduce((sum, p) => sum + p.gap, 0) / filteredResultados.length
      : 0;

    const porArea = filteredResultados.reduce((acc, p) => {
      acc[p.area] = (acc[p.area] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: filteredResultados.length,
      porSeniority,
      gapPromedio,
      porArea,
    };
  }, [filteredResultados]);

  const handleResetFilters = () => {
    setSelectedArea('');
    setSelectedEmail('');
    setSelectedSeniority('');
    setSelectedFormulario('');
    setSelectedPeriodo('HISTORICO');
    setCurrentPage(1);
  };

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedArea, selectedEmail, selectedSeniority, selectedFormulario, selectedPeriodo]);

  // Calcular datos paginados
  const totalPages = Math.ceil(filteredResultados.length / itemsPerPage);
  const paginatedResultados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredResultados
      .sort((a, b) => b.promedioFinal - a.promedioFinal)
      .slice(startIndex, endIndex);
  }, [filteredResultados, currentPage]);

  // NUEVOS GRÁFICOS: Lollipop POR PERSONA (no promedio)
  const [selectedPersonaAnalista] = useState<string>('');
  const [selectedPersonaLider] = useState<string>('');
  const [selectedAreaAnalista, setSelectedAreaAnalista] = useState<string>('');
  const [selectedAreaLider, setSelectedAreaLider] = useState<string>('');
  const [filtrosCollapsed, setFiltrosCollapsed] = useState<boolean>(false);

  // Estado para drill-down (desglose de skills) - ahora inline
  const [drillDownPersona, setDrillDownPersona] = useState<{
    email: string;
    nombre: string;
    origen: 'ANALISTA' | 'LIDER';
  } | null>(null);
  
  // Selectores de periodos para comparación
  const [periodoAAnalistas] = useState<string>('Q1');
  const [periodoBAnalistas] = useState<string>('Q2');
  const [periodoALideres] = useState<string>('Q1');
  const [periodoBLideres] = useState<string>('Q2');

  // Obtener lista de personas por origen con nombre completo
  const todasPersonasAnalistas = useMemo(() => {
    const personasMap = new Map<string, { email: string; nombreCompleto: string; areas: string[] }>();
    
    filteredEvaluations
      .filter(e => e.origen === 'ANALISTA')
      .forEach(e => {
        if (!personasMap.has(e.evaluadoEmail)) {
          const apellido = (e as any).evaluadoApellido || '';
          personasMap.set(e.evaluadoEmail, {
            email: e.evaluadoEmail,
            nombreCompleto: `${e.evaluadoNombre} ${apellido}`.trim(),
            areas: []
          });
        }
        const persona = personasMap.get(e.evaluadoEmail)!;
        if (!persona.areas.includes(e.area)) {
          persona.areas.push(e.area);
        }
      });
    
    return Array.from(personasMap.values());
  }, [filteredEvaluations]);

  const todasPersonasLideres = useMemo(() => {
    const personasMap = new Map<string, { email: string; nombreCompleto: string; areas: string[] }>();
    
    filteredEvaluations
      .filter(e => e.origen === 'LIDER')
      .forEach(e => {
        if (!personasMap.has(e.evaluadoEmail)) {
          const apellido = (e as any).evaluadoApellido || '';
          personasMap.set(e.evaluadoEmail, {
            email: e.evaluadoEmail,
            nombreCompleto: `${e.evaluadoNombre} ${apellido}`.trim(),
            areas: []
          });
        }
        const persona = personasMap.get(e.evaluadoEmail)!;
        if (!persona.areas.includes(e.area)) {
          persona.areas.push(e.area);
        }
      });
    
    return Array.from(personasMap.values());
  }, [filteredEvaluations]);

  // Obtener áreas únicas según persona seleccionada
  const areasAnalistas = useMemo(() => {
    if (selectedPersonaAnalista) {
      // Si hay persona seleccionada, solo mostrar sus áreas
      const persona = todasPersonasAnalistas.find(p => p.email === selectedPersonaAnalista);
      return persona?.areas || [];
    }
    // Si no hay persona, mostrar todas las áreas
    const areas = new Set(filteredEvaluations.filter(e => e.origen === 'ANALISTA').map(e => e.area));
    return Array.from(areas);
  }, [filteredEvaluations, selectedPersonaAnalista, todasPersonasAnalistas]);

  const areasLideres = useMemo(() => {
    if (selectedPersonaLider) {
      // Si hay persona seleccionada, solo mostrar sus áreas
      const persona = todasPersonasLideres.find(p => p.email === selectedPersonaLider);
      return persona?.areas || [];
    }
    // Si no hay persona, mostrar todas las áreas
    const areas = new Set(filteredEvaluations.filter(e => e.origen === 'LIDER').map(e => e.area));
    return Array.from(areas);
  }, [filteredEvaluations, selectedPersonaLider, todasPersonasLideres]);

  // Inicializar carruseles con la primera área (debe ir DESPUÉS de areasAnalistas/areasLideres)
  useEffect(() => {
    if (areasAnalistas.length > 0 && !selectedAreaAnalista) {
      setSelectedAreaAnalista(areasAnalistas[0]);
    }
  }, [areasAnalistas, selectedAreaAnalista]);

  useEffect(() => {
    if (areasLideres.length > 0 && !selectedAreaLider) {
      setSelectedAreaLider(areasLideres[0]);
    }
  }, [areasLideres, selectedAreaLider]);

  // Resetear selectores de carrusel cuando cambia el filtro global
  useEffect(() => {
    if (selectedArea) {
      setSelectedAreaAnalista('');
      setSelectedAreaLider('');
    }
  }, [selectedArea]);

  // 3. Gráfico de Bandas de Seniority
  const bandasAnalistas = useMemo(() => {
    let evals = filteredEvaluations.filter(e => e.origen === 'ANALISTA');
    
    // Solo aplicar filtro de carrusel si NO hay filtro global de área activo
    if (!selectedArea && selectedAreaAnalista) {
      evals = evals.filter(e => e.area === selectedAreaAnalista);
    }
    
    const userEmail = selectedPersonaAnalista || undefined;
    return calcularBandasSeniority(evals, userEmail, 'ANALISTA');
  }, [filteredEvaluations, selectedPersonaAnalista, selectedAreaAnalista, selectedArea]);

  const bandasLideres = useMemo(() => {
    let evals = filteredEvaluations.filter(e => e.origen === 'LIDER');
    
    // Solo aplicar filtro de carrusel si NO hay filtro global de área activo
    if (!selectedArea && selectedAreaLider) {
      evals = evals.filter(e => e.area === selectedAreaLider);
    }
    
    const userEmail = selectedPersonaLider || undefined;
    return calcularBandasSeniority(evals, userEmail, 'LIDER');
  }, [filteredEvaluations, selectedPersonaLider, selectedAreaLider, selectedArea]);

  // Comparación de skills por periodos personalizados
  const skillsComparacionAnalistas = useMemo(() => {
    if (!drillDownPersona || drillDownPersona.origen !== 'ANALISTA') return [];
    
    const result = compararSkillsPorPeriodo(
      filteredEvaluations as any,
      drillDownPersona.email,
      periodoAAnalistas,
      periodoBAnalistas
    );
    return result;
  }, [filteredEvaluations, drillDownPersona, periodoAAnalistas, periodoBAnalistas]);

  const skillsComparacionLideres = useMemo(() => {
    if (!drillDownPersona || drillDownPersona.origen !== 'LIDER') return [];
    
    const result = compararSkillsPorPeriodo(
      filteredEvaluations as any,
      drillDownPersona.email,
      periodoALideres,
      periodoBLideres
    );
    return result;
  }, [filteredEvaluations, drillDownPersona, periodoALideres, periodoBLideres]);

  // Tendencias por seniority (para las cards)
  const tendencias = useMemo(() => {
    const usersBySeniority = new Map<string, { seniority: string }>();
    resultadosPorPersona.forEach(p => {
      usersBySeniority.set(p.email, { seniority: p.seniorityAlcanzado });
    });
    
    return {
      Trainee: calcularTendenciaSeniority(evaluations, usersBySeniority, 'Trainee'),
      Junior: calcularTendenciaSeniority(evaluations, usersBySeniority, 'Junior'),
      'Semi Senior': calcularTendenciaSeniority(evaluations, usersBySeniority, 'Semi Senior'),
      Senior: calcularTendenciaSeniority(evaluations, usersBySeniority, 'Senior'),
    };
  }, [evaluations, resultadosPorPersona]);

  return (
    <div className="space-y-6">
      {/* Filtros - Sticky con botón de colapsar */}
      <div className="sticky top-0 z-10 bg-stone-50 pt-4 pb-2">
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
                  setSelectedEmail(''); // Reset evaluado cuando cambia área
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

      {/* Métricas Generales */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          Resumen General
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-slate-50 to-stone-50 rounded-xl p-5 border border-stone-100">
            <p className="text-sm font-semibold text-stone-500 mb-1">Total Evaluados</p>
            <p className="text-4xl font-bold text-slate-900">{metricas.total}</p>
          </div>
          <button
            onClick={() => setSelectedSeniority(selectedSeniority === 'Trainee' ? '' : 'Trainee')}
            disabled={!seniorityDisponibles.has('Trainee') && metricas.porSeniority['Trainee'] === 0}
            className={`text-left bg-stone-50 rounded-xl p-5 border transition-all ${
              !seniorityDisponibles.has('Trainee') && metricas.porSeniority['Trainee'] === 0
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:shadow-md cursor-pointer'
            } ${
              selectedSeniority === 'Trainee' ? 'border-stone-400 ring-2 ring-stone-300' : 'border-stone-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-500 mb-1">Trainee</p>
                <p className="text-4xl font-bold text-stone-600">{metricas.porSeniority['Trainee']}</p>
              </div>
              {tendencias.Trainee.direccion !== 'stable' && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  tendencias.Trainee.direccion === 'up' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <svg className={`w-3 h-3 ${
                    tendencias.Trainee.direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={
                      tendencias.Trainee.direccion === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'
                    } />
                  </svg>
                  <span className={`text-xs font-bold ${
                    tendencias.Trainee.direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>{Math.abs(tendencias.Trainee.cambioAbsoluto).toFixed(2)}</span>
                </div>
              )}
            </div>
          </button>
          <button
            onClick={() => setSelectedSeniority(selectedSeniority === 'Junior' ? '' : 'Junior')}
            disabled={!seniorityDisponibles.has('Junior') && metricas.porSeniority['Junior'] === 0}
            className={`text-left bg-stone-50 rounded-xl p-5 border transition-all ${
              !seniorityDisponibles.has('Junior') && metricas.porSeniority['Junior'] === 0
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:shadow-md cursor-pointer'
            } ${
              selectedSeniority === 'Junior' ? 'border-slate-400 ring-2 ring-slate-300' : 'border-stone-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-500 mb-1">Junior</p>
                <p className="text-4xl font-bold text-slate-700">{metricas.porSeniority['Junior']}</p>
              </div>
              {tendencias.Junior.direccion !== 'stable' && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  tendencias.Junior.direccion === 'up' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <svg className={`w-3 h-3 ${
                    tendencias.Junior.direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={
                      tendencias.Junior.direccion === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'
                    } />
                  </svg>
                  <span className={`text-xs font-bold ${
                    tendencias.Junior.direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>{Math.abs(tendencias.Junior.cambioAbsoluto).toFixed(2)}</span>
                </div>
              )}
            </div>
          </button>
          <button
            onClick={() => setSelectedSeniority(selectedSeniority === 'Semi Senior' ? '' : 'Semi Senior')}
            disabled={!seniorityDisponibles.has('Semi Senior') && metricas.porSeniority['Semi Senior'] === 0}
            className={`text-left bg-stone-50 rounded-xl p-5 border transition-all ${
              !seniorityDisponibles.has('Semi Senior') && metricas.porSeniority['Semi Senior'] === 0
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:shadow-md cursor-pointer'
            } ${
              selectedSeniority === 'Semi Senior' ? 'border-slate-400 ring-2 ring-slate-300' : 'border-stone-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-500 mb-1">Semi Senior</p>
                <p className="text-4xl font-bold text-slate-800">{metricas.porSeniority['Semi Senior']}</p>
              </div>
              {tendencias['Semi Senior'].direccion !== 'stable' && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  tendencias['Semi Senior'].direccion === 'up' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <svg className={`w-3 h-3 ${
                    tendencias['Semi Senior'].direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={
                      tendencias['Semi Senior'].direccion === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'
                    } />
                  </svg>
                  <span className={`text-xs font-bold ${
                    tendencias['Semi Senior'].direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>{Math.abs(tendencias['Semi Senior'].cambioAbsoluto).toFixed(2)}</span>
                </div>
              )}
            </div>
          </button>
          <button
            onClick={() => setSelectedSeniority(selectedSeniority === 'Senior' ? '' : 'Senior')}
            disabled={!seniorityDisponibles.has('Senior') && metricas.porSeniority['Senior'] === 0}
            className={`text-left bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border transition-all ${
              !seniorityDisponibles.has('Senior') && metricas.porSeniority['Senior'] === 0
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:shadow-md cursor-pointer'
            } ${
              selectedSeniority === 'Senior' ? 'border-orange-400 ring-2 ring-orange-300' : 'border-orange-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-700 mb-1">Senior</p>
                <p className="text-4xl font-bold text-orange-600">{metricas.porSeniority['Senior']}</p>
              </div>
              {tendencias.Senior.direccion !== 'stable' && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  tendencias.Senior.direccion === 'up' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <svg className={`w-3 h-3 ${
                    tendencias.Senior.direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={
                      tendencias.Senior.direccion === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'
                    } />
                  </svg>
                  <span className={`text-xs font-bold ${
                    tendencias.Senior.direccion === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>{Math.abs(tendencias.Senior.cambioAbsoluto).toFixed(2)}</span>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Gap Auto vs Jefe */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
        <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          Gap Promedio (Auto vs Jefe)
        </h3>
        <p className="text-5xl font-bold text-orange-600">{metricas.gapPromedio.toFixed(2)}</p>
        <p className="text-sm text-stone-500 mt-2">
          Diferencia promedio entre autoevaluación y evaluación del líder
        </p>
      </div>

      {/* GRÁFICO PRINCIPAL: BANDAS DE SENIORITY (Cometas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analistas */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Bandas de Seniority - Analistas
                </h3>
              </div>
              
              {/* Carrusel de Áreas (solo si NO hay filtro global) */}
              {!selectedArea && areasAnalistas.length > 1 && (
                <div className="flex items-center justify-center gap-3 mb-3">
                  <button
                    onClick={() => {
                      const currentIndex = areasAnalistas.indexOf(selectedAreaAnalista);
                      const prevIndex = currentIndex <= 0 ? areasAnalistas.length - 1 : currentIndex - 1;
                      setSelectedAreaAnalista(areasAnalistas[prevIndex]);
                    }}
                    className="p-2 rounded-lg bg-stone-100 hover:bg-teal-100 text-teal-600 transition-all"
                    title="Área anterior"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="px-4 py-2 bg-teal-50 rounded-lg border-2 border-teal-600 min-w-[180px] text-center">
                    <span className="text-sm font-bold text-teal-700">
                      {selectedAreaAnalista || 'Todas las áreas'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const currentIndex = areasAnalistas.indexOf(selectedAreaAnalista);
                      const nextIndex = currentIndex >= areasAnalistas.length - 1 ? 0 : currentIndex + 1;
                      setSelectedAreaAnalista(areasAnalistas[nextIndex]);
                    }}
                    className="p-2 rounded-lg bg-stone-100 hover:bg-teal-100 text-teal-600 transition-all"
                    title="Siguiente área"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              <p className="text-xs text-stone-600 mb-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3" style={{ backgroundColor: '#fef9c3' }}></span>
                  <span className="font-semibold">Trainee (0-2)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#fed7aa' }}></span>
                  <span className="font-semibold">Junior (2-3)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#d1fae5' }}></span>
                  <span className="font-semibold">Semi Senior (3-4)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#dbeafe' }}></span>
                  <span className="font-semibold">Senior (4-5)</span>
                </span>
              </p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart 
                data={bandasAnalistas}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <defs>
                  {/* Definir gradientes para las bandas de fondo - colores más notorios */}
                  <linearGradient id="traineeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde047" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#fef9c3" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="juniorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fdba74" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#fed7aa" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="semiSeniorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="seniorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#dbeafe" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis 
                  dataKey="persona" 
                  stroke="#64748b"
                  style={{ fontSize: '10px', fontWeight: 600 }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis 
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  stroke="#64748b"
                  style={{ fontSize: '11px', fontWeight: 600 }}
                  label={{ value: 'Puntaje', angle: -90, position: 'insideLeft', style: { fontSize: '11px', fontWeight: 600, fill: '#64748b' } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      const crecimiento = data.q2Score - data.q1Score;
                      const simbolo = crecimiento > 0 ? '🚀' : crecimiento < 0 ? '📉' : '➡️';
                      return (
                        <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-lg">
                          <p className="font-bold text-slate-900 mb-1">{data.persona}</p>
                          <p className="text-xs text-slate-600"><span className="font-semibold">Q1 (Anterior):</span> <span style={{color: '#94a3b8', fontWeight: 600}}>{data.q1Score?.toFixed(2)}</span> - {data.q1Seniority}</p>
                          <p className="text-xs text-slate-600"><span className="font-semibold">Q2 (Actual):</span> <span style={{color: '#14b8a6', fontWeight: 600}}>{data.q2Score?.toFixed(2)}</span> - {data.q2Seniority}</p>
                          <p className="text-xs font-bold mt-1" style={{color: crecimiento > 0 ? '#10b981' : crecimiento < 0 ? '#ef4444' : '#64748b'}}>
                            {simbolo} Cambio: {crecimiento > 0 ? '+' : ''}{crecimiento.toFixed(2)}
                          </p>
                          {data.saltoNivel && <p className="text-xs font-bold text-orange-600 mt-1">⚡ ¡Cambió de nivel!</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Bandas de fondo usando ReferenceArea */}
                {/* Trainee: 0-2 */}
                <Area type="monotone" dataKey={() => 2} fill="url(#traineeGrad)" stroke="none" />
                {/* Junior: 2-3 */}
                <Area type="monotone" dataKey={() => 3} fill="url(#juniorGrad)" stroke="none" />
                {/* Semi Senior: 3-4 */}
                <Area type="monotone" dataKey={() => 4} fill="url(#semiSeniorGrad)" stroke="none" />
                {/* Senior: 4-5 */}
                <Area type="monotone" dataKey={() => 5} fill="url(#seniorGrad)" stroke="none" />
                
                {/* Puntos Q1 (cola del cometa - gris hueco) */}
                <Scatter 
                  dataKey="q1Score" 
                  fill="#fff"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  shape="circle"
                  r={5}
                  name="Q1 (Anterior)"
                />
                
                {/* Puntos Q2 (cabeza del cometa - teal sólido) - CLICKEABLE */}
                <Scatter 
                  dataKey="q2Score" 
                  fill="#14b8a6"
                  stroke="#0d9488"
                  strokeWidth={2}
                  shape="circle"
                  r={7}
                  name="Q2 (Actual)"
                  onClick={(data) => {
                    if (data && data.payload) {
                      // Buscar por nombre (evaluadoNombre) que coincida con payload.persona
                      const evaluacion = filteredEvaluations.find(
                        e => e.evaluadoNombre === data.payload.persona && e.origen === 'ANALISTA'
                      );
                      
                      const evaluadoEmail = evaluacion?.evaluadoEmail;
                      
                      if (evaluadoEmail) {
                        setDrillDownPersona({
                          email: evaluadoEmail,
                          nombre: data.payload.persona,
                          origen: 'ANALISTA'
                        });
                      }
                    }
                  }}
                  cursor="pointer"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

        {/* Líderes */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Bandas de Seniority - Líderes
                </h3>
              </div>
              
              {/* Carrusel de Áreas (solo si NO hay filtro global) */}
              {!selectedArea && areasLideres.length > 1 && (
                <div className="flex items-center justify-center gap-3 mb-3">
                  <button
                    onClick={() => {
                      const currentIndex = areasLideres.indexOf(selectedAreaLider);
                      const prevIndex = currentIndex <= 0 ? areasLideres.length - 1 : currentIndex - 1;
                      setSelectedAreaLider(areasLideres[prevIndex]);
                    }}
                    className="p-2 rounded-lg bg-stone-100 hover:bg-purple-100 text-purple-600 transition-all"
                    title="Área anterior"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="px-4 py-2 bg-purple-50 rounded-lg border-2 border-purple-600 min-w-[180px] text-center">
                    <span className="text-sm font-bold text-purple-700">
                      {selectedAreaLider || 'Todas las áreas'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const currentIndex = areasLideres.indexOf(selectedAreaLider);
                      const nextIndex = currentIndex >= areasLideres.length - 1 ? 0 : currentIndex + 1;
                      setSelectedAreaLider(areasLideres[nextIndex]);
                    }}
                    className="p-2 rounded-lg bg-stone-100 hover:bg-purple-100 text-purple-600 transition-all"
                    title="Siguiente área"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              <p className="text-xs text-stone-600 mb-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3" style={{ backgroundColor: '#fef9c3' }}></span>
                  <span className="font-semibold">Trainee (0-2)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#fed7aa' }}></span>
                  <span className="font-semibold">Junior (2-3)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#d1fae5' }}></span>
                  <span className="font-semibold">Semi Senior (3-4)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#dbeafe' }}></span>
                  <span className="font-semibold">Senior (4-5)</span>
                </span>
              </p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart 
                data={bandasLideres}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <defs>
                  {/* Definir gradientes para las bandas de fondo - colores más notorios */}
                  <linearGradient id="traineeGradLideres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde047" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#fef9c3" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="juniorGradLideres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fdba74" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#fed7aa" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="semiSeniorGradLideres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="seniorGradLideres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#dbeafe" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis 
                  dataKey="persona" 
                  stroke="#64748b"
                  style={{ fontSize: '10px', fontWeight: 600 }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis 
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  stroke="#64748b"
                  style={{ fontSize: '11px', fontWeight: 600 }}
                  label={{ value: 'Puntaje', angle: -90, position: 'insideLeft', style: { fontSize: '11px', fontWeight: 600, fill: '#64748b' } }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      const crecimiento = data.q2Score - data.q1Score;
                      const simbolo = crecimiento > 0 ? '🚀' : crecimiento < 0 ? '📉' : '➡️';
                      return (
                        <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-lg">
                          <p className="font-bold text-slate-900 mb-1">{data.persona}</p>
                          <p className="text-xs text-slate-600"><span className="font-semibold">Q1 (Anterior):</span> <span style={{color: '#94a3b8', fontWeight: 600}}>{data.q1Score?.toFixed(2)}</span> - {data.q1Seniority}</p>
                          <p className="text-xs text-slate-600"><span className="font-semibold">Q2 (Actual):</span> <span style={{color: '#a855f7', fontWeight: 600}}>{data.q2Score?.toFixed(2)}</span> - {data.q2Seniority}</p>
                          <p className="text-xs font-bold mt-1" style={{color: crecimiento > 0 ? '#10b981' : crecimiento < 0 ? '#ef4444' : '#64748b'}}>
                            {simbolo} Cambio: {crecimiento > 0 ? '+' : ''}{crecimiento.toFixed(2)}
                          </p>
                          {data.saltoNivel && <p className="text-xs font-bold text-orange-600 mt-1">⚡ ¡Cambió de nivel!</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                
                {/* Bandas de fondo usando gradientes */}
                {/* Trainee: 0-2 */}
                <Area type="monotone" dataKey={() => 2} fill="url(#traineeGradLideres)" stroke="none" />
                {/* Junior: 2-3 */}
                <Area type="monotone" dataKey={() => 3} fill="url(#juniorGradLideres)" stroke="none" />
                {/* Semi Senior: 3-4 */}
                <Area type="monotone" dataKey={() => 4} fill="url(#semiSeniorGradLideres)" stroke="none" />
                {/* Senior: 4-5 */}
                <Area type="monotone" dataKey={() => 5} fill="url(#seniorGradLideres)" stroke="none" />
                
                {/* Puntos Q1 (cola del cometa - gris hueco) */}
                <Scatter 
                  dataKey="q1Score" 
                  fill="#fff"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  shape="circle"
                  r={5}
                  name="Q1 (Anterior)"
                />
                
                {/* Puntos Q2 (cabeza del cometa - púrpura sólido) - CLICKEABLE */}
                <Scatter 
                  dataKey="q2Score" 
                  fill="#a855f7"
                  stroke="#9333ea"
                  strokeWidth={2}
                  shape="circle"
                  r={7}
                  name="Q2 (Actual)"
                  onClick={(data) => {
                    if (data && data.payload) {
                      // Buscar por nombre (evaluadoNombre) que coincida con payload.persona
                      const evaluacion = filteredEvaluations.find(
                        e => e.evaluadoNombre === data.payload.persona && e.origen === 'LIDER'
                      );
                      
                      const evaluadoEmail = evaluacion?.evaluadoEmail;
                      
                      if (evaluadoEmail) {
                        setDrillDownPersona({
                          email: evaluadoEmail,
                          nombre: data.payload.persona,
                          origen: 'LIDER'
                        });
                      }
                    }
                  }}
                  cursor="pointer"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* DESGLOSE INLINE DE SKILLS POR PERSONA */}
      {drillDownPersona && drillDownPersona.origen === 'ANALISTA' && skillsComparacionAnalistas.length > 0 && (
        <SkillBreakdownInline
          personaNombre={drillDownPersona?.nombre ?? ''}
          skills={skillsComparacionAnalistas}
          periodoA="Anterior (más de 3 meses)"
          periodoB="Actual (últimos 3 meses)"
        />
      )}
      {drillDownPersona && drillDownPersona.origen === 'LIDER' && skillsComparacionLideres.length > 0 && (
        <SkillBreakdownInline
          personaNombre={drillDownPersona?.nombre ?? ''}
          skills={skillsComparacionLideres}
          periodoA="Anterior (más de 3 meses)"
          periodoB="Actual (últimos 3 meses)"
        />
      )}

      {/* Tabla de Resultados Individuales */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md overflow-x-auto">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Resultados Individuales
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-stone-200">
              <th className="text-left p-3 font-bold text-stone-700">Nombre</th>
              <th className="text-left p-3 font-bold text-stone-700">Área</th>
              <th className="text-left p-3 font-bold text-stone-700">Rol</th>
              <th className="text-center p-3 font-bold text-stone-700">Fecha</th>
              <th className="text-center p-3 font-bold text-stone-700">Auto</th>
              <th className="text-center p-3 font-bold text-stone-700">Líder</th>
              <th className="text-center p-3 font-bold text-stone-700">Final</th>
              <th className="text-center p-3 font-bold text-stone-700">Seniority</th>
              <th className="text-center p-3 font-bold text-stone-700">Gap</th>
            </tr>
          </thead>
          <tbody>
            {paginatedResultados.map((persona) => (
              <tr 
                key={persona.email} 
                onClick={() => onSelectPersona && onSelectPersona(persona.email)}
                className="border-b border-stone-100 hover:bg-orange-50 transition cursor-pointer"
              >
                <td className="p-3 font-medium text-slate-900">{persona.nombre}</td>
                <td className="p-3 text-stone-600">{persona.area}</td>
                <td className="p-3 text-stone-600">{persona.rol}</td>
                <td className="text-center p-3 text-xs text-stone-600">
                  {(() => {
                    const evalsPersona = evaluations.filter(e => e.evaluadoEmail === persona.email);
                    if (evalsPersona.length === 0) return '-';
                    const fechas = evalsPersona.map(e => new Date(e.fecha));
                    const fechaMasReciente = new Date(Math.max(...fechas.map(f => f.getTime())));
                    return fechaMasReciente.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
                  })()}
                </td>
                <td className="text-center p-3 font-semibold text-slate-600">{persona.promedioAuto.toFixed(2)}</td>
                <td className="text-center p-3 font-semibold text-orange-600">{persona.promedioJefe.toFixed(2)}</td>
                <td className="text-center p-3 font-bold text-slate-900">{persona.promedioFinal.toFixed(2)}</td>
                <td className="text-center p-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    persona.seniorityAlcanzado === 'Senior' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
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
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredResultados.length)} de {filteredResultados.length} resultados
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
                        ? 'bg-orange-500 text-white'
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
      </div>
    </div>
  );
}
