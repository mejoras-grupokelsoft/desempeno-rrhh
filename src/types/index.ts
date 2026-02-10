// src/types/index.ts
export type UserRole = 'RRHH' | 'Director' | 'Lider' | 'Analista';
export type EvaluatorType = 'AUTO' | 'JEFE';
export type SkillType = 'HARD' | 'SOFT';
export type Seniority = 'Trainee' | 'Junior' | 'Semi Senior' | 'Senior';

export interface User {
  email: string;
  nombre: string;
  rol: UserRole;
  area: string;
}

export interface Evaluation {
  id: string;
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  evaluadoApellido: string;
  evaluadorEmail: string; // ⭐ Email del evaluador (quien hizo la evaluación)
  tipoEvaluador: EvaluatorType;
  skillTipo: SkillType;
  skillNombre: string;
  puntaje: 1 | 2 | 3 | 4;
  area: string;
  origen: 'ANALISTA' | 'LIDER';
  comentarios?: string; // ⭐ NUEVA: Comentarios sobre hard skills (opcional)
}

export interface SkillMatrix {
  seniority: string;
  rol: string;
  area: string;
  skillNombre: string;
  valorEsperado: number;
  tipo: SkillType;
}

export interface ApiResponse {
  users: User[];
  evaluations: Evaluation[];
  skills_matrix: SkillMatrix[];
  error?: boolean;
  message?: string;
}

export interface RadarDataPoint {
  skill: string;
  esperado: number;
  auto: number;
  jefe: number;
  promedio: number;
}

export interface EvolucionDataPoint {
  trimestre: string;
  auto: number;
  jefe: number;
  promedio: number;
  esperado: number;
}

export interface ResultadoFinal {
  fecha: string;
  area: string;
  emailEvaluado: string;
  nombreEvaluado: string;
  emailEvaluador: string;
  seniorityInicial: Seniority;
  seniorityAlcanzado: Seniority;
  promedioGeneral: number;
  estado: 'Cumple' | 'No Cumple' | 'Superó';
}
