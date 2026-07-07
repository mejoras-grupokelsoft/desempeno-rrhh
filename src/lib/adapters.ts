// src/lib/adapters.ts
/**
 * Adaptadores para convertir entre formato Supabase (snake_case) 
 * y formato interno de la app (camelCase)
 */

import type { 
  SupabaseEvaluation, 
  SupabaseSkillMatrix, 
  Evaluation, 
  SkillMatrix,
  SupabaseQuestion,
  Question,
  SupabaseUserArea,
  UserArea,
} from '../types';

/**
 * Convierte evaluación de Supabase (snake_case) a formato interno (camelCase)
 */
export function adaptEvaluation(supabaseEval: SupabaseEvaluation): Evaluation {
  // Determinar origen basado en tipo_evaluador
  const origen = supabaseEval.tipo_evaluador === 'AUTO' ? 'ANALISTA' : 'LIDER';
  
  return {
    id: supabaseEval.id,
    fecha: supabaseEval.created_at || new Date().toISOString(),
    evaluadoEmail: supabaseEval.evaluado_email,
    evaluadoNombre: supabaseEval.evaluado_nombre,
    evaluadorEmail: supabaseEval.evaluador_email,
    tipoEvaluador: supabaseEval.tipo_evaluador,
    skillTipo: supabaseEval.skill_tipo,
    skillNombre: supabaseEval.skill_nombre,
    puntaje: supabaseEval.puntaje,
    area: supabaseEval.area,
    origen,
    comentarios: supabaseEval.comentario,
  };
}

/**
 * Convierte arreglo de evaluaciones de Supabase a formato interno
 */
export function adaptEvaluations(supabaseEvals: SupabaseEvaluation[]): Evaluation[] {
  return supabaseEvals.map(adaptEvaluation);
}

/**
 * Convierte skill matrix de Supabase (snake_case) a formato interno (camelCase)
 */
export function adaptSkillMatrix(supabaseSkill: SupabaseSkillMatrix): SkillMatrix {
  return {
    id: supabaseSkill.id,
    seniority: supabaseSkill.seniority,
    area: supabaseSkill.area,
    skillNombre: supabaseSkill.skill_nombre,
    valorEsperado: supabaseSkill.valor_esperado,
    tipo: supabaseSkill.skill_tipo,
  };
}

/**
 * Convierte arreglo de skills matrix de Supabase a formato interno
 */
export function adaptSkillsMatrix(supabaseSkills: SupabaseSkillMatrix[]): SkillMatrix[] {
  return supabaseSkills.map(adaptSkillMatrix);
}

/**
 * Invierte: Convierte evaluación interna (camelCase) a Supabase (snake_case)
 */
export function reverseAdaptEvaluation(internalEval: Omit<Evaluation, 'id' | 'fecha'> & { periodo: string }): Omit<SupabaseEvaluation, 'id' | 'created_at' | 'updated_at'> {
  return {
    periodo: internalEval.periodo,
    evaluado_email: internalEval.evaluadoEmail,
    evaluado_nombre: internalEval.evaluadoNombre,
    evaluador_email: internalEval.evaluadorEmail,
    tipo_evaluador: internalEval.tipoEvaluador,
    skill_nombre: internalEval.skillNombre,
    skill_tipo: internalEval.skillTipo,
    puntaje: internalEval.puntaje,
    area: internalEval.area,
    comentario: internalEval.comentarios,
  };
}

/**
 * Convierte pregunta de Supabase (snake_case) a formato interno (camelCase)
 */
export function adaptQuestion(supabaseQuestion: SupabaseQuestion): Question {
  return {
    id: supabaseQuestion.id,
    nombre: supabaseQuestion.pregunta, // 'pregunta' en la BD → 'nombre' en la app
    descripcion: supabaseQuestion.descripcion,
    tipo: supabaseQuestion.tipo,
    rolObjetivo: supabaseQuestion.rol_objetivo,
    areaId: supabaseQuestion.area_id, // area_id en la BD
    estado: supabaseQuestion.estado,
    orden: supabaseQuestion.orden,
    puntajeMinimo: supabaseQuestion.puntaje_minimo,
    puntajeMaximo: supabaseQuestion.puntaje_maximo,
    skillId: supabaseQuestion.skill_id,
    skillNombre: supabaseQuestion.skill_nombre, // Agregado
    skillTipo: supabaseQuestion.skill_tipo || null,
    createdAt: supabaseQuestion.created_at,
    updatedAt: supabaseQuestion.updated_at,
  };
}

/**
 * Convierte arreglo de preguntas de Supabase a formato interno
 */
export function adaptQuestions(supabaseQuestions: SupabaseQuestion[]): Question[] {
  return supabaseQuestions.map(adaptQuestion);
}

/**
 * Convierte UserArea de Supabase (snake_case) a formato interno (camelCase)
 */
export function adaptUserArea(supabaseUserArea: SupabaseUserArea): UserArea {
  return {
    id: supabaseUserArea.id,
    userEmail: supabaseUserArea.user_email,
    area: supabaseUserArea.area,
    rolEnArea: supabaseUserArea.rol_en_area,
    createdAt: supabaseUserArea.created_at,
    updatedAt: supabaseUserArea.updated_at,
  };
}

/**
 * Convierte arreglo de UserArea de Supabase a formato interno
 */
export function adaptUserAreas(supabaseUserAreas: SupabaseUserArea[]): UserArea[] {
  return supabaseUserAreas.map(adaptUserArea);
}

/**
 * Convierte UserArea de formato interno (camelCase) a Supabase (snake_case)
 */
export function reverseAdaptUserArea(userArea: UserArea): SupabaseUserArea {
  return {
    id: userArea.id,
    user_email: userArea.userEmail,
    area: userArea.area,
    rol_en_area: userArea.rolEnArea,
    created_at: userArea.createdAt,
    updated_at: userArea.updatedAt,
  };
}
