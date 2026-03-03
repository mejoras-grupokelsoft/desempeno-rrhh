// src/components/MetricasRRHH.tsx
import { useMemo, useState, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Scatter } from 'recharts';
import type { Evaluation, User } from '../types';
import { calcularSeniorityAlcanzado, transformarARadarData } from '../utils/calculations';
import { getUniqueAreas, getUniqueEvaluados } from '../utils/filters';
import { filterByPeriod, calcularTendenciaSeniority, calcularBandasSeniority, PERIODOS, type PeriodoType } from '../utils/dateUtils';
import { compararSkillsPorPeriodo } from '../utils/newChartCalculations';
import { SkillBreakdownInline } from './SkillBreakdown';
import type { Seniority } from '../types';
import { generarPDFIndividual, generarPDFConsolidado, type PDFReporteData } from '../utils/pdfGenerator';
import { comparePersonaBetweenPeriods } from '../utils/dateUtils';
import { generarCuerpoEmail, enviarEmailConPDF, pdfToBase64, type ResultadoEvaluacion } from '../utils/emailService';
import PeriodFilter from './shared/PeriodFilter';
import Pagination from './shared/Pagination';

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

export default function MetricasRRHH({ evaluations, users }: MetricasRRHHProps): React.ReactElement {
  // Estados para filtros
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedSeniority, setSelectedSeniority] = useState<Seniority | ''>('');
  const [selectedFormulario, setSelectedFormulario] = useState<'LIDER' | 'ANALISTA' | ''>('');
  const [selectedPeriodo, setSelectedPeriodo] = useState<PeriodoType>('HISTORICO');
  const [filtroModo, setFiltroModo] = useState<'periodo' | 'rango'>('periodo');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
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
    // Primero filtrar por período o rango personalizado
    let result: Evaluation[];
    
    if (filtroModo === 'periodo') {
      result = filterByPeriod(evaluations, selectedPeriodo);
    } else if (filtroModo === 'rango' && fechaInicio && fechaFin) {
      result = evaluations.filter(e => {
        const fecha = new Date(e.fecha);
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999); // Incluir todo el día final
        return fecha >= inicio && fecha <= fin;
      });
    } else {
      result = evaluations; // Si rango no está completo, mostrar todo
    }

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
  }, [evaluations, selectedArea, selectedEmail, selectedFormulario, selectedPeriodo, filtroModo, fechaInicio, fechaFin]);

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

      // Puntaje final: promedio simple, nunca mayor al puntaje del líder
      const promedioSimple = (promedioAuto + promedioJefe) / 2;
      const promedioFinal = promedioAuto > 0 && promedioJefe > 0
        ? Math.min(promedioSimple, promedioJefe)
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

  // Estado para email masivo
  const [selectedForEmail, setSelectedForEmail] = useState<Set<string>>(new Set());
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkEmailStatus, setBulkEmailStatus] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [bulkConfirmModal, setBulkConfirmModal] = useState<{ isOpen: boolean; count: number }>({ isOpen: false, count: 0 });

  // Estado para drill-down (desglose de skills) - ahora inline
  const [drillDownPersona, setDrillDownPersona] = useState<{
    email: string;
    nombre: string;
    origen: 'ANALISTA' | 'LIDER';
  } | null>(null);
  
  // Estados para modal de PDF
  const [modalPDFAbierto, setModalPDFAbierto] = useState<boolean>(false);
  const [personaParaPDF, setPersonaParaPDF] = useState<any>(null);
  const [comentarioRRHH, setComentarioRRHH] = useState<string>('');
  
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

  // Estado de envío individual
  const [isSendingIndividual, setIsSendingIndividual] = useState(false);
  const [individualEmailResult, setIndividualEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Función para abrir modal PDF con datos de persona
  const handleAbrirModalPDF = (persona: any) => {
    setPersonaParaPDF(persona);
    setComentarioRRHH('');
    setIndividualEmailResult(null);
    setModalPDFAbierto(true);
  };

  // Helper: construir PDF data para una persona
  const buildPDFData = (persona: any): { pdf: ReturnType<typeof generarPDFIndividual>; nombreArchivo: string } => {
    const allEvalsPersona = evaluations.filter(e => e.evaluadoEmail === persona.email);
    const evalsQActual = filterByPeriod(allEvalsPersona, 'S_ACTUAL');
    const evalsPersona = evalsQActual.length > 0 ? evalsQActual : allEvalsPersona;

    const evalsHard = evalsPersona.filter(e => e.skillTipo === 'HARD');
    const evalsSoft = evalsPersona.filter(e => e.skillTipo === 'SOFT');

    const radarDataHard = transformarARadarData(evalsHard, [], persona.seniorityAlcanzado, persona.rol, persona.area);
    const radarDataSoft = transformarARadarData(evalsSoft, [], persona.seniorityAlcanzado, persona.rol, persona.area);

    const evalJefe = evalsPersona.find(e => e.tipoEvaluador === 'JEFE');
    const liderEmail = evalJefe?.evaluadorEmail || '';
    const liderUser = users.find(u => u.email === liderEmail);
    const liderNombre = liderUser?.nombre || liderEmail || 'No asignado';

    const fechas = evalsPersona.map(e => new Date(e.fecha));
    const fechaMasReciente = evalsPersona.length > 0 ? new Date(Math.max(...fechas.map(f => f.getTime()))) : new Date();

    let evolucion: PDFReporteData['evolucion'] = undefined;
    const comp = comparePersonaBetweenPeriods(allEvalsPersona);
    if (comp.sAnterior.length > 0 && comp.sActual.length > 0) {
      const promAnterior = comp.sAnterior.reduce((s, c) => s + c.promedio, 0) / comp.sAnterior.length;
      const promActual = comp.sActual.reduce((s, c) => s + c.promedio, 0) / comp.sActual.length;
      const diff = promActual - promAnterior;
      evolucion = {
        promedioAnterior: promAnterior,
        promedioActual: promActual,
        tendencia: diff > 0.15 ? 'mejora' : diff < -0.15 ? 'descenso' : 'estable',
      };
    }

    const comentarios: PDFReporteData['comentarios'] = [];
    const comentarioAuto = evalsPersona.find(e => e.tipoEvaluador === 'AUTO' && e.comentarios?.trim());
    if (comentarioAuto) comentarios.push({ tipo: 'Autoevaluación', comentario: comentarioAuto.comentarios! });
    const comentarioJefe = evalsPersona.find(e => e.tipoEvaluador === 'JEFE' && e.comentarios?.trim());
    if (comentarioJefe) comentarios.push({ tipo: 'Líder', comentario: comentarioJefe.comentarios! });

    const pdfData: PDFReporteData = {
      evaluadoNombre: persona.nombre,
      evaluadoEmail: persona.email,
      rol: persona.rol,
      area: persona.area,
      periodoEvaluado: 'S Actual',
      liderEvaluadorNombre: liderNombre,
      promedioGeneral: persona.promedioFinal,
      seniorityAlcanzado: persona.seniorityAlcanzado,
      radarDataHard,
      radarDataSoft,
      evolucion,
      seniorityEsperado: persona.seniorityEsperado || 'N/D',
      comentarios,
      comentarioRRHH: comentarioRRHH.trim() || undefined,
    };

    const pdf = generarPDFIndividual(pdfData);
    const nombreArchivo = `Evaluacion_${persona.nombre.replace(/\s+/g, '_')}_${fechaMasReciente.getFullYear()}.pdf`;
    return { pdf, nombreArchivo };
  };

  // Handler envío masivo de emails
  const handleInitiateBulkSendEmails = () => {
    if (selectedForEmail.size === 0) return;
    if (selectedForEmail.size > 50) {
      alert('⚠️ Máximo 50 personas por envío. Por favor selecciona menos personas.');
      return;
    }
    // Mostrar modal de confirmación si hay más de 5 personas
    if (selectedForEmail.size > 5) {
      setBulkConfirmModal({ isOpen: true, count: selectedForEmail.size });
    } else {
      // Si son 5 o menos, enviar directamente sin confirmar
      handleBulkSendEmails();
    }
  };

  const handleBulkSendEmails = async () => {
    if (selectedForEmail.size === 0) return;
    setIsSendingBulk(true);
    setBulkEmailStatus(null);

    const personasSeleccionadas = filteredResultados.filter(p => selectedForEmail.has(p.email));
    let sent = 0;
    let failed = 0;

    for (const persona of personasSeleccionadas) {
      try {
        const { pdf, nombreArchivo } = buildPDFData(persona);
        const resultado: ResultadoEvaluacion = {
          promedioAuto: persona.promedioAuto,
          promedioJefe: persona.promedioJefe,
          promedioFinal: persona.promedioFinal,
          seniorityAlcanzado: persona.seniorityAlcanzado,
          area: persona.area,
          rol: persona.rol,
        };
        const cuerpo = generarCuerpoEmail(persona.nombre, 'S Actual', undefined, resultado);
        const pdfBase64 = pdfToBase64(pdf);

        const res = await enviarEmailConPDF({
          destinatarios: [persona.email],
          asunto: `Resultados de tu Evaluación de Desempeño - Kelsoft`,
          cuerpoHTML: cuerpo,
          pdfBase64,
          nombreArchivo,
        });

        if (res.success) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setIsSendingBulk(false);
    setBulkEmailStatus({ sent, failed, total: personasSeleccionadas.length });
    setSelectedForEmail(new Set());
  };

  // Función para generar PDF individual
  const handleGenerarPDFIndividual = async (doSendEmail: boolean = false) => {
    if (!personaParaPDF) return;

    setIndividualEmailResult(null);
    const { pdf, nombreArchivo } = buildPDFData(personaParaPDF);

    // Siempre descargar el PDF
    pdf.save(nombreArchivo);

    if (doSendEmail) {
      setIsSendingIndividual(true);
      try {
        const resultado: ResultadoEvaluacion = {
          promedioAuto: personaParaPDF.promedioAuto,
          promedioJefe: personaParaPDF.promedioJefe,
          promedioFinal: personaParaPDF.promedioFinal,
          seniorityAlcanzado: personaParaPDF.seniorityAlcanzado,
          area: personaParaPDF.area,
          rol: personaParaPDF.rol,
        };
        const cuerpo = generarCuerpoEmail(
          personaParaPDF.nombre,
          'S Actual',
          comentarioRRHH.trim() || undefined,
          resultado,
        );
        const pdfBase64 = pdfToBase64(pdf);

        const res = await enviarEmailConPDF({
          destinatarios: [personaParaPDF.email],
          asunto: `Resultados de tu Evaluación de Desempeño - Kelsoft`,
          cuerpoHTML: cuerpo,
          pdfBase64,
          nombreArchivo,
        });

        setIndividualEmailResult({ ok: res.success, msg: res.message });
      } catch (err) {
        setIndividualEmailResult({ ok: false, msg: err instanceof Error ? err.message : 'Error al enviar' });
      } finally {
        setIsSendingIndividual(false);
      }
      // No cerrar modal para que el usuario vea el resultado
      return;
    }

    // Cerrar modal
    setModalPDFAbierto(false);
    setComentarioRRHH('');
  };

  // Función para generar PDF consolidado
  const handleGenerarPDFConsolidado = () => {
    const area = selectedArea || 'Todas las áreas';
    const periodoObj = PERIODOS.find(p => p.value === selectedPeriodo);
    const periodoLabel = periodoObj?.label || 'Personalizado';
    
    // Calcular promedio general del área
    const promedioArea = resultadosPorPersona.length > 0
      ? resultadosPorPersona.reduce((sum, p) => sum + p.promedioFinal, 0) / resultadosPorPersona.length
      : 0;
    
    const pdf = generarPDFConsolidado(
      area,
      periodoLabel,
      filteredEvaluations,
      promedioArea,
      resultadosPorPersona.length
    );

    const nombreArchivo = `Reporte_Consolidado_${area.replace(/\s+/g, '_')}_${periodoLabel.replace(/\s+/g, '_')}.pdf`;
    pdf.save(nombreArchivo);
  };

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
            <PeriodFilter
              filtroModo={filtroModo}
              setFiltroModo={setFiltroModo}
              selectedPeriodo={selectedPeriodo}
              setSelectedPeriodo={setSelectedPeriodo}
              fechaInicio={fechaInicio}
              setFechaInicio={setFechaInicio}
              fechaFin={fechaFin}
              setFechaFin={setFechaFin}
              accentColor="orange"
            />

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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Resumen General
          </h2>
          <button
            onClick={handleGenerarPDFConsolidado}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-semibold shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Reporte Consolidado PDF
          </button>
        </div>
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
          Brecha Promedio (Auto vs Jefe)
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
                  <span className="font-semibold">Trainee (0-1)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#fed7aa' }}></span>
                  <span className="font-semibold">Junior (1-2)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#d1fae5' }}></span>
                  <span className="font-semibold">Semi Senior (2-3)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#dbeafe' }}></span>
                  <span className="font-semibold">Senior (3-4)</span>
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
                {/* Trainee: 0-1 */}
                <Area type="monotone" dataKey={() => 1} fill="url(#traineeGrad)" stroke="none" />
                {/* Junior: 1-2 */}
                <Area type="monotone" dataKey={() => 2} fill="url(#juniorGrad)" stroke="none" />
                {/* Semi Senior: 2-3 */}
                <Area type="monotone" dataKey={() => 3} fill="url(#semiSeniorGrad)" stroke="none" />
                {/* Senior: 3-4 */}
                <Area type="monotone" dataKey={() => 4} fill="url(#seniorGrad)" stroke="none" />
                
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
                  <span className="font-semibold">Trainee (0-1)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#fed7aa' }}></span>
                  <span className="font-semibold">Junior (1-2)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#d1fae5' }}></span>
                  <span className="font-semibold">Semi Senior (2-3)</span>
                </span>
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="w-3 h-3" style={{ backgroundColor: '#dbeafe' }}></span>
                  <span className="font-semibold">Senior (3-4)</span>
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
                {/* Trainee: 0-1 */}
                <Area type="monotone" dataKey={() => 1} fill="url(#traineeGradLideres)" stroke="none" />
                {/* Junior: 1-2 */}
                <Area type="monotone" dataKey={() => 2} fill="url(#juniorGradLideres)" stroke="none" />
                {/* Semi Senior: 2-3 */}
                <Area type="monotone" dataKey={() => 3} fill="url(#semiSeniorGradLideres)" stroke="none" />
                {/* Senior: 3-4 */}
                <Area type="monotone" dataKey={() => 4} fill="url(#seniorGradLideres)" stroke="none" />
                
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
        {/* Encabezado con controles masivos */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Resultados Individuales
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Seleccionar / Deseleccionar todos */}
            <button
              onClick={() => {
                if (selectedForEmail.size === filteredResultados.length && filteredResultados.length > 0) {
                  setSelectedForEmail(new Set());
                } else {
                  setSelectedForEmail(new Set(filteredResultados.map(p => p.email)));
                }
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition"
            >
              {selectedForEmail.size === filteredResultados.length && filteredResultados.length > 0
                ? '☐ Deseleccionar todos'
                : '☑ Seleccionar todos'}
            </button>
            {/* Envío masivo */}
            {selectedForEmail.size > 0 && (
              <button
                onClick={handleInitiateBulkSendEmails}
                disabled={isSendingBulk}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition font-semibold text-sm shadow-sm hover:shadow-md"
              >
                {isSendingBulk ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Enviando…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Enviar email a {selectedForEmail.size} {selectedForEmail.size === 1 ? 'persona' : 'personas'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Resultado del envío masivo */}
        {bulkEmailStatus && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm font-semibold ${
            bulkEmailStatus.failed === 0
              ? 'bg-green-50 text-green-800 border border-green-200'
              : bulkEmailStatus.sent === 0
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            <span>{bulkEmailStatus.failed === 0 ? '✅' : bulkEmailStatus.sent === 0 ? '❌' : '⚠️'}</span>
            <span>
              Enviados: <strong>{bulkEmailStatus.sent}</strong> de {bulkEmailStatus.total}
              {bulkEmailStatus.failed > 0 && ` · Fallidos: ${bulkEmailStatus.failed}`}
            </span>
            <button onClick={() => setBulkEmailStatus(null)} className="ml-auto text-xs underline opacity-60 hover:opacity-100">
              Cerrar
            </button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-stone-200">
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={selectedForEmail.size === filteredResultados.length && filteredResultados.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedForEmail(new Set(filteredResultados.map(p => p.email)));
                    } else {
                      setSelectedForEmail(new Set());
                    }
                  }}
                  className="w-4 h-4 accent-orange-500 cursor-pointer"
                  title="Seleccionar / deseleccionar todos"
                />
              </th>
              <th className="text-left p-3 font-bold text-stone-700">Nombre</th>
              <th className="text-left p-3 font-bold text-stone-700">Área</th>
              <th className="text-left p-3 font-bold text-stone-700">Rol</th>
              <th className="text-center p-3 font-bold text-stone-700">Fecha</th>
              <th className="text-center p-3 font-bold text-stone-700">Auto</th>
              <th className="text-center p-3 font-bold text-stone-700">Líder</th>
              <th className="text-center p-3 font-bold text-stone-700">Final</th>
              <th className="text-center p-3 font-bold text-stone-700">Seniority</th>
              <th className="text-center p-3 font-bold text-stone-700">Brecha</th>
              <th className="text-center p-3 font-bold text-stone-700">PDF</th>
            </tr>
          </thead>
          <tbody>
            {paginatedResultados.map((persona) => (
              <tr
                key={persona.email}
                className={`border-b border-stone-100 hover:bg-orange-50 transition ${
                  selectedForEmail.has(persona.email) ? 'bg-orange-50' : ''
                }`}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedForEmail.has(persona.email)}
                    onChange={(e) => {
                      const next = new Set(selectedForEmail);
                      if (e.target.checked) next.add(persona.email);
                      else next.delete(persona.email);
                      setSelectedForEmail(next);
                    }}
                    className="w-4 h-4 accent-orange-500 cursor-pointer"
                  />
                </td>
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
                <td className="text-center p-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAbrirModalPDF(persona);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-semibold text-xs shadow-sm hover:shadow-md"
                    title="Generar PDF individual"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredResultados.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          accentColor="orange"
        />
      </div>

      {/* Modal para generar PDF con comentario */}
      {modalPDFAbierto && personaParaPDF && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">PDF + Email Individual</h3>
                <p className="text-sm text-stone-600 mt-1">Evaluación de {personaParaPDF.nombre}</p>
              </div>
              <button
                onClick={() => {
                  setModalPDFAbierto(false);
                  setComentarioRRHH('');
                  setIndividualEmailResult(null);
                }}
                className="text-stone-400 hover:text-stone-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview de datos */}
            <div className="bg-stone-50 rounded-xl p-4 mb-6 border border-stone-200">
              <h4 className="text-sm font-bold text-stone-700 mb-3">Datos que se incluirán:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-stone-500">Email:</span>
                  <p className="font-semibold text-slate-900">{personaParaPDF.email}</p>
                </div>
                <div>
                  <span className="text-stone-500">Área:</span>
                  <p className="font-semibold text-slate-900">{personaParaPDF.area}</p>
                </div>
                <div>
                  <span className="text-stone-500">Auto / Líder / Final:</span>
                  <p className="font-semibold text-slate-900">
                    {personaParaPDF.promedioAuto.toFixed(2)} / {personaParaPDF.promedioJefe.toFixed(2)} → <span className="text-orange-600">{personaParaPDF.promedioFinal.toFixed(2)}</span>
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Seniority Alcanzado:</span>
                  <p className="font-semibold text-slate-900">{personaParaPDF.seniorityAlcanzado}</p>
                </div>
              </div>
            </div>

            {/* Campo para comentario adicional */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-stone-700 mb-2">
                Comentario adicional de RRHH (opcional):
              </label>
              <textarea
                value={comentarioRRHH}
                onChange={(e) => setComentarioRRHH(e.target.value)}
                placeholder="Ej: Felicitaciones por el excelente desempeño. Continuar con el plan de capacitación en..."
                rows={3}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm"
              />
              <p className="text-xs text-stone-500 mt-1">
                Aparece en el PDF y en el cuerpo del email.
              </p>
            </div>

            {/* Resultado del envío individual */}
            {individualEmailResult && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-xl mb-4 text-sm ${
                individualEmailResult.ok
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <span className="text-lg">{individualEmailResult.ok ? '✅' : '❌'}</span>
                <span className="font-semibold">{individualEmailResult.msg}</span>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleGenerarPDFIndividual(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Solo Descargar PDF
              </button>
              <button
                onClick={() => handleGenerarPDFIndividual(true)}
                disabled={isSendingIndividual}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition font-semibold"
              >
                {isSendingIndividual ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Enviando…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Descargar + Enviar Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para envío masivo */}
      {bulkConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2m0-14v2m0-4v2m0 4v2M7.08 6.06L5.648 4.617m1.414 1.414l1.414 1.414m-1.414-1.414L5.648 7.505m1.414-1.414l1.414-1.414M17.92 6.06l1.414-1.413m-1.414 1.414l1.414 1.414m-1.414-1.414l-1.414-1.414m1.414 1.414l-1.414 1.414" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirmar envío masivo</h3>
                <p className="text-sm text-stone-600 mt-1">Esta acción no se puede deshacer</p>
              </div>
            </div>

            {/* Contenido */}
            <div className="bg-amber-50 rounded-lg p-4 mb-6 border border-amber-200">
              <p className="text-sm text-amber-900">
                Vas a enviar <strong className="text-lg">{bulkConfirmModal.count}</strong> email{bulkConfirmModal.count !== 1 ? 's' : ''} con evaluaciones finales y PDF adjuntos.
              </p>
              <p className="text-xs text-amber-700 mt-2">
                ⏱️ El proceso puede tomar algunos minutos. No cierres esta página mientras se envían.
              </p>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setBulkConfirmModal({ isOpen: false, count: 0 })}
                className="flex-1 px-4 py-3 rounded-lg border border-stone-200 text-stone-700 font-semibold text-sm hover:bg-stone-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setBulkConfirmModal({ isOpen: false, count: 0 });
                  handleBulkSendEmails();
                }}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600 transition"
              >
                Confirmar envío
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
