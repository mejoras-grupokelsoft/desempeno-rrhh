// src/types/index.ts
export type UserRole = 'RRHH' | 'Director' | 'Lider' | 'Analista';
export type EvaluatorType = 'AUTO' | 'JEFE';
export type SkillType = 'HARD' | 'SOFT';
export type QuestionType = 'HARD' | 'SOFT' | 'COMENTARIO'; // Nuevo: incluye COMENTARIO
export type Seniority = 'Trainee' | 'Junior' | 'Semi Senior' | 'Senior';

export interface Area {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  parent_area_id?: string | null; // FK para sub-áreas (NULL = área raíz)
  lider_email?: string | null; // Líder/responsable de esta área
  created_at?: string;
  updated_at?: string;
  children?: Area[]; // Sub-áreas (solo en frontend)
}

export interface Team {
  id: string;
  nombre: string;
  descripcion?: string;
  area_id: string;
  leader_email: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_email: string;
  receives_evaluation_from_leader: boolean;
  performs_self_evaluation: boolean;
  can_evaluate_peers: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id?: string;
  email: string;
  nombre: string;
  rol: UserRole;
  area?: string;
  area_id?: string;
  foto?: string;
  created_at?: string;
  updated_at?: string;
  password_reset_token?: string;
  password_reset_expires?: string;
  last_password_change?: string;
}

// Interfaz para Supabase (snake_case) - Lo que viene de la BD
export interface SupabaseEvaluation {
  id: string;
  periodo: string;
  evaluado_email: string;
  evaluado_nombre: string;
  evaluador_email: string;
  tipo_evaluador: EvaluatorType;
  skill_nombre: string;
  skill_tipo: SkillType;
  puntaje: 1 | 2 | 3 | 4;
  area: string;
  comentario?: string;
  created_at?: string;
  updated_at?: string;
}

// Interfaz interna (camelCase) - Lo que usa la app internamente
export interface Evaluation {
  id: string;
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  evaluadorEmail: string;
  tipoEvaluador: EvaluatorType;
  skillNombre: string;
  skillTipo: SkillType;
  puntaje: 1 | 2 | 3 | 4;
  area: string;
  origen: 'ANALISTA' | 'LIDER';
  comentarios?: string;
}

// =========== SKILLS (Maestro de Habilidades) ===========
export interface Skill {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo: SkillType;
  rol_objetivo?: string | null; // 'LIDER' | 'ANALISTA' | null (para ambos/globales)
  area_id?: string | null; // FK a areas.id
  area?: string | null; // Para compatibilidad
  estado: 'activo' | 'oculto' | 'archivado';
  orden?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseSkillMatrix {
  id?: string;
  seniority: string;
  skill_nombre: string;
  skill_tipo: SkillType;
  valor_esperado: number;
  area?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SkillMatrix {
  id?: string;
  seniority: string;
  skillNombre: string;
  tipo: SkillType;
  valorEsperado: number;
  area?: string;
}

export interface EvaluationResult {
  id?: string;
  periodo: string;
  evaluado_email: string;
  evaluado_nombre: string;
  area: string;
  skill_nombre: string;
  skill_tipo: SkillType;
  puntaje_auto?: number;
  puntaje_jefe?: number;
  puntaje_promedio?: number;
  puntaje_esperado?: number;
  seniority_inicial?: string;
  seniority_alcanzado?: string;
  estado?: 'Cumple' | 'No Cumple' | 'Superó';
  created_at?: string;
  updated_at?: string;
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
  semestre: string;
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
}

// ============================================
// NUEVOS TIPOS PARA PREGUNTAS CONFIGURABLES
// ============================================

export type QuestionStatus = 'activo' | 'archivado' | 'oculto';

// Interfaz para Supabase (snake_case)
export interface SupabaseQuestion {
  id: string;
  pregunta: string; // Pregunta principal
  descripcion?: string;
  tipo?: QuestionType; // 'HARD', 'SOFT' - opcional según migración
  rol_objetivo?: string | null; // 'ANALISTA', 'LIDER'
  area_id?: string | null; // FK a areas.id
  skill_id?: string | null; // FK a skills.id
  skill_nombre?: string | null; // Nombre de la skill (para búsqueda/mapping)
  skill_tipo?: SkillType | null; // Tipo de la skill vinculada
  estado: QuestionStatus;
  orden?: number;
  puntaje_minimo?: number; // default 1, solo para tipo HARD/SOFT
  puntaje_maximo?: number; // default 4, solo para tipo HARD/SOFT
  created_at?: string;
  updated_at?: string;
}

// Interfaz interna (camelCase)
export interface Question {
  id: string;
  nombre: string; // pregunta en la BD
  descripcion?: string;
  tipo?: QuestionType;
  rolObjetivo?: string | null; // 'ANALISTA', 'LIDER'
  areaId?: string | null; // area_id en la BD
  skillNombre?: string | null; // skill_nombre en la BD
  skillId?: string | null; // skill_id en la BD
  skillTipo?: SkillType | null; // tipo de la skill vinculada
  estado: QuestionStatus;
  orden?: number;
  puntajeMinimo?: number; // default 1, solo para tipo HARD/SOFT
  puntajeMaximo?: number; // default 4, solo para tipo HARD/SOFT
  createdAt?: string;
  updatedAt?: string;
}

// Relación usuario-área
export interface SupabaseUserArea {
  id: string;
  user_email: string;
  area: string;
  rol_en_area?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserArea {
  id: string;
  userEmail: string;
  area: string;
  rolEnArea?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// TIPOS PARA RESPUESTAS Y VALIDACIONES
// ============================================

// Respuesta a una pregunta específica
export interface SupabaseResponse {
  id: string;
  evaluation_id: string;
  pregunta_id: string;
  puntaje?: 1 | 2 | 3 | 4 | null;
  comentario?: string | null; // Comentario de texto libre (para preguntas tipo COMENTARIO)
  es_comentario?: boolean; // Indica si es una respuesta de comentario
  created_at?: string;
  updated_at?: string;
}

export interface Response {
  id: string;
  evaluationId: string;
  preguntaId: string;
  puntaje?: 1 | 2 | 3 | 4 | null;
  comentario?: string | null; // Comentario de texto libre
  esComentario?: boolean; // Indica si es una respuesta de comentario
  createdAt?: string;
  updatedAt?: string;
}

// Respuesta agrupada por pregunta para formularios
export interface QuestionResponse {
  preguntaId: string;
  preguntaNombre: string;
  preguntaTipo: QuestionType;
  puntaje?: 1 | 2 | 3 | 4;
  comentario?: string; // Para preguntas tipo COMENTARIO
}

// Validación de respuestas (para antes de guardar)
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Estado de evaluación en formulario
export interface EvaluationFormState {
  evaluadoEmail: string;
  evaluadoNombre: string;
  tipoEvaluador: EvaluatorType;
  respuestas: Record<string, 1 | 2 | 3 | 4>; // { preguntaId: puntaje }
  comentarios?: string;
  isSubmitting: boolean;
  error?: string;
}

