// src/utils/calculations.ts
import type { Evaluation, SkillMatrix, RadarDataPoint, Seniority } from '../types';

// Configuración de ponderación: % de peso para cada tipo de evaluación
const PONDERACION_JEFE = 0.70;  // 70% peso del líder
const PONDERACION_AUTO = 0.30;  // 30% peso de autoevaluación

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
    // Promedio ponderado: 70% líder + 30% auto (si ambos existen)
    // IMPORTANTE: El resultado nunca puede ser mayor al puntaje del líder
    const promedioPonderado = (jefe * PONDERACION_JEFE) + (auto * PONDERACION_AUTO);
    const promedio = auto > 0 && jefe > 0 
      ? Math.min(promedioPonderado, jefe)
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
