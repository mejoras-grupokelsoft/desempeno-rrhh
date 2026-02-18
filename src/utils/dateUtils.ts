// src/utils/dateUtils.ts

// Exportar funciones de nuevos gráficos
export { calcularSaltoDeNivel, calcularHardSoftStack, calcularBandasSeniority } from './newChartCalculations';

export type PeriodoType = 
  | 'HISTORICO'
  | 'ESTE_ANO'
  | 'Q_ACTUAL'
  | 'Q_ANTERIOR'
  | 'ULTIMOS_2Q'
  | 'ULTIMOS_3Q'
  | 'PRIMER_SEMESTRE'
  | 'SEGUNDO_SEMESTRE'
  | 'ULTIMOS_6_MESES'
  | 'ULTIMOS_3_MESES';

export interface PeriodoOption {
  value: PeriodoType;
  label: string;
}

export const PERIODOS: PeriodoOption[] = [
  { value: 'HISTORICO', label: 'Histórico (Todo)' },
  { value: 'ESTE_ANO', label: 'Este Año' },
  { value: 'Q_ACTUAL', label: 'Q Actual' },
  { value: 'Q_ANTERIOR', label: 'Q Anterior' },
  { value: 'ULTIMOS_2Q', label: 'Últimos 2 Trimestres' },
  { value: 'ULTIMOS_3Q', label: 'Últimos 3 Trimestres' },
  { value: 'PRIMER_SEMESTRE', label: 'Primer Semestre (Ene-Jun)' },
  { value: 'SEGUNDO_SEMESTRE', label: 'Segundo Semestre (Jul-Dic)' },
  { value: 'ULTIMOS_6_MESES', label: 'Últimos 6 Meses' },
  { value: 'ULTIMOS_3_MESES', label: 'Últimos 3 Meses' },
];

/**
 * Obtiene el quarter (trimestre) de una fecha
 * Q1: Enero-Marzo, Q2: Abril-Junio, Q3: Julio-Septiembre, Q4: Octubre-Diciembre
 */
export function getQuarter(date: Date): number {
  const month = date.getMonth(); // 0-11
  return Math.floor(month / 3) + 1;
}

/**
 * Obtiene el quarter anterior al actual
 */
export function getPreviousQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const currentQuarter = getQuarter(now);
  const currentYear = now.getFullYear();

  if (currentQuarter === 1) {
    return { year: currentYear - 1, quarter: 4 };
  } else {
    return { year: currentYear, quarter: currentQuarter - 1 };
  }
}

/**
 * Obtiene el rango de fechas del quarter anterior
 */
export function getPreviousQuarterRange(): { start: Date; end: Date } {
  const { year, quarter } = getPreviousQuarter();
  
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59); // Último día del mes
  
  return { start, end };
}

/**
 * Obtiene el rango de fechas del quarter actual
 */
export function getCurrentQuarterRange(): { start: Date; end: Date } {
  const now = new Date();
  const currentQuarter = getQuarter(now);
  const year = now.getFullYear();
  
  const startMonth = (currentQuarter - 1) * 3;
  const endMonth = startMonth + 2;
  
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59);
  
  return { start, end };
}

/**
 * Obtiene el rango de fechas de los últimos N trimestres
 */
export function getLastNQuartersRange(n: number): { start: Date; end: Date } {
  const now = new Date();
  const currentQuarter = getQuarter(now);
  const currentYear = now.getFullYear();
  
  // Calcular el trimestre de inicio
  let startQuarter = currentQuarter - n + 1;
  let startYear = currentYear;
  
  while (startQuarter <= 0) {
    startQuarter += 4;
    startYear -= 1;
  }
  
  const startMonth = (startQuarter - 1) * 3;
  const start = new Date(startYear, startMonth, 1);
  
  const endMonth = (currentQuarter - 1) * 3 + 2;
  const end = new Date(currentYear, endMonth + 1, 0, 23, 59, 59);
  
  return { start, end };
}

/**
 * Obtiene el rango de fechas del año actual
 */
export function getCurrentYearRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);
  
  return { start, end };
}

/**
 * Obtiene el rango del primer semestre (Ene-Jun)
 */
export function getFirstSemesterRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  
  const start = new Date(year, 0, 1);
  const end = new Date(year, 5, 30, 23, 59, 59);
  
  return { start, end };
}

