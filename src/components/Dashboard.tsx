// src/components/Dashboard.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { filterEvaluationsByRole, getUniqueAreas, getUniqueEvaluados, canSeeAll, getUniqueHardSkillAreas } from '../utils/filters';
import {
  transformarARadarData,
  calcularPromedioGeneral,
  calcularSeniorityAlcanzado,
  calcularEvolucionSemestral,
} from '../utils/calculations';
import { filterByPeriod, comparePersonaBetweenPeriods, PERIODOS, type PeriodoType } from '../utils/dateUtils';
import { generarPDFIndividual, type PDFReporteData } from '../utils/pdfGenerator';
import { pdfToBase64, generarCuerpoEmail, enviarEmailConPDF } from '../utils/emailService';
import { sanitizeText, sanitizeEmailList, normalizeText } from '../utils/sanitize';
import PersonaRadarPanel from '../components/PersonaRadarPanel';
import DumbbellChart, { type DumbbellDataPoint } from '../components/DumbbellChart';
import EvolucionChart from '../components/EvolucionChart';
import MetricasRRHH from '../components/MetricasRRHH';
import MetricasLider from '../components/MetricasLider';
import OnboardingTooltip from '../components/OnboardingTooltip';
import AdminDashboard from '../components/admin/AdminDashboard';
import FormularioView from '../components/FormularioView';
import { dashboardSteps } from '../config/onboardingSteps';
import type { Seniority } from '../types';
import MiDesempenoPanel from '../components/MiDesempenoPanel';

type VistaType = 'individual' | 'metricas' | 'equipo' | 'formulario' | 'areas';

