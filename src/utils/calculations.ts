// src/utils/calculations.ts
import type { Evaluation, SkillMatrix, RadarDataPoint, Seniority } from '../types';

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
    const promedio = auto > 0 && jefe > 0 ? (auto + jefe) / 2 : auto > 0 ? auto : jefe;
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
 */
export function calcularSeniorityAlcanzado(promedioGeneral: number): Seniority {
  if (promedioGeneral >= 4.0) return 'Senior';
  if (promedioGeneral >= 3.0) return 'Semi Senior';
  if (promedioGeneral >= 2.0) return 'Junior';
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