/**
 * Obtiene el rango del segundo semestre (Jul-Dic)
 */
export function getSecondSemesterRange(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  
  const start = new Date(year, 6, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);
  
  return { start, end };
}

/**
 * Obtiene el rango de los últimos N meses
 */
export function getLastNMonthsRange(n: number): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const start = new Date(now);
  start.setMonth(start.getMonth() - n);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

/**
 * Filtra evaluaciones por período
 */
export function filterByPeriod<T extends { fecha: string }>(
  items: T[],
  periodo: PeriodoType
): T[] {
  if (periodo === 'HISTORICO') {
    return items;
  }

  let range: { start: Date; end: Date };

  switch (periodo) {
    case 'ESTE_ANO':
      range = getCurrentYearRange();
      break;
    case 'Q_ACTUAL':
      range = getCurrentQuarterRange();
      break;
    case 'Q_ANTERIOR':
      range = getPreviousQuarterRange();
      break;
    case 'ULTIMOS_2Q':
      range = getLastNQuartersRange(2);
      break;
    case 'ULTIMOS_3Q':
      range = getLastNQuartersRange(3);
      break;
    case 'PRIMER_SEMESTRE':
      range = getFirstSemesterRange();
      break;
    case 'SEGUNDO_SEMESTRE':
      range = getSecondSemesterRange();
      break;
    case 'ULTIMOS_6_MESES':
      range = getLastNMonthsRange(6);
      break;
    case 'ULTIMOS_3_MESES':
      range = getLastNMonthsRange(3);
      break;
    default:
      return items;
  }
  
  return items.filter(item => {
    const itemDate = new Date(item.fecha);
    return itemDate >= range.start && itemDate <= range.end;
  });
}

/**
 * Agrupa evaluaciones por mes y seniority para gráfico evolutivo de múltiples líneas
 */
export function groupByMonthAndSeniority<T extends { fecha: string; puntaje: number; evaluadoEmail: string; tipoEvaluador: string }>(
  items: T[],
  usersByEmail: Map<string, { seniority: string }>
): Array<{ mes: string; Trainee: number; Junior: number; 'Semi Senior': number; Senior: number }> {
  // Agrupar por mes-seniority-persona
  const porMes = new Map<string, Map<string, Map<string, { sumAuto: number; sumJefe: number; countAuto: number; countJefe: number }>>>();

  items.forEach(item => {
    const date = new Date(item.fecha);
    const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const userInfo = usersByEmail.get(item.evaluadoEmail);
    if (!userInfo) return;
    
    const seniority = userInfo.seniority;
    
    if (!porMes.has(mesKey)) {
      porMes.set(mesKey, new Map());
    }
    
    const seniorityMap = porMes.get(mesKey)!;
    if (!seniorityMap.has(seniority)) {
      seniorityMap.set(seniority, new Map());
    }
    
    const personasDelSeniority = seniorityMap.get(seniority)!;
    if (!personasDelSeniority.has(item.evaluadoEmail)) {
      personasDelSeniority.set(item.evaluadoEmail, { sumAuto: 0, sumJefe: 0, countAuto: 0, countJefe: 0 });
    }
    
    const personaData = personasDelSeniority.get(item.evaluadoEmail)!;
    if (item.tipoEvaluador === 'AUTO') {
      personaData.sumAuto += item.puntaje;
      personaData.countAuto += 1;
    } else {
      personaData.sumJefe += item.puntaje;
      personaData.countJefe += 1;
    }
  });

  // Calcular promedio por mes y seniority
  return Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, seniorityMap]) => {
      const result: any = { mes: formatMonthLabel(mes) };
      
      ['Trainee', 'Junior', 'Semi Senior', 'Senior'].forEach(seniority => {
        const personasDelSeniority = seniorityMap.get(seniority);
        
        if (!personasDelSeniority) {
          result[seniority] = null;
          return;
        }
        
        let sumPromedios = 0;
        let personasConDatos = 0;
        
        personasDelSeniority.forEach((data) => {
          let promedioPersona = 0;
          let tieneAuto = data.countAuto > 0;
          let tieneJefe = data.countJefe > 0;
          
          if (tieneAuto && tieneJefe) {
            const promedioAuto = data.sumAuto / data.countAuto;
            const promedioJefe = data.sumJefe / data.countJefe;
            promedioPersona = Math.min((promedioAuto + promedioJefe) / 2, promedioJefe);
          } else if (tieneAuto) {
            promedioPersona = data.sumAuto / data.countAuto;
          } else if (tieneJefe) {
            promedioPersona = data.sumJefe / data.countJefe;
          }
          
          if (promedioPersona > 0) {
            sumPromedios += promedioPersona;
            personasConDatos++;
          }
        });
        
        result[seniority] = personasConDatos > 0 ? sumPromedios / personasConDatos : null;
      });
      
      return result;
    });
}