export default function Dashboard() {
  const { currentUser, users, evaluations, skillsMatrix, logout } = useApp();
  const { dark, toggle: toggleDark } = useTheme();
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
  const [emailDestinatarios, setEmailDestinatarios] = useState<string>('');
  const [enviandoEmail, setEnviandoEmail] = useState<boolean>(false);
  const [emailResultado, setEmailResultado] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [expandedAreaRadar, setExpandedAreaRadar] = useState<string | null>(null); // email de persona seleccionada en área

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

  // Seleccionar automáticamente el primer evaluado solo si el rol ve una sola persona (Analista/Lider)
  useEffect(() => {
    if (!hasAutoSelected && !selectedEmail && evaluados.length > 0) {
      // Director y RRHH arrancan con "Todos los evaluados" (sin selección automática)
      const esVistaGlobal = currentUser?.rol === 'Director' || currentUser?.rol === 'RRHH';
      if (!esVistaGlobal) {
        const firstEvaluado = evaluados[0];
        setSelectedEmail(firstEvaluado.email);
        setSearchTerm(firstEvaluado.nombre);
      }
      setHasAutoSelected(true);
    }
  }, [evaluados, selectedEmail, hasAutoSelected, currentUser?.rol]);

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
  // Área del evaluado seleccionado (tomada de sus evaluaciones)
  const selectedPersonArea = useMemo(() => {
    if (!selectedEmail) return selectedArea || '';
    const evalOfPerson = visibleEvaluations.find(e => e.evaluadoEmail === selectedEmail);
    return evalOfPerson?.area || selectedArea || '';
  }, [selectedEmail, visibleEvaluations, selectedArea]);

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

  // Seniority esperado para los radars: nivel alcanzado del semestre anterior, o el actual si no hay anterior
  const seniorityEsperado: Seniority = useMemo(() => {
    if (!selectedEmail) return 'Junior';
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const { sAnterior } = comparePersonaBetweenPeriods(evalsPersona);
    if (sAnterior.length === 0) return calcularSeniorityAlcanzado(
      evalsPersona.reduce((s, e) => s + e.puntaje, 0) / (evalsPersona.length || 1)
    );
    const promAnterior = sAnterior.reduce((s, c) => s + c.promedio, 0) / sAnterior.length;
    return calcularSeniorityAlcanzado(promAnterior);
  }, [selectedEmail, visibleEvaluations]);

  // Transformar datos para el radar - Líder
  const radarDataHardLider = useMemo(() => {
    if (hardSkillsLider.length === 0) return [];
    const firstEval = hardSkillsLider[0];
    return transformarARadarData(
      hardSkillsLider,
      skillsMatrix,
      seniorityEsperado,
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

  // Seniority esperado: siguiente nivel al alcanzado en la evaluación anterior.
  // Si solo hay un semestre → '--' (primera evaluación)
  const SENIORITY_NEXT: Record<string, Seniority> = {
    'Trainee': 'Junior',
    'Junior': 'Semi Senior',
    'Semi Senior': 'Senior',
    'Senior': 'Senior',
  };
  const seniorityEsperadoDisplay = useMemo((): string => {
    if (!selectedEmail) return seniorityAlcanzado;
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const { sAnterior } = comparePersonaBetweenPeriods(evalsPersona);
    if (sAnterior.length === 0) return '--'; // primera evaluación
    const promAnterior = sAnterior.reduce((s, c) => s + c.promedio, 0) / sAnterior.length;
    const seniorityAnterior = calcularSeniorityAlcanzado(promAnterior);
    return SENIORITY_NEXT[seniorityAnterior] || seniorityAlcanzado;
  }, [selectedEmail, visibleEvaluations, seniorityAlcanzado]);

  // Para los radars usamos el seniority alcanzado actual como referencia
  // (seniorityEsperado ya está declarado arriba)


  // Comparación semestral (S anterior vs S actual) solo si hay un evaluado seleccionado
  const comparacionTrimestral = useMemo(() => {
    if (!selectedEmail) return null;
    
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    return comparePersonaBetweenPeriods(evalsPersona);
  }, [selectedEmail, visibleEvaluations]);

  // Datos para el Dumbbell Chart: combina comparación trimestral con esperado directo de skillsMatrix
  const dumbbellData = useMemo((): DumbbellDataPoint[] => {
    if (!selectedEmail) return [];
    const { sAnterior, sActual } = comparacionTrimestral ?? { sAnterior: [], sActual: [] };

    // Si no hay comparación entre semestres, usar los datos disponibles como "actual"
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const area = evalsPersona.length > 0 ? evalsPersona[0].area : '';

    // Construir allSkills desde sActual primero, luego sAnterior como fallback
    const allSkills = new Set([
      ...sActual.map(s => s.skill),
      ...sAnterior.map(s => s.skill),
    ]);

    return Array.from(allSkills)
      .filter(skill => skill.toLowerCase() !== 'general') // Filtrar placeholder
      .map(skill => {
        const anterior = sAnterior.find(s => s.skill === skill);
        const actual = sActual.find(s => s.skill === skill);

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
      })
      .filter(d => d.autoActual > 0 || d.jefeActual > 0 || d.autoAnterior > 0 || d.jefeAnterior > 0);
  }, [comparacionTrimestral, selectedEmail, visibleEvaluations, skillsMatrix, seniorityEsperado]);

  // Datos para el gráfico de evolución semestral (múltiples S)
  const evolucionData = useMemo(() => {
    if (!selectedEmail) return [];
    const evalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const area = evalsPersona.length > 0 ? evalsPersona[0].area : '';
    return calcularEvolucionSemestral(evalsPersona, skillsMatrix, seniorityEsperado, area);
  }, [selectedEmail, visibleEvaluations, skillsMatrix, seniorityEsperado]);

  // Métricas agrupadas por área (para Vista Áreas)
  const areaStats = useMemo(() => {
    type AreaAcc = {
      nombre: string;
      personas: Set<string>;
      sumaAuto: number; countAuto: number;
      sumaJefe: number; countJefe: number;
      sumaHard: number; countHard: number;
      sumaSoft: number; countSoft: number;
    };
    const areas = new Map<string, AreaAcc>();
    visibleEvaluations.forEach(e => {
      if (!e.area) return;
      if (!areas.has(e.area)) {
        areas.set(e.area, { nombre: e.area, personas: new Set(), sumaAuto: 0, countAuto: 0, sumaJefe: 0, countJefe: 0, sumaHard: 0, countHard: 0, sumaSoft: 0, countSoft: 0 });
      }
      const a = areas.get(e.area)!;
      a.personas.add(e.evaluadoEmail);
      if (e.tipoEvaluador === 'AUTO') { a.sumaAuto += e.puntaje; a.countAuto++; }
      if (e.tipoEvaluador === 'JEFE') { a.sumaJefe += e.puntaje; a.countJefe++; }
      if (e.skillTipo === 'HARD') { a.sumaHard += e.puntaje; a.countHard++; }
      if (e.skillTipo === 'SOFT') { a.sumaSoft += e.puntaje; a.countSoft++; }
    });
    return Array.from(areas.values()).map(a => ({
      nombre: a.nombre,
      cantPersonas: a.personas.size,
      promedioAuto: a.countAuto > 0 ? +(a.sumaAuto / a.countAuto).toFixed(2) : null,
      promedioJefe: a.countJefe > 0 ? +(a.sumaJefe / a.countJefe).toFixed(2) : null,
      promedioHard: a.countHard > 0 ? +(a.sumaHard / a.countHard).toFixed(2) : null,
      promedioSoft: a.countSoft > 0 ? +(a.sumaSoft / a.countSoft).toFixed(2) : null,
      promedioGeneral: (a.countAuto + a.countJefe) > 0
        ? +((a.sumaAuto + a.sumaJefe) / (a.countAuto + a.countJefe)).toFixed(2)
        : null,
      emailsPersonas: Array.from(a.personas),
    })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [visibleEvaluations]);

  // Personas del área expandida con stats individuales
  const personasAreaExpandida = useMemo(() => {
    if (!expandedArea) return [];
    const evalsArea = visibleEvaluations.filter(e => e.area === expandedArea);
    const personaMap = new Map<string, { email: string; nombre: string; auto: number; autoCount: number; jefe: number; jefeCount: number }>();
    evalsArea.forEach(e => {
      if (!personaMap.has(e.evaluadoEmail)) {
        personaMap.set(e.evaluadoEmail, { email: e.evaluadoEmail, nombre: e.evaluadoNombre, auto: 0, autoCount: 0, jefe: 0, jefeCount: 0 });
      }
      const p = personaMap.get(e.evaluadoEmail)!;
      if (e.tipoEvaluador === 'AUTO') { p.auto += e.puntaje; p.autoCount++; }
      if (e.tipoEvaluador === 'JEFE') { p.jefe += e.puntaje; p.jefeCount++; }
    });
    return Array.from(personaMap.values()).map(p => ({
      email: p.email,
      nombre: p.nombre,
      promedioAuto: p.autoCount > 0 ? +(p.auto / p.autoCount).toFixed(2) : null,
      promedioJefe: p.jefeCount > 0 ? +(p.jefe / p.jefeCount).toFixed(2) : null,
      promedioFinal: p.autoCount > 0 && p.jefeCount > 0
        ? +((p.auto / p.autoCount + p.jefe / p.jefeCount) / 2).toFixed(2)
        : p.autoCount > 0 ? +(p.auto / p.autoCount).toFixed(2) : +(p.jefe / p.jefeCount).toFixed(2),
      brecha: p.autoCount > 0 && p.jefeCount > 0
        ? +Math.abs(p.auto / p.autoCount - p.jefe / p.jefeCount).toFixed(2) : null,
    })).sort((a, b) => b.promedioFinal - a.promedioFinal);
  }, [expandedArea, visibleEvaluations]);

  const handleResetFilters = () => {
    setSelectedArea('');
    setSelectedEmail('');
    setSelectedFormulario('');
    setSelectedPeriodo('HISTORICO');
    setHardSkillAreaIndexLider(0);
    setHardSkillAreaIndexAnalista(0);
  };

  // ===== CONSTRUIR DATOS PDF (compartido entre descargar y enviar) =====
  // SIEMPRE usa S Actual para los datos del radar, independientemente del filtro elegido en pantalla
  const buildPDFData = (): { pdfData: PDFReporteData; nombreArchivo: string; periodoLabel: string } | null => {
    if (!selectedEmail || !mostrarEvaluado) return null;

    // Evaluaciones del S Actual para el radar (siempre)
    const allEvalsPersona = visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail);
    const evalsQActual = filterByPeriod(allEvalsPersona, 'S_ACTUAL');
    const evalsPersona = evalsQActual.length > 0 ? evalsQActual : allEvalsPersona;
    const evalsHard = evalsPersona.filter(e => e.skillTipo === 'HARD');
    const evalsSoft = evalsPersona.filter(e => e.skillTipo === 'SOFT');

    const firstEval = evalsPersona[0];
    const evalArea = firstEval?.area || '';
    const evalRol = firstEval?.origen === 'LIDER' ? 'Líder' : 'Analista';

    const radarDataHard = transformarARadarData(evalsHard, skillsMatrix, seniorityEsperado, evalArea);
    const radarDataSoft = transformarARadarData(evalsSoft, skillsMatrix, seniorityEsperado, evalArea);

    const evalJefe = evalsPersona.find(e => e.tipoEvaluador === 'JEFE');
    const liderEmail = evalJefe?.evaluadorEmail || '';
    const liderUser = users.find(u => u.email === liderEmail);
    const liderNombre = liderUser?.nombre || liderEmail || 'No asignado';

    const periodoLabel = (() => {
      const fechas = evalsPersona.map(e => new Date(e.fecha)).filter(f => !isNaN(f.getTime()));
      if (fechas.length === 0) return 'S Actual';
      const min = new Date(Math.min(...fechas.map(f => f.getTime())));
      const max = new Date(Math.max(...fechas.map(f => f.getTime())));
      const fmt = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
      return min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear()
        ? fmt(max)
        : `${fmt(min)} — ${fmt(max)}`;
    })();

    let evolucion: PDFReporteData['evolucion'] = undefined;
    const comp = comparePersonaBetweenPeriods(allEvalsPersona);
    if (comp.sAnterior.length > 0 && comp.sActual.length > 0) {
      const promAnt = comp.sAnterior.reduce((s, c) => s + c.promedio, 0) / comp.sAnterior.length;
      const promAct = comp.sActual.reduce((s, c) => s + c.promedio, 0) / comp.sActual.length;
      const diff = promAct - promAnt;
      evolucion = {
        promedioAnterior: promAnt,
        promedioActual: promAct,
        tendencia: diff > 0.15 ? 'mejora' : diff < -0.15 ? 'descenso' : 'estable',
      };
    }

    const comentarios: PDFReporteData['comentarios'] = [];
    const comentarioAuto = evalsPersona.find(e => e.tipoEvaluador === 'AUTO' && e.comentarios && e.comentarios.trim() !== '');
    if (comentarioAuto) {
      comentarios.push({ tipo: 'Autoevaluación', comentario: comentarioAuto.comentarios! });
    }
    const comentarioJefe = evalsPersona.find(e => e.tipoEvaluador === 'JEFE' && e.comentarios && e.comentarios.trim() !== '');
    if (comentarioJefe) {
      comentarios.push({ tipo: 'Líder', comentario: comentarioJefe.comentarios! });
    }

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
      comentarioRRHH: sanitizeText(comentarioRRHH) || undefined,
    };

    const nombreArchivo = `Evaluacion_${mostrarEvaluado.nombre.replace(/\s+/g, '_')}.pdf`;
    return { pdfData, nombreArchivo, periodoLabel };
  };

  // ===== DESCARGAR PDF =====
  const handleDescargarPDF = async () => {
    const result = buildPDFData();
    if (!result) return;

    const pdf = await generarPDFIndividual(result.pdfData);
    pdf.save(result.nombreArchivo);
    setShowPDFModal(false);
    setComentarioRRHH('');
    setEmailDestinatarios('');
    setEmailResultado(null);
  };

  // ===== ENVIAR PDF POR EMAIL =====
  const handleEnviarEmail = async () => {
    const result = buildPDFData();
    if (!result || !mostrarEvaluado) return;

    // Parsear y sanitizar destinatarios
    const destinatariosExtra = sanitizeEmailList(emailDestinatarios);

    // Siempre incluir al evaluado, más los extras
    const todosDestinatarios = [selectedEmail, ...destinatariosExtra.filter(e => e !== selectedEmail)];

    // Validar que todos tengan formato de email válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidos = todosDestinatarios.filter(e => !emailRegex.test(e));
    if (invalidos.length > 0) {
      setEmailResultado({ tipo: 'error', mensaje: `Emails inválidos: ${invalidos.join(', ')}` });
      return;
    }

    setEnviandoEmail(true);
    setEmailResultado(null);

    try {
      const pdf = await generarPDFIndividual(result.pdfData);
      const pdfBase64 = pdfToBase64(pdf);

      const cuerpoHTML = generarCuerpoEmail(
        mostrarEvaluado.nombre,
        result.periodoLabel,
        sanitizeText(comentarioRRHH) || undefined
      );

      const response = await enviarEmailConPDF({
        destinatarios: todosDestinatarios,
        asunto: `Reporte de Evaluación de Desempeño - ${mostrarEvaluado.nombre}`,
        cuerpoHTML,
        pdfBase64,
        nombreArchivo: result.nombreArchivo,
      });

      if (response.success) {
        setEmailResultado({
          tipo: 'exito',
          mensaje: `Email enviado correctamente a: ${todosDestinatarios.join(', ')}`,
        });
        // Cerrar modal después de 3 segundos si fue exitoso
        setTimeout(() => {
          setShowPDFModal(false);
          setComentarioRRHH('');
          setEmailDestinatarios('');
          setEmailResultado(null);
        }, 3000);
      } else {
        setEmailResultado({
          tipo: 'error',
          mensaje: response.message,
        });
      }
    } catch (err) {
      setEmailResultado({
        tipo: 'error',
        mensaje: err instanceof Error ? err.message : 'Error inesperado al enviar el email',
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Handlers de carrusel (sin uso actualmente, se reactivan si se vuelve a usar carrusel de áreas)

  // Mostrar AdminDashboard si está activado y el usuario es RRHH o Director
  if (showAdmin && (currentUser?.rol === 'RRHH' || currentUser?.rol === 'Director')) {
    return (
      <div className="min-h-screen bg-stone-50">
        {/* Header con botón de regreso */}
        <header className="bg-white shadow-sm border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">⚙️ Configuraciones</h1>
                <p className="text-sm text-stone-500">{currentUser.nombre} · {currentUser.rol}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdmin(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm"
                >
                  ← Volver al Dashboard
                </button>
                <button
                  onClick={logout}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  // Dashboard normal
  return (
    <div className="min-h-screen bg-stone-50">
      <OnboardingTooltip
        steps={dashboardSteps}
        storageKey="onboarding-dashboard"
        onStepChange={(step) => {
          if (step.id === 'dashboard-metricas') {
            if (vista !== 'metricas') {
              setVista('metricas');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } else if (step.id !== 'dashboard-tabs') {
            if (vista !== 'individual') {
              setVista('individual');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        }}
      />
      {/* Header */}
      <header className="bg-brand-surface shadow-card border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-brand-t1">Dashboard RRHH</h1>
              <p className="text-sm text-brand-t2">
                {currentUser.nombre} · {currentUser.rol} · {currentUser.area}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {/* Toggle tema */}
              <button
                onClick={toggleDark}
                className="w-9 h-9 rounded-xl border border-brand-border bg-brand-surface2 flex items-center justify-center text-brand-t2 hover:text-brand-t1 transition-all"
                title={dark ? 'Modo claro' : 'Modo oscuro'}
              >
                {dark ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              {(currentUser?.rol === 'RRHH' || currentUser?.rol === 'Director') && (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configuraciones
                </button>
              )}
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
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs para alternar vista */}
        <div data-onboarding="dashboard-tabs" className="mb-6 flex flex-wrap gap-2">
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

          {/* Formulario de Evaluación - Todos los roles */}
          <button
            onClick={() => setVista('formulario')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              vista === 'formulario'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-white text-stone-700 hover:bg-orange-50 border border-stone-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Formulario
            </span>
          </button>

          {/* Vista Áreas — REMOVIDA del Dashboard, disponible en Métricas Generales */}
          {/* {false && currentUser && canSeeAll(currentUser.rol) && (
            <button className="hidden">Vista Áreas</button>
          )} */}

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

        {/* Vista Formulario - Todos los roles */}
        {vista === 'formulario' && <FormularioView />}

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
          <div data-onboarding="dashboard-metricas">
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
          </div>
        ) : null}

        {/* Vista Áreas */}
        {vista === 'areas' && canSeeAll(currentUser.rol) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Métricas por Área</h2>
              <span className="text-sm text-stone-500">{areaStats.length} área{areaStats.length !== 1 ? 's' : ''} con evaluaciones</span>
            </div>

            {areaStats.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
                <p className="text-stone-500 text-lg">No hay datos de evaluaciones aún</p>
              </div>
            ) : (
              <>
              {/* Grid de cards por área */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {areaStats.map(area => {
                  const general = area.promedioGeneral ?? 0;
                  const pct = Math.round((general / 5) * 100);
                  const colorBar = general >= 4 ? 'bg-emerald-500' : general >= 3 ? 'bg-orange-400' : 'bg-red-400';
                  const colorText = general >= 4 ? 'text-emerald-600' : general >= 3 ? 'text-orange-500' : 'text-red-500';
                  const isExpanded = expandedArea === area.nombre;
                  return (
                    <div
                      key={area.nombre}
                      className={`bg-white rounded-2xl border shadow-sm p-6 space-y-4 cursor-pointer transition-all ${
                        isExpanded ? 'border-orange-300 ring-2 ring-orange-200 shadow-md' : 'border-stone-200 hover:shadow-md hover:border-orange-200'
                      }`}
                      onClick={() => {
                        setExpandedArea(isExpanded ? null : area.nombre);
                        setExpandedAreaRadar(null);
                      }}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg leading-tight">{area.nombre}</h3>
                          <p className="text-sm text-stone-500 mt-0.5">
                            {area.cantPersonas} persona{area.cantPersonas !== 1 ? 's' : ''} evaluada{area.cantPersonas !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-extrabold ${colorText}`}>
                            {general > 0 ? general.toFixed(1) : '—'}
                          </span>
                          <svg className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Barra promedio general */}
                      <div>
                        <div className="flex justify-between text-xs font-medium text-stone-500 mb-1">
                          <span>Promedio General</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${colorBar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Auto vs Jefe */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                          <p className="text-xs font-semibold text-blue-600 mb-1">Autoevaluación</p>
                          <p className="text-xl font-bold text-blue-700">
                            {area.promedioAuto !== null ? area.promedioAuto.toFixed(1) : '—'}
                          </p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-3 text-center">
                          <p className="text-xs font-semibold text-orange-600 mb-1">Evaluación Jefe</p>
                          <p className="text-xl font-bold text-orange-700">
                            {area.promedioJefe !== null ? area.promedioJefe.toFixed(1) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Hard vs Soft */}
                      {(area.promedioHard !== null || area.promedioSoft !== null) && (
                        <div className="border-t border-stone-100 pt-3 grid grid-cols-2 gap-3">
                          <div className="text-center">
                            <p className="text-xs text-stone-400 font-medium mb-0.5">Hard Skills</p>
                            <p className="text-base font-bold text-slate-700">
                              {area.promedioHard !== null ? area.promedioHard.toFixed(1) : '—'}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-stone-400 font-medium mb-0.5">Soft Skills</p>
                            <p className="text-base font-bold text-slate-700">
                              {area.promedioSoft !== null ? area.promedioSoft.toFixed(1) : '—'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Brecha auto-jefe */}
                      {area.promedioAuto !== null && area.promedioJefe !== null && (
                        <div className="border-t border-stone-100 pt-3">
                          <p className="text-xs text-stone-500 font-medium">
                            Brecha auto → jefe:{' '}
                            <span className={`font-bold ${
                              area.promedioJefe - area.promedioAuto > 0
                                ? 'text-emerald-600'
                                : area.promedioJefe - area.promedioAuto < 0
                                ? 'text-red-500'
                                : 'text-stone-400'
                            }`}>
                              {area.promedioJefe - area.promedioAuto > 0 ? '+' : ''}
                              {(area.promedioJefe - area.promedioAuto).toFixed(2)}
                            </span>
                          </p>
                        </div>
                      )}

                      {!isExpanded && (
                        <p className="text-xs text-orange-500 font-semibold text-center pt-1">Ver desglose por persona →</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Panel de desglose del área expandida */}
              {expandedArea && (
                <div className="bg-white rounded-2xl border border-orange-200 shadow-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Área: <span className="text-orange-600">{expandedArea}</span>
                    </h3>
                    <button
                      onClick={() => { setExpandedArea(null); setExpandedAreaRadar(null); }}
                      className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-600 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Tabla de personas del área */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-stone-200">
                          <th className="text-left p-3 font-bold text-stone-700">Nombre</th>
                          <th className="text-center p-3 font-bold text-stone-700">Auto</th>
                          <th className="text-center p-3 font-bold text-stone-700">Jefe</th>
                          <th className="text-center p-3 font-bold text-stone-700">Final</th>
                          <th className="text-center p-3 font-bold text-stone-700">Brecha</th>
                          <th className="text-center p-3 font-bold text-stone-700">Pentágono</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personasAreaExpandida.map(p => {
                          const pctFinal = Math.round((p.promedioFinal / 5) * 100);
                          const colorFinal = p.promedioFinal >= 4 ? 'text-emerald-600' : p.promedioFinal >= 3 ? 'text-orange-500' : 'text-red-500';
                          const brechaAlta = p.brecha !== null && p.brecha > 1;
                          const isSelected = expandedAreaRadar === p.email;
                          return (
                            <tr key={p.email} className={`border-b border-stone-100 hover:bg-orange-50 transition ${isSelected ? 'bg-orange-50 ring-2 ring-inset ring-orange-200' : ''}`}>
                              <td className="p-3 font-semibold text-slate-900">{p.nombre}</td>
                              <td className="text-center p-3 text-blue-600 font-medium">
                                {p.promedioAuto !== null ? p.promedioAuto.toFixed(2) : '—'}
                              </td>
                              <td className="text-center p-3 text-orange-600 font-medium">
                                {p.promedioJefe !== null ? p.promedioJefe.toFixed(2) : '—'}
                              </td>
                              <td className="text-center p-3">
                                <div className="flex items-center gap-2 justify-center">
                                  <span className={`font-bold ${colorFinal}`}>{p.promedioFinal.toFixed(2)}</span>
                                  <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${pctFinal}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="text-center p-3">
                                {p.brecha !== null ? (
                                  <span className={`font-bold text-xs px-2 py-1 rounded-full ${brechaAlta ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600'}`}>
                                    {brechaAlta ? '⚠ ' : ''}{p.brecha.toFixed(2)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="text-center p-3">
                                <button
                                  onClick={() => setExpandedAreaRadar(isSelected ? null : p.email)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                    isSelected
                                      ? 'bg-orange-500 text-white'
                                      : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                                  }`}
                                >
                                  {isSelected ? 'Ocultar' : 'Ver'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Radar de persona seleccionada en área */}
                  {expandedAreaRadar && (() => {
                    const persona = personasAreaExpandida.find(p => p.email === expandedAreaRadar);
                    const userRol = users.find(u => u.email === expandedAreaRadar)?.rol;
                    return persona ? (
                      <PersonaRadarPanel
                        email={expandedAreaRadar}
                        nombre={persona.nombre}
                        area={expandedArea}
                        skillsMatrix={skillsMatrix}
                        rolObjetivo={userRol === 'Lider' ? 'LIDER' : 'ANALISTA'}
                        onClose={() => setExpandedAreaRadar(null)}
                      />
                    ) : null;
                  })()}
                </div>
              )}
              </>
            )}
          </div>
        )}
        {/* Vista Individual */}
        {vista === 'individual' && (
          <>
            {/* Filtros - Sticky con botón de colapsar */}
            {canSeeAll(currentUser.rol) && (
              <div data-onboarding="dashboard-filtros" className="sticky top-0 z-10 bg-stone-50 pt-4 pb-2 mb-6">
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

            {/* Panel de desempeño individual — usa el mismo componente que el Líder */}
            {selectedEmail && mostrarEvaluado && (
              <>
                {/* Botón PDF solo si hay evaluaciones */}
                {canSeeAll(currentUser.rol) && visibleEvaluations.some(e => e.evaluadoEmail === selectedEmail) && (
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={() => setShowPDFModal(true)}
                      className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition-all hover:shadow-md font-semibold text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descargar / Enviar Reporte
                    </button>
                  </div>
                )}
                <MiDesempenoPanel
                  evaluaciones={visibleEvaluations.filter(e => e.evaluadoEmail === selectedEmail)}
                  skillsMatrix={skillsMatrix}
                  persona={{
                    email: selectedEmail,
                    nombre: mostrarEvaluado.nombre,
                    area: visibleEvaluations.find(e => e.evaluadoEmail === selectedEmail)?.area || ''
                  }}
                  titulo={mostrarEvaluado.nombre}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Modal PDF + Email */}
      {showPDFModal && mostrarEvaluado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Reporte PDF</h3>
              <button
                onClick={() => { setShowPDFModal(false); setComentarioRRHH(''); setEmailDestinatarios(''); setEmailResultado(null); }}
                className="p-1.5 hover:bg-stone-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-stone-600 mb-4">
              Reporte de <span className="font-semibold">{mostrarEvaluado.nombre}</span>
              <span className="text-stone-400 ml-1">({selectedEmail})</span>
            </p>

            {/* Comentario RRHH */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-stone-700 mb-2">
                Observaciones de RRHH (opcional)
              </label>
              <textarea
                value={comentarioRRHH}
                onChange={(e) => setComentarioRRHH(e.target.value)}
                placeholder="Agregar comentario para incluir en el reporte..."
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-24 text-sm"
              />
            </div>

            {/* Separador */}
            <div className="border-t border-stone-200 my-5" />

            {/* Sección de envío por email */}
            <div className="mb-4">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Enviar por Email
              </h4>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">Destinatario principal:</span> {selectedEmail}
                </p>
              </div>

              <label className="block text-sm font-medium text-stone-600 mb-2">
                Destinatarios adicionales (opcional)
              </label>
              <input
                type="text"
                value={emailDestinatarios}
                onChange={(e) => setEmailDestinatarios(e.target.value)}
                placeholder="email1@empresa.com, email2@empresa.com"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
              <p className="text-xs text-stone-400 mt-1">
                Separá múltiples emails con comas. El reporte se enviará al evaluado y a los adicionales.
              </p>
            </div>

            {/* Resultado del envío */}
            {emailResultado && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
                emailResultado.tipo === 'exito'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {emailResultado.tipo === 'exito' ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {emailResultado.mensaje}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPDFModal(false); setComentarioRRHH(''); setEmailDestinatarios(''); setEmailResultado(null); }}
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
              <button
                onClick={handleEnviarEmail}
                disabled={enviandoEmail}
                className={`w-full px-4 py-2.5 rounded-xl transition font-semibold text-sm flex items-center justify-center gap-2 ${
                  enviandoEmail
                    ? 'bg-green-400 text-white cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-md'
                }`}
              >
                {enviandoEmail ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Enviar Reporte por Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
