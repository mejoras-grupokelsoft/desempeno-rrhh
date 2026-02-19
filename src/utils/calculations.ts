// src/utils/calculations.ts
import type { Evaluation, SkillMatrix, RadarDataPoint, Seniority, EvolucionDataPoint } from '../types';

// Regla de puntaje final:
// 1. Se calcula el promedio simple entre auto y jefe: (auto + jefe) / 2
// 2. Si el promedio > jefe → se toma jefe
// 3. Si el promedio ≤ jefe → se toma el promedio
// Resultado: Math.min((auto + jefe) / 2, jefe)

/**
 * Calcula el promedio de puntajes para un tipo de evaluador y skill específica
 */
export function calcularPromedio(
  evaluations: Evaluation[],
  tipoEvaluador: 'AUTO' | 'JEFE',
  skillNombre: string
): number {
  const filtered = evaluations.filter(
    (e) => e.tipoEvaluador === tipoEvaluador && e.skillNombre === skillNombre
  );

  if (filtered.length === 0) return 0;

  const sum = filtered.reduce((acc, e) => acc + e.puntaje, 0);
  return sum / filtered.length;
}

/**
 * Obtiene el valor esperado de skills_matrix para una skill específica
 */
export function obtenerValorEsperado(
  skillsMatrix: SkillMatrix[],
  skillNombre: string,
  seniority: string,
  rol: string,
  area: string
): number {
  const skill = skillsMatrix.find(
    (s) =>
      s.skillNombre === skillNombre &&
      s.seniority === seniority &&
      s.rol === rol &&
      s.area === area
  );

  return skill?.valorEsperado || 0;
}

/**
 * Transforma evaluaciones en datos para el Radar Chart
 */
export function transformarARadarData(
  evaluations: Evaluation[],
  skillsMatrix: SkillMatrix[],
  seniorityEsperado: string,
  rol: string,
  area: string
): RadarDataPoint[] {
  // Obtener lista única de skills
  const skillsSet = new Set(evaluations.map((e) => e.skillNombre));
  const skills = Array.from(skillsSet);

  return skills.map((skill) => {
    const auto = calcularPromedio(evaluations, 'AUTO', skill);
    const jefe = calcularPromedio(evaluations, 'JEFE', skill);
    // Puntaje final: promedio simple, nunca mayor al puntaje del líder
    const promedioSimple = (auto + jefe) / 2;
    const promedio = auto > 0 && jefe > 0 
      ? Math.min(promedioSimple, jefe)
      : auto > 0 ? auto : jefe;
    const esperado = obtenerValorEsperado(skillsMatrix, skill, seniorityEsperado, rol, area);

    return {
      skill,
      esperado,
      auto,
      jefe,
      promedio,
    };
  });
}

/**
 * Calcula el seniority alcanzado basado en el promedio general
 * Bandas: 0-1 Trainee, 1-2 Junior, 2-3 Semi Senior, 3-4 Senior
 */
export function calcularSeniorityAlcanzado(promedioGeneral: number): Seniority {
  if (promedioGeneral >= 3.0) return 'Senior';
  if (promedioGeneral >= 2.0) return 'Semi Senior';
  if (promedioGeneral >= 1.0) return 'Junior';
  return 'Trainee';
}

/**
 * Calcula el promedio general de todas las skills
 */
export function calcularPromedioGeneral(data: RadarDataPoint[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, d) => acc + d.promedio, 0);
  return sum / data.length;
}

/**
 * Determina el estado comparando seniority alcanzado vs esperado
 */
export function determinarEstado(
  seniorityAlcanzado: Seniority,
  seniorityEsperado: Seniority
): 'Cumple' | 'No Cumple' | 'Superó' {
  const niveles: Seniority[] = ['Trainee', 'Junior', 'Semi Senior', 'Senior'];
  const idxAlcanzado = niveles.indexOf(seniorityAlcanzado);
  const idxEsperado = niveles.indexOf(seniorityEsperado);

  if (idxAlcanzado > idxEsperado) return 'Superó';
  if (idxAlcanzado === idxEsperado) return 'Cumple';
  return 'No Cumple';
}

/**
 * Calcula la evolución semestral de una persona para el gráfico de líneas con bandas de seniority.
 * Agrupa evaluaciones por semestre y calcula auto, jefe, promedio ponderado, y esperado.
 */
export function calcularEvolucionSemestral(
  evaluations: Evaluation[],
  skillsMatrix: SkillMatrix[],
  seniorityEsperado: string,
  area: string
): EvolucionDataPoint[] {
  if (evaluations.length === 0) return [];

  // Agrupar evaluaciones por semestre
  const porSemestre = new Map<string, Evaluation[]>();

  evaluations.forEach(e => {
    const date = new Date(e.fecha);
    const year = date.getFullYear();
    const semester = Math.floor(date.getMonth() / 6) + 1;
    const key = `${year}-S${semester}`;

    if (!porSemestre.has(key)) {
      porSemestre.set(key, []);
    }
    porSemestre.get(key)!.push(e);
  });

  // Calcular esperado promedio (constante, basado en las skills evaluadas)
  const skillsEvaluadas = new Set(evaluations.map(e => e.skillNombre));
  let sumEsperado = 0;
  let countEsperado = 0;
  skillsEvaluadas.forEach(skillNombre => {
    // Buscar en skillsMatrix con diferentes roles (Líder y Analista)
    const match = skillsMatrix.find(
      s => s.skillNombre === skillNombre && s.seniority === seniorityEsperado && s.area === area
    );
    if (match) {
      sumEsperado += match.valorEsperado;
      countEsperado++;
    }
  });
  const esperadoPromedio = countEsperado > 0 ? sumEsperado / countEsperado : 0;

  // Procesar cada semestre
  const resultado: EvolucionDataPoint[] = [];

  porSemestre.forEach((evals, key) => {
    // Calcular promedios de AUTO y JEFE
    const autoPuntajes = evals.filter(e => e.tipoEvaluador === 'AUTO').map(e => e.puntaje);
    const jefePuntajes = evals.filter(e => e.tipoEvaluador === 'JEFE').map(e => e.puntaje);

    const autoPromedio = autoPuntajes.length > 0
      ? autoPuntajes.reduce((a, b) => a + b, 0) / autoPuntajes.length
      : 0;
    const jefePromedio = jefePuntajes.length > 0
      ? jefePuntajes.reduce((a, b) => a + b, 0) / jefePuntajes.length
      : 0;

    // Puntaje final: promedio simple, nunca mayor al puntaje del líder
    const promedioSimple = (autoPromedio + jefePromedio) / 2;
    const promedio = autoPromedio > 0 && jefePromedio > 0
      ? Math.min(promedioSimple, jefePromedio)
      : autoPromedio > 0 ? autoPromedio : jefePromedio;

    // Formatear label del semestre
    const [year, s] = key.split('-');
    const semestre = `${s} ${year}`;

    resultado.push({
      semestre,
      auto: autoPromedio,
      jefe: jefePromedio,
      promedio,
      esperado: esperadoPromedio,
    });
  });

  // Ordenar cronológicamente
  resultado.sort((a, b) => {
    const parseKey = (t: string) => {
      const [s, year] = t.split(' ');
      return parseInt(year) * 10 + parseInt(s.replace('S', ''));
    };
    return parseKey(a.semestre) - parseKey(b.semestre);
  });

  return resultado;
}