/**
 * Compara el desempeño de una persona entre dos períodos (Q anterior vs Q actual)
 */
export function comparePersonaBetweenPeriods<T extends { fecha: string; skillNombre: string; puntaje: number; tipoEvaluador: string; skillTipo: string }>(
  evaluations: T[]
): {
  qAnterior: { skill: string; tipo: string; auto: number; jefe: number; promedio: number }[];
  qActual: { skill: string; tipo: string; auto: number; jefe: number; promedio: number }[];
} {
  const { start: startAnterior, end: endAnterior } = getPreviousQuarterRange();
  const now = new Date();
  const currentQuarter = getQuarter(now);
  const currentYear = now.getFullYear();
  
  const startActual = new Date(currentYear, (currentQuarter - 1) * 3, 1);
  const endActual = new Date(currentYear, currentQuarter * 3, 0, 23, 59, 59);
  
  const evalsAnterior = evaluations.filter(e => {
    const date = new Date(e.fecha);
    return date >= startAnterior && date <= endAnterior;
  });
  
  const evalsActual = evaluations.filter(e => {
    const date = new Date(e.fecha);
    return date >= startActual && date <= endActual;
  });
  
  const processPeriod = (evals: T[]) => {
    const skillMap = new Map<string, { tipo: string; auto: number[]; jefe: number[] }>();
    
    evals.forEach(e => {
      if (!skillMap.has(e.skillNombre)) {
        skillMap.set(e.skillNombre, { tipo: e.skillTipo, auto: [], jefe: [] });
      }
      const data = skillMap.get(e.skillNombre)!;
      if (e.tipoEvaluador === 'AUTO') {
        data.auto.push(e.puntaje);
      } else {
        data.jefe.push(e.puntaje);
      }
    });
    
    return Array.from(skillMap.entries()).map(([skill, data]) => {
      const auto = data.auto.length > 0 ? data.auto.reduce((a, b) => a + b, 0) / data.auto.length : 0;
      const jefe = data.jefe.length > 0 ? data.jefe.reduce((a, b) => a + b, 0) / data.jefe.length : 0;
      const promedio = auto > 0 && jefe > 0 ? Math.min((auto + jefe) / 2, jefe) : (auto || jefe);
      
      return { skill, tipo: data.tipo, auto, jefe, promedio };
    });
  };
  
  return {
    qAnterior: processPeriod(evalsAnterior),
    qActual: processPeriod(evalsActual),
  };
}

/**
 * Formatea una clave año-mes a label legible
 */
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// ============= FASE 1: MÉTRICAS ANALÍTICAS =============

/**
 * Agrupa evaluaciones por mes separando Hard Skills y Soft Skills para cada seniority
 * FASE 1.1: Gráfico de Área Apilada
 */
