// src/test/mockData.ts
// Datos de prueba compartidos entre todos los tests
import type { Evaluation, User, SkillMatrix } from '../types';

// ============= HELPER: crear evaluación con defaults =============
let evalCounter = 0;
export function crearEval(overrides: Partial<Evaluation> = {}): Evaluation {
  evalCounter++;
  return {
    id: `eval-${evalCounter}`,
    fecha: '2025-06-01',
    evaluadoEmail: 'juan@test.com',
    evaluadoNombre: 'Juan',
    evaluadoApellido: 'Pérez',
    evaluadorEmail: 'jefe@test.com',
    tipoEvaluador: 'AUTO',
    skillTipo: 'HARD',
    skillNombre: 'JavaScript',
    puntaje: 3,
    area: 'IT',
    origen: 'ANALISTA',
    ...overrides,
  } as Evaluation;
}

// ============= USUARIOS =============
export const mockUsers: User[] = [
  { email: 'admin@test.com', nombre: 'Admin RRHH', rol: 'RRHH', area: 'HR' },
  { email: 'director@test.com', nombre: 'Director General', rol: 'Director', area: 'Dirección' },
  { email: 'lider@test.com', nombre: 'Líder IT', rol: 'Lider', area: 'IT' },
  { email: 'lider2@test.com', nombre: 'Líder Ventas', rol: 'Lider', area: 'Ventas' },
  { email: 'juan@test.com', nombre: 'Juan Pérez', rol: 'Analista', area: 'IT' },
  { email: 'maria@test.com', nombre: 'María López', rol: 'Analista', area: 'Ventas' },
];

// ============= SKILLS MATRIX =============
export const mockSkillsMatrix: SkillMatrix[] = [
  { seniority: 'Junior', rol: 'Analista', area: 'IT', skillNombre: 'JavaScript', valorEsperado: 2, tipo: 'HARD' },
  { seniority: 'Junior', rol: 'Analista', area: 'IT', skillNombre: 'React', valorEsperado: 2, tipo: 'HARD' },
  { seniority: 'Junior', rol: 'Analista', area: 'IT', skillNombre: 'Comunicación', valorEsperado: 3, tipo: 'SOFT' },
  { seniority: 'Semi Senior', rol: 'Analista', area: 'IT', skillNombre: 'JavaScript', valorEsperado: 3, tipo: 'HARD' },
  { seniority: 'Semi Senior', rol: 'Analista', area: 'IT', skillNombre: 'React', valorEsperado: 3, tipo: 'HARD' },
  { seniority: 'Senior', rol: 'Analista', area: 'IT', skillNombre: 'JavaScript', valorEsperado: 4, tipo: 'HARD' },
];

// ============= EVALUACIONES =============

// Caso 1: Auto=4, Jefe=3 → promedio=3.5, min(3.5, 3)=3
export const evalAutoAltoJefeBajo: Evaluation[] = [
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 4 }),
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
];

// Caso 2: Auto=2, Jefe=4 → promedio=3, min(3, 4)=3
export const evalAutoBajoJefeAlto: Evaluation[] = [
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 2 }),
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 4 }),
];

// Caso 3: Auto=3, Jefe=3 → promedio=3, min(3, 3)=3
export const evalIguales: Evaluation[] = [
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 3 }),
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
];

// Caso 4: Solo auto
export const evalSoloAuto: Evaluation[] = [
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 4 }),
];

// Caso 5: Solo jefe
export const evalSoloJefe: Evaluation[] = [
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
];

// Evaluaciones multi-skill para radar
export const evalMultiSkill: Evaluation[] = [
  // JavaScript: Auto=4, Jefe=3 → min(3.5, 3) = 3
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 4 }),
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
  // React: Auto=2, Jefe=4 → min(3, 4) = 3
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'React', puntaje: 2 }),
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'React', puntaje: 4 }),
  // Comunicación: Auto=3, Jefe=3 → min(3, 3) = 3
  crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'Comunicación', puntaje: 3, skillTipo: 'SOFT' }),
  crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'Comunicación', puntaje: 3, skillTipo: 'SOFT' }),
];

// Evaluaciones de distintas áreas para filtros de permisos
export const evalMultiArea: Evaluation[] = [
  crearEval({ evaluadoEmail: 'juan@test.com', evaluadoNombre: 'Juan', area: 'IT', puntaje: 3 }),
  crearEval({ evaluadoEmail: 'juan@test.com', evaluadoNombre: 'Juan', area: 'IT', puntaje: 4, tipoEvaluador: 'JEFE' }),
  crearEval({ evaluadoEmail: 'maria@test.com', evaluadoNombre: 'María', area: 'Ventas', puntaje: 3 }),
  crearEval({ evaluadoEmail: 'maria@test.com', evaluadoNombre: 'María', area: 'Ventas', puntaje: 2, tipoEvaluador: 'JEFE' }),
];

// Evaluaciones con fechas en distintos trimestres para evolución
export const evalMultiTrimestre: Evaluation[] = [
  // Q1 2025
  crearEval({ fecha: '2025-01-15', tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 2 }),
  crearEval({ fecha: '2025-02-10', tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 2 }),
  // Q2 2025
  crearEval({ fecha: '2025-04-15', tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 3 }),
  crearEval({ fecha: '2025-05-10', tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
  // Q3 2025
  crearEval({ fecha: '2025-07-15', tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 4 }),
  crearEval({ fecha: '2025-08-10', tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
];

// Reset counter entre tests
export function resetEvalCounter() {
  evalCounter = 0;
}