export function groupByMonthSkillTypeAndSeniority<T extends { fecha: string; puntaje: number; evaluadoEmail: string; tipoEvaluador: string; skillTipo: string }>(
  items: T[],
  usersBySeniority: Map<string, { seniority: string }>
): Array<{ 
  mes: string; 
  Trainee_Hard: number; 
  Trainee_Soft: number;
  Junior_Hard: number; 
  Junior_Soft: number;
  'Semi Senior_Hard': number; 
  'Semi Senior_Soft': number;
  Senior_Hard: number; 
  Senior_Soft: number;
}> {
  const porMes = new Map<string, Map<string, Map<string, Map<string, { sumAuto: number; sumJefe: number; countAuto: number; countJefe: number }>>>>();

  items.forEach(item => {
    const date = new Date(item.fecha);
    const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const userInfo = usersBySeniority.get(item.evaluadoEmail);
    if (!userInfo) return;
    
    const seniority = userInfo.seniority;
    const skillType = item.skillTipo;
    
    if (!porMes.has(mesKey)) {
      porMes.set(mesKey, new Map());
    }
    
    const seniorityMap = porMes.get(mesKey)!;
    if (!seniorityMap.has(seniority)) {
      seniorityMap.set(seniority, new Map());
    }
    
    const skillTypeMap = seniorityMap.get(seniority)!;
    if (!skillTypeMap.has(skillType)) {
      skillTypeMap.set(skillType, new Map());
    }
    
    const personasDelSkillType = skillTypeMap.get(skillType)!;
    if (!personasDelSkillType.has(item.evaluadoEmail)) {
      personasDelSkillType.set(item.evaluadoEmail, { sumAuto: 0, sumJefe: 0, countAuto: 0, countJefe: 0 });
    }
    
    const personaData = personasDelSkillType.get(item.evaluadoEmail)!;
    if (item.tipoEvaluador === 'AUTO') {
      personaData.sumAuto += item.puntaje;
      personaData.countAuto += 1;
    } else {
      personaData.sumJefe += item.puntaje;
      personaData.countJefe += 1;
    }
  });

  return Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, seniorityMap]) => {
      const result: any = { mes: formatMonthLabel(mes) };
      
      ['Trainee', 'Junior', 'Semi Senior', 'Senior'].forEach(seniority => {
        ['HARD', 'SOFT'].forEach(skillType => {
          const skillTypeMap = seniorityMap.get(seniority);
          const personasDelSkillType = skillTypeMap?.get(skillType);
          
          const key = skillType === 'HARD' ? `${seniority}_Hard` : `${seniority}_Soft`;
          
          if (!personasDelSkillType) {
            result[key] = 0;
            return;
          }
          
          let sumPromedios = 0;
          let personasConDatos = 0;
          
          personasDelSkillType.forEach((data) => {
            let promedioPersona = 0;
            let tieneAuto = data.countAuto > 0;
            let tieneJefe = data.countJefe > 0;
            
            if (tieneAuto && tieneJefe) {
              const promedioAuto = data.sumAuto / data.countAuto;
              const promedioJefe = data.sumJefe / data.countJefe;
              promedioPersona = Math.min((promedioAuto + promedioJefe) / 2, promedioJefe);
            } else if (tieneAuto) {
              promedioPersona = data.sumAuto / data.countAuto;
            } else if (tieneJefe) {
              promedioPersona = data.sumJefe / data.countJefe;
            }
            
            if (promedioPersona > 0) {
              sumPromedios += promedioPersona;
              personasConDatos++;
            }
          });
          
          result[key] = personasConDatos > 0 ? sumPromedios / personasConDatos : 0;
        });
      });
      
      return result;
    });
}

/**
 * Calcula las skills que más cambiaron entre dos períodos (últimos 3 meses vs 3 meses anteriores)
 * FASE 1.2: Top 5 Skills que Más Cambiaron
 */
export function calcularTopSkillChanges<T extends { fecha: string; skillNombre: string; puntaje: number; tipoEvaluador: string; skillTipo: string }>(
  evaluations: T[]
): {
  mejoras: Array<{ skill: string; tipo: string; cambio: number; actual: number; anterior: number }>;
  empeoramientos: Array<{ skill: string; tipo: string; cambio: number; actual: number; anterior: number }>;
} {
  const now = new Date();
  const hace3Meses = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const hace6Meses = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  
  const evalsActual = evaluations.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });
  
  const evalsAnterior = evaluations.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace6Meses && date < hace3Meses;
  });
  
  const calcularPromediosPorSkill = (evals: T[]) => {
    const skillMap = new Map<string, { tipo: string; auto: number[]; jefe: number[] }>();
    
    evals.forEach(e => {
      if (!skillMap.has(e.skillNombre)) {
        skillMap.set(e.skillNombre, { tipo: e.skillTipo, auto: [], jefe: [] });
      }
      const data = skillMap.get(e.skillNombre)!;
      if (e.tipoEvaluador === 'AUTO') {
        data.auto.push(e.puntaje);
      } else {
        data.jefe.push(e.puntaje);
      }
    });
    
    const result = new Map<string, { tipo: string; promedio: number }>();
    skillMap.forEach((data, skill) => {
      const auto = data.auto.length > 0 ? data.auto.reduce((a, b) => a + b, 0) / data.auto.length : 0;
      const jefe = data.jefe.length > 0 ? data.jefe.reduce((a, b) => a + b, 0) / data.jefe.length : 0;
      const promedio = auto > 0 && jefe > 0 ? Math.min((auto + jefe) / 2, jefe) : (auto || jefe);
      result.set(skill, { tipo: data.tipo, promedio });
    });
    
    return result;
  };
  
  const promediosActuales = calcularPromediosPorSkill(evalsActual);
  const promediosAnteriores = calcularPromediosPorSkill(evalsAnterior);
  
  const cambios: Array<{ skill: string; tipo: string; cambio: number; actual: number; anterior: number }> = [];
  
  promediosActuales.forEach((dataActual, skill) => {
    const dataAnterior = promediosAnteriores.get(skill);
    if (dataAnterior) {
      const cambio = dataActual.promedio - dataAnterior.promedio;
      if (Math.abs(cambio) > 0.05) {
        cambios.push({
          skill,
          tipo: dataActual.tipo,
          cambio,
          actual: dataActual.promedio,
          anterior: dataAnterior.promedio,
        });
      }
    }
  });
  
  cambios.sort((a, b) => Math.abs(b.cambio) - Math.abs(a.cambio));
  
  return {
    mejoras: cambios.filter(c => c.cambio > 0).slice(0, 5),
    empeoramientos: cambios.filter(c => c.cambio < 0).slice(0, 5),
  };
}

/**
 * Calcula tendencia de seniority vs mes anterior
 * FASE 1.3: Indicadores de Tendencia en Cards
 */
export function calcularTendenciaSeniority<T extends { fecha: string; evaluadoEmail: string; puntaje: number; tipoEvaluador: string }>(
  evaluations: T[],
  usersBySeniority: Map<string, { seniority: string }>,
  seniority: string
): { cambioAbsoluto: number; cambioPorcentual: number; direccion: 'up' | 'down' | 'stable' } {
  const now = new Date();
  
  const inicioUltimoMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const finUltimoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const inicioPenultimoMes = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finPenultimoMes = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  
  const calcularPromedio = (inicio: Date, fin: Date) => {
    const evalsDelMes = evaluations.filter(e => {
      const userInfo = usersBySeniority.get(e.evaluadoEmail);
      if (!userInfo || userInfo.seniority !== seniority) return false;
      
      const date = new Date(e.fecha);
      return date >= inicio && date <= fin;
    });
    
    if (evalsDelMes.length === 0) return null;
    
    const porPersona = new Map<string, { sumAuto: number; sumJefe: number; countAuto: number; countJefe: number }>();
    evalsDelMes.forEach(e => {
      if (!porPersona.has(e.evaluadoEmail)) {
        porPersona.set(e.evaluadoEmail, { sumAuto: 0, sumJefe: 0, countAuto: 0, countJefe: 0 });
      }
      const data = porPersona.get(e.evaluadoEmail)!;
      if (e.tipoEvaluador === 'AUTO') {
        data.sumAuto += e.puntaje;
        data.countAuto++;
      } else {
        data.sumJefe += e.puntaje;
        data.countJefe++;
      }
    });
    
    let sumPromediosPersonas = 0;
    let countPersonas = 0;
    porPersona.forEach(data => {
      const auto = data.countAuto > 0 ? data.sumAuto / data.countAuto : 0;
      const jefe = data.countJefe > 0 ? data.sumJefe / data.countJefe : 0;
      if (auto > 0 || jefe > 0) {
        sumPromediosPersonas += auto > 0 && jefe > 0 ? Math.min((auto + jefe) / 2, jefe) : (auto || jefe);
        countPersonas++;
      }
    });
    
    return countPersonas > 0 ? sumPromediosPersonas / countPersonas : null;
  };
  
  const promedioUltimoMes = calcularPromedio(inicioUltimoMes, finUltimoMes);
  const promedioPenultimoMes = calcularPromedio(inicioPenultimoMes, finPenultimoMes);
  
  if (promedioUltimoMes === null || promedioPenultimoMes === null) {
    return { cambioAbsoluto: 0, cambioPorcentual: 0, direccion: 'stable' };
  }
  
  const cambioAbsoluto = promedioUltimoMes - promedioPenultimoMes;
  const cambioPorcentual = (cambioAbsoluto / promedioPenultimoMes) * 100;
  
  let direccion: 'up' | 'down' | 'stable' = 'stable';
  if (cambioAbsoluto > 0.05) direccion = 'up';
  else if (cambioAbsoluto < -0.05) direccion = 'down';
  
  return { cambioAbsoluto, cambioPorcentual, direccion };
}

/**
 * GRÁFICO LOLLIPOP: Comparación skill por skill entre período actual y anterior
 * Devuelve datos para gráfico de barras con marcadores
 */
export function calcularEvolucionPorSkill<T extends { fecha: string; skillNombre: string; skillTipo: string; puntaje: number; tipoEvaluador: string; evaluadoEmail: string; origen?: string }>(
  evaluations: T[],
  targetSkills: Array<{ skill: string; valorEsperado: number }>,
  userEmail?: string,
  origen?: 'ANALISTA' | 'LIDER'
): Array<{ 
  skill: string; 
  tipo: string;
  anterior: number; 
  actual: number; 
  target: number;
  cambio: number;
}> {
  const now = new Date();
  const hace3Meses = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const hace6Meses = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  
  // Filtrar por usuario y/o origen
  let evals = evaluations;
  if (userEmail) {
    evals = evals.filter(e => e.evaluadoEmail === userEmail);
  }
  if (origen) {
    evals = evals.filter(e => e.origen === origen);
  }
  
  const evalsActual = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });
  
  const evalsAnterior = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace6Meses && date < hace3Meses;
  });
  
  const calcularPromediosPorSkill = (evalSet: T[]) => {
    const skillMap = new Map<string, { tipo: string; auto: number[]; jefe: number[] }>();
    
    evalSet.forEach(e => {
      if (!skillMap.has(e.skillNombre)) {
        skillMap.set(e.skillNombre, { tipo: e.skillTipo, auto: [], jefe: [] });
      }
      const data = skillMap.get(e.skillNombre)!;
      if (e.tipoEvaluador === 'AUTO') {
        data.auto.push(e.puntaje);
      } else {
        data.jefe.push(e.puntaje);
      }
    });
    
    const result = new Map<string, { tipo: string; promedio: number }>();
    skillMap.forEach((data, skill) => {
      const auto = data.auto.length > 0 ? data.auto.reduce((a, b) => a + b, 0) / data.auto.length : 0;
      const jefe = data.jefe.length > 0 ? data.jefe.reduce((a, b) => a + b, 0) / data.jefe.length : 0;
      const promedio = auto > 0 && jefe > 0 ? Math.min((auto + jefe) / 2, jefe) : (auto || jefe);
      if (promedio > 0) {
        result.set(skill, { tipo: data.tipo, promedio });
      }
    });
    
    return result;
  };
  
  const promediosActuales = calcularPromediosPorSkill(evalsActual);
  const promediosAnteriores = calcularPromediosPorSkill(evalsAnterior);
  
  const resultado: Array<{ skill: string; tipo: string; anterior: number; actual: number; target: number; cambio: number }> = [];
  
  // Unir todas las skills que aparecieron en algún período
  const allSkills = new Set([...promediosActuales.keys(), ...promediosAnteriores.keys()]);
  
  allSkills.forEach(skill => {
    const dataActual = promediosActuales.get(skill);
    const dataAnterior = promediosAnteriores.get(skill);
    const targetData = targetSkills.find(t => t.skill === skill);
    
    const actual = dataActual?.promedio || 0;
    const anterior = dataAnterior?.promedio || 0;
    const target = targetData?.valorEsperado || 3; // Default 3 si no hay target
    const tipo = dataActual?.tipo || dataAnterior?.tipo || 'HARD';
    
    if (actual > 0 || anterior > 0) {
      resultado.push({
        skill,
        tipo,
        anterior,
        actual,
        target,
        cambio: actual - anterior
      });
    }
  });
  
  // Ordenar: primero HARD, luego SOFT, y por cambio descendente
  resultado.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'HARD' ? -1 : 1;
    return Math.abs(b.cambio) - Math.abs(a.cambio);
  });
  
  return resultado;
}

/**
 * MATRIZ DE CIERRE DE BRECHA: Calcula % de coincidencia Auto vs Jefe y evolución promedio
 */
export function calcularMatrizCierreBrecha<T extends { fecha: string; puntaje: number; tipoEvaluador: string; evaluadoEmail: string }>(
  evaluations: T[],
  userEmail?: string
): Array<{
  mes: string;
  promedioGeneral: number;
  porcentajeCoincidencia: number;
  gapPromedio: number;
}> {
  // Filtrar por usuario si se especifica
  const evals = userEmail 
    ? evaluations.filter(e => e.evaluadoEmail === userEmail)
    : evaluations;
  
  const porMes = new Map<string, { autos: number[]; jefes: number[] }>();
  
  evals.forEach(e => {
    const date = new Date(e.fecha);
    const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!porMes.has(mesKey)) {
      porMes.set(mesKey, { autos: [], jefes: [] });
    }
    
    const data = porMes.get(mesKey)!;
    if (e.tipoEvaluador === 'AUTO') {
      data.autos.push(e.puntaje);
    } else {
      data.jefes.push(e.puntaje);
    }
  });
  
  return Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, data]) => {
      const promedioAuto = data.autos.length > 0 
        ? data.autos.reduce((a, b) => a + b, 0) / data.autos.length 
        : 0;
      const promedioJefe = data.jefes.length > 0 
        ? data.jefes.reduce((a, b) => a + b, 0) / data.jefes.length 
        : 0;
      
      const promedioGeneral = promedioAuto > 0 && promedioJefe > 0 
        ? Math.min((promedioAuto + promedioJefe) / 2, promedioJefe)
        : (promedioAuto || promedioJefe);
      
      const gap = Math.abs(promedioJefe - promedioAuto);
      const maxDiff = 5; // Escala 1-5
      const porcentajeCoincidencia = promedioAuto > 0 && promedioJefe > 0
        ? Math.max(0, 100 - (gap / maxDiff) * 100)
        : 0;
      
      return {
        mes: formatMonthLabel(mes),
        promedioGeneral,
        porcentajeCoincidencia,
        gapPromedio: gap
      };
    });
}

/**
 * RADAR COMPARATIVO: Prepara datos para radar antes/después
 */
export function prepararRadarComparativo<T extends { fecha: string; skillNombre: string; puntaje: number; tipoEvaluador: string }>(
  evaluations: T[],
  targetSkills: Array<{ skill: string; valorEsperado: number }>
): {
  actual: Array<{ skill: string; value: number }>;
  anterior: Array<{ skill: string; value: number }>;
  target: Array<{ skill: string; value: number }>;
} {
  const now = new Date();
  const hace3Meses = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const hace6Meses = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  
  const evalsActual = evaluations.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });
  
  const evalsAnterior = evaluations.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace6Meses && date < hace3Meses;
  });
  
  const calcularPromedios = (evalSet: T[]) => {
    const skillMap = new Map<string, { auto: number[]; jefe: number[] }>();
    
    evalSet.forEach(e => {
      if (!skillMap.has(e.skillNombre)) {
        skillMap.set(e.skillNombre, { auto: [], jefe: [] });
      }
      const data = skillMap.get(e.skillNombre)!;
      if (e.tipoEvaluador === 'AUTO') {
        data.auto.push(e.puntaje);
      } else {
        data.jefe.push(e.puntaje);
      }
    });
    
    const result: Array<{ skill: string; value: number }> = [];
    skillMap.forEach((data, skill) => {
      const auto = data.auto.length > 0 ? data.auto.reduce((a, b) => a + b, 0) / data.auto.length : 0;
      const jefe = data.jefe.length > 0 ? data.jefe.reduce((a, b) => a + b, 0) / data.jefe.length : 0;
      const promedio = auto > 0 && jefe > 0 ? Math.min((auto + jefe) / 2, jefe) : (auto || jefe);
      if (promedio > 0) {
        result.push({ skill, value: promedio });
      }
    });
    
    return result;
  };
  
  const actual = calcularPromedios(evalsActual);
  const anterior = calcularPromedios(evalsAnterior);
  
  // Target: tomar las skills que aparecen en actual o anterior
  const allSkills = new Set([...actual.map(a => a.skill), ...anterior.map(a => a.skill)]);
  const target = Array.from(allSkills).map(skill => {
    const targetData = targetSkills.find(t => t.skill === skill);
    return {
      skill,
      value: targetData?.valorEsperado || 3
    };
  });
  
  return { actual, anterior, target };
}
