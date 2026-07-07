// src/lib/supabaseQueries.ts
import { supabase } from './supabase';
import type { User, SupabaseEvaluation, SupabaseSkillMatrix, SupabaseQuestion, SupabaseUserArea } from '../types';

// ============= USUARIOS =============

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
  return data || [];
}

export async function fetchUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user:', error);
    throw error;
  }
  return data || null;
}

// ============= SKILLS MATRIX =============

export async function fetchSkillsMatrix(): Promise<SupabaseSkillMatrix[]> {
  const { data, error } = await supabase
    .from('skills_matrix')
    .select('*')
    .order('seniority', { ascending: true })
    .order('skill_nombre', { ascending: true });

  if (error) {
    console.error('Error fetching skills matrix:', error);
    throw error;
  }
  return data || [];
}

export async function fetchSkillsBySeniority(seniority: string): Promise<SupabaseSkillMatrix[]> {
  const { data, error } = await supabase
    .from('skills_matrix')
    .select('*')
    .eq('seniority', seniority)
    .order('skill_tipo', { ascending: true })
    .order('skill_nombre', { ascending: true });

  if (error) {
    console.error('Error fetching skills by seniority:', error);
    throw error;
  }
  return data || [];
}

// ============= EVALUACIONES =============

export async function fetchEvaluations(periodo: string): Promise<SupabaseEvaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('periodo', periodo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching evaluations:', error);
    throw error;
  }
  return data || [];
}

export async function fetchAllEvaluations(): Promise<SupabaseEvaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all evaluations:', error);
    throw error;
  }
  return data || [];
}

export async function fetchEvaluationsByUser(email: string, periodo: string): Promise<SupabaseEvaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('evaluado_email', email)
    .eq('periodo', periodo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching evaluations by user:', error);
    throw error;
  }
  return data || [];
}

export async function fetchEvaluationsByEvaluator(
  evaluadorEmail: string,
  periodo: string,
  tipo: 'AUTO' | 'JEFE'
): Promise<SupabaseEvaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('evaluador_email', evaluadorEmail)
    .eq('periodo', periodo)
    .eq('tipo_evaluador', tipo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching evaluations by evaluator:', error);
    throw error;
  }
  return data || [];
}

export async function insertEvaluation(evaluation: Omit<SupabaseEvaluation, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseEvaluation> {
  const { data, error } = await supabase
    .from('evaluations')
    .insert([evaluation])
    .select()
    .single();

  if (error) {
    console.error('Error inserting evaluation:', error);
    throw error;
  }
  return data;
}

export async function updateEvaluation(
  id: string,
  updates: Partial<SupabaseEvaluation>
): Promise<SupabaseEvaluation> {
  const { data, error } = await supabase
    .from('evaluations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating evaluation:', error);
    throw error;
  }
  return data;
}

export async function deleteEvaluation(id: string): Promise<void> {
  const { error } = await supabase
    .from('evaluations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting evaluation:', error);
    throw error;
  }
}

// ============= AUDITORÍA Y QUERIES AVANZADAS =============

export async function fetchEvaluationsByArea(area: string, periodo: string): Promise<SupabaseEvaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('area', area)
    .eq('periodo', periodo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching evaluations by area:', error);
    throw error;
  }
  return data || [];
}

export async function checkEvaluationExists(
  evaluadoEmail: string,
  evaluadorEmail: string,
  skillNombre: string,
  tipo: 'AUTO' | 'JEFE',
  periodo: string
): Promise<SupabaseEvaluation | null> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('evaluado_email', evaluadoEmail)
    .eq('evaluador_email', evaluadorEmail)
    .eq('skill_nombre', skillNombre)
    .eq('tipo_evaluador', tipo)
    .eq('periodo', periodo)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking evaluation existence:', error);
    throw error;
  }
  return data || null;
}

// ============= PREGUNTAS CONFIGURABLES =============

export async function fetchQuestions(includeArchived = false): Promise<SupabaseQuestion[]> {
  let query = supabase
    .from('questions')
    .select(`
      *,
      skills:skill_id (id, nombre, tipo)
    `)
    .order('pregunta', { ascending: true });

  if (!includeArchived) {
    query = query.eq('estado', 'activo');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching questions:', error);
    throw error;
  }

  // Mapear el skill vinculado sin pisar el tipo real de la pregunta
  return (data || []).map((q: any) => ({
    ...q,
    skill_nombre: q.skills?.nombre || null,
    skill_tipo: q.skills?.tipo || null,
  }));
}

export async function fetchQuestionsByArea(
  areaId: string | null,
  tipo: 'HARD' | 'SOFT',
  includeArchived = false,
  rolObjetivo?: string   // 'ANALISTA' | 'LIDER' — filtra preguntas por rol del evaluado
): Promise<SupabaseQuestion[]> {
  let query = supabase
    .from('questions')
    .select(`
      *,
      skills:skill_id (id, nombre, tipo)
    `)
    .order('pregunta', { ascending: true });

  if (!includeArchived) {
    query = query.eq('estado', 'activo');
  }

  // Filtrar por área en la DB
  if (areaId) {
    query = query.eq('area_id', areaId);
  } else {
    query = query.is('area_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching questions by area:', error);
    throw error;
  }

  return (data || [])
    .filter((q: any) => {
      if (tipo && q.skills?.tipo !== tipo) return false;
      // Filtrar por rol_objetivo: si se especifica un rol, solo traer preguntas de ese rol o globales (null)
      if (rolObjetivo && q.rol_objetivo != null && q.rol_objetivo !== rolObjetivo) return false;
      return true;
    })
    .map((q: any) => ({
      ...q,
      skill_nombre: q.skills?.nombre || null,
      tipo: q.skills?.tipo || null,
    }));
}

export async function createQuestion(question: Omit<SupabaseQuestion, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseQuestion> {
  const { data, error } = await supabase
    .from('questions')
    .insert([question])
    .select(`
      *,
      skills:skill_id (id, nombre, tipo)
    `)
    .single();

  if (error) {
    console.error('Error creating question:', error);
    throw error;
  }
  
  // Mapear skill_nombre desde el join
  return {
    ...data,
    skill_nombre: (data as any).skills?.nombre || null,
    skill_tipo: (data as any).skills?.tipo || null,
  } as SupabaseQuestion;
}

export async function updateQuestion(
  id: string,
  updates: Partial<Omit<SupabaseQuestion, 'id' | 'created_at' | 'updated_at'>>
): Promise<SupabaseQuestion> {
  // Solo actualizar campos que existen en el schema real
  const safeUpdates: any = {};
  if ('pregunta' in updates) safeUpdates.pregunta = updates.pregunta;
  if ('descripcion' in updates) safeUpdates.descripcion = updates.descripcion;
  if ('skill_id' in updates) safeUpdates.skill_id = updates.skill_id;
  if ('rol_objetivo' in updates) safeUpdates.rol_objetivo = updates.rol_objetivo;
  if ('area_id' in updates) safeUpdates.area_id = updates.area_id;
  if ('estado' in updates) safeUpdates.estado = updates.estado;

  const { data, error } = await supabase
    .from('questions')
    .update(safeUpdates)
    .eq('id', id)
    .select(`
      *,
      skills:skill_id (id, nombre, tipo)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error updating question:', error);
    throw new Error(`Error actualizando pregunta: ${error.message} (code: ${error.code})`);
  }
  if (!data) {
    // Puede ser RLS bloqueando el UPDATE o que el ID no exista
    throw new Error(
      `No se pudo actualizar la pregunta (ID: ${id}). ` +
      'Si el error persiste, ejecutá la migración 017_fix_questions_tipo_and_rls.sql en Supabase.'
    );
  }
  
  // Mapear skill_nombre desde el join
  return {
    ...data,
    skill_nombre: (data as any).skills?.nombre || null,
    skill_tipo: (data as any).skills?.tipo || null,
  } as SupabaseQuestion;
}

export async function archiveQuestion(id: string): Promise<SupabaseQuestion> {
  return updateQuestion(id, { estado: 'archivado' });
}

export async function hideQuestion(id: string): Promise<SupabaseQuestion> {
  return updateQuestion(id, { estado: 'oculto' });
}

// ============= USER AREAS =============

export async function fetchUserAreas(userEmail?: string): Promise<SupabaseUserArea[]> {
  let query = supabase.from('user_areas').select('*');

  if (userEmail) {
    query = query.eq('user_email', userEmail);
  }

  query = query.order('area', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching user areas:', error);
    throw error;
  }
  return data || [];
}

export async function fetchAreaUsers(area: string): Promise<SupabaseUserArea[]> {
  const { data, error } = await supabase
    .from('user_areas')
    .select('*')
    .eq('area', area)
    .order('user_email', { ascending: true });

  if (error) {
    console.error('Error fetching area users:', error);
    throw error;
  }
  return data || [];
}

export async function createUserArea(userArea: Omit<SupabaseUserArea, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseUserArea> {
  const { data, error } = await supabase
    .from('user_areas')
    .insert([userArea])
    .select()
    .single();

  if (error) {
    console.error('Error creating user area:', error);
    throw error;
  }
  return data;
}

export async function deleteUserArea(userEmail: string, area: string): Promise<void> {
  const { error } = await supabase
    .from('user_areas')
    .delete()
    .eq('user_email', userEmail)
    .eq('area', area);

  if (error) {
    console.error('Error deleting user area:', error);
    throw error;
  }
}

// ============= SKILLS (Maestro de Habilidades) =============

export async function fetchSkills(includeInactive = false) {
  let query = supabase.from('skills').select('*');
  
  if (!includeInactive) {
    query = query.eq('estado', 'activo');
  }
  
  const { data, error } = await query.order('orden', { ascending: true });
  
  if (error) {
    console.error('Error fetching skills:', error);
    throw error;
  }
  return data || [];
}

export async function createSkill(skill: any) {
  const { data, error } = await supabase
    .from('skills')
    .insert([skill])
    .select()
    .single();

  if (error) {
    console.error('Error creating skill:', error);
    throw error;
  }
  return data;
}

export async function updateSkill(id: string, updates: any) {
  const { data, error } = await supabase
    .from('skills')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating skill:', error);
    throw error;
  }
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  const { error } = await supabase
    .from('skills')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting skill:', error);
    throw error;
  }
}

// ============= RESPONSES (RESPUESTAS DE EVALUACIÓN) =============

export interface SupabaseResponse {
  id: string;
  evaluation_id: string;
  pregunta_id: string;
  puntaje: 1 | 2 | 3 | 4;
  created_at: string;
  updated_at: string;
}

export async function fetchResponses(evaluationId: string): Promise<SupabaseResponse[]> {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching responses:', error);
    throw error;
  }
  return data || [];
}

export async function insertResponse(response: Omit<SupabaseResponse, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseResponse> {
  const { data, error } = await supabase
    .from('responses')
    .insert([response])
    .select()
    .single();

  if (error) {
    console.error('Error inserting response:', error);
    throw error;
  }
  return data;
}

export async function insertBatchResponses(
  responses: Omit<SupabaseResponse, 'id' | 'created_at' | 'updated_at'>[]
): Promise<SupabaseResponse[]> {
  const { data, error } = await supabase
    .from('responses')
    .insert(responses)
    .select();

  if (error) {
    console.error('Error inserting batch responses:', error);
    throw error;
  }
  return data || [];
}

export async function deleteResponsesByEvaluation(evaluationId: string): Promise<void> {
  const { error } = await supabase
    .from('responses')
    .delete()
    .eq('evaluation_id', evaluationId);

  if (error) {
    console.error('Error deleting responses:', error);
    throw error;
  }
}

// ============= TEAMS =============

export interface TeamWithMembers {
  id: string;
  nombre: string;
  area_id: string;
  leader_email: string;
  activo: boolean;
  members: {
    user_email: string;
    receives_evaluation_from_leader: boolean;
    performs_self_evaluation: boolean;
  }[];
}

/** Equipos donde el usuario es líder (con sus miembros) */
export async function fetchTeamsByLeader(leaderEmail: string): Promise<TeamWithMembers[]> {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id, nombre, area_id, leader_email, activo,
      team_members (user_email, receives_evaluation_from_leader, performs_self_evaluation)
    `)
    .eq('leader_email', leaderEmail)
    .eq('activo', true);

  if (error) {
    console.error('Error fetching teams by leader:', error);
    throw error;
  }
  return (data || []).map((t: any) => ({ ...t, members: t.team_members || [] }));
}

/** Equipos donde el usuario es miembro (para saber si debe autoevaluarse) */
export async function fetchTeamsByMember(userEmail: string): Promise<{ team_id: string; performs_self_evaluation: boolean; receives_evaluation_from_leader: boolean; }[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, performs_self_evaluation, receives_evaluation_from_leader')
    .eq('user_email', userEmail);

  if (error) {
    console.error('Error fetching teams by member:', error);
    throw error;
  }
  return data || [];
}

/**
 * Sincroniza automáticamente un usuario con el equipo de su área.
 * - Si es Lider/Director: crea el equipo del área si no existe, y lo pone como líder.
 * - Siempre: lo agrega como miembro del equipo del área con self_eval y leader_eval = true.
 */
export async function syncUserToTeam(user: {
  email: string;
  rol: string;
  area_id: string | null;
  area?: string | null;
}): Promise<void> {
  if (!user.area_id) return;

  // 1. Buscar equipo existente para el área
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('id, leader_email')
    .eq('area_id', user.area_id)
    .eq('activo', true)
    .limit(1);

  let teamId: string | null = existingTeams?.[0]?.id || null;

  // 2. Si es Lider o Director → manejar liderazgo del equipo
  if (user.rol === 'Lider' || user.rol === 'Director') {
    if (!teamId) {
      // Crear equipo nuevo para el área
      const { data: newTeam, error: createError } = await supabase
        .from('teams')
        .insert({
          nombre: user.area || 'Equipo',
          area_id: user.area_id,
          leader_email: user.email,
          activo: true,
        })
        .select('id')
        .single();
      if (createError) throw createError;
      teamId = newTeam.id;
    } else {
      // Actualizar líder del equipo existente
      await supabase
        .from('teams')
        .update({ leader_email: user.email })
        .eq('id', teamId);
    }
  }

  // 3. Agregar usuario como miembro del equipo (upsert)
  if (teamId) {
    await supabase
      .from('team_members')
      .upsert(
        {
          team_id: teamId,
          user_email: user.email,
          performs_self_evaluation: true,
          receives_evaluation_from_leader: true,
        },
        { onConflict: 'team_id,user_email' }
      );
  }
}

// ============= HISTORIAL DE EVALUACIONES =============

export interface EvaluationWithResponses {
  id: string;
  periodo: string;
  tipo_evaluador: 'AUTO' | 'JEFE';
  evaluado_email: string;
  evaluado_nombre: string;
  evaluador_email: string;
  area: string;
  comentario?: string;
  puntaje?: number;          // Puntaje global de la evaluación (legacy)
  skill_nombre?: string;     // Nombre de skill del registro principal (legacy)
  skill_tipo?: 'HARD' | 'SOFT'; // Tipo de skill del registro principal (legacy)
  created_at: string;
  responses: {
    pregunta_id: string;
    pregunta_nombre: string;
    skill_tipo: 'HARD' | 'SOFT';
    puntaje: number;
  }[];
}

export async function fetchEvaluationHistory(userEmail: string): Promise<EvaluationWithResponses[]> {
  // Traer evaluaciones donde el usuario es evaluado O evaluador
  const { data: evals, error } = await supabase
    .from('evaluations')
    .select('id, periodo, tipo_evaluador, evaluado_email, evaluado_nombre, evaluador_email, area, comentario, puntaje, skill_nombre, skill_tipo, created_at')
    .or(`evaluado_email.eq.${userEmail},evaluador_email.eq.${userEmail}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!evals || evals.length === 0) return [];

  // Para cada evaluación, traer las respuestas con el nombre de la pregunta
  const result: EvaluationWithResponses[] = [];
  for (const ev of evals) {
    const { data: responses } = await supabase
      .from('responses')
      .select('pregunta_id, puntaje, questions:pregunta_id(pregunta, skills:skill_id(tipo))')
      .eq('evaluation_id', ev.id)
      .order('puntaje', { ascending: false });

    result.push({
      ...ev,
      responses: (responses || []).map((r: any) => ({
        pregunta_id: r.pregunta_id,
        pregunta_nombre: r.questions?.pregunta || r.pregunta_id,
        skill_tipo: r.questions?.skills?.tipo || 'SOFT',
        puntaje: r.puntaje,
      })),
    });
  }
  return result;
}

// ============= NOTAS DEL LÍDER =============

export interface LeaderNote {
  id: string;
  leader_email: string;
  member_email: string;
  titulo?: string;
  contenido: string;
  fecha_nota: string; // DATE ISO string YYYY-MM-DD
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchLeaderNotes(leaderEmail: string, memberEmail: string): Promise<LeaderNote[]> {
  const { data, error } = await supabase
    .from('leader_notes')
    .select('*')
    .eq('leader_email', leaderEmail)
    .eq('member_email', memberEmail)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertLeaderNote(note: Omit<LeaderNote, 'id' | 'created_at' | 'updated_at'>): Promise<LeaderNote> {
  const { data, error } = await supabase
    .from('leader_notes')
    .insert(note)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLeaderNote(id: string, updates: Partial<Pick<LeaderNote, 'titulo' | 'contenido' | 'is_shared' | 'fecha_nota'>>): Promise<LeaderNote> {
  const { data, error } = await supabase
    .from('leader_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLeaderNote(id: string): Promise<void> {
  const { error } = await supabase.from('leader_notes').delete().eq('id', id);
  if (error) throw error;
}

// ============= SKILL AVERAGES POR PERSONA (para radar real) =============

export interface SkillAvgRow {
  skill_nombre: string;
  skill_tipo: 'HARD' | 'SOFT';
  avg_auto: number | null;
  avg_jefe: number | null;
  avg_total: number;
}

/**
 * Devuelve promedios de puntaje por habilidad para una persona,
 * uniendo evaluations → responses → questions → skills.
 * Acepta opcionalmente un array de periodos para filtrar (ej: ['2024-S1', '2024-S2']).
 */
export async function fetchPersonaSkillAverages(
  email: string,
  periodos?: string[],
  areaName?: string,
  rolObjetivo?: string   // 'ANALISTA' | 'LIDER' — filtra preguntas por rol del evaluado
): Promise<SkillAvgRow[]> {
  // 1. Buscar evaluaciones de esa persona
  let evalQuery = supabase
    .from('evaluations')
    .select('id, tipo_evaluador, periodo')
    .eq('evaluado_email', email);

  if (periodos && periodos.length > 0) {
    evalQuery = evalQuery.in('periodo', periodos);
  }

  const { data: evals, error: evalErr } = await evalQuery;
  if (evalErr) throw evalErr;
  if (!evals || evals.length === 0) return [];

  const evalIds = evals.map((e: any) => e.id);
  const evalTipoMap: Record<string, 'AUTO' | 'JEFE'> = {};
  evals.forEach((e: any) => { evalTipoMap[e.id] = e.tipo_evaluador; });

  // 2. Buscar respuestas (solo id, evaluation_id, pregunta_id, puntaje — sin join)
  const { data: responses, error: respErr } = await supabase
    .from('responses')
    .select('id, evaluation_id, pregunta_id, puntaje')
    .in('evaluation_id', evalIds);

  if (respErr) throw respErr;
  if (!responses || responses.length === 0) return [];

  // 3. Buscar preguntas únicas para obtener skill_id.
  //    Si se provee areaName, resolver su area_id y filtrar solo preguntas de esa área (o globales).
  const preguntaIds = [...new Set(responses.map((r: any) => r.pregunta_id))];

  let areaId: string | null = null;
  if (areaName) {
    const { data: areaData } = await supabase
      .from('areas')
      .select('id')
      .ilike('nombre', areaName)
      .maybeSingle();
    areaId = areaData?.id ?? null;
  }

  let qQuery = supabase
    .from('questions')
    .select('id, skill_id, rol_objetivo')
    .in('id', preguntaIds);

  if (areaId) {
    qQuery = (qQuery as any).or(`area_id.eq.${areaId},area_id.is.null`);
  }

  const { data: questions, error: qErr } = await qQuery;
  if (qErr) throw qErr;

  // Filtrar preguntas por rol_objetivo: si se pasa un rol, excluir preguntas del rol contrario
  const filteredQuestions = (questions || []).filter((q: any) => {
    if (!rolObjetivo) return true;
    return q.rol_objetivo == null || q.rol_objetivo === rolObjetivo;
  });

  const preguntaToSkill: Record<string, string> = {};
  filteredQuestions.forEach((q: any) => { preguntaToSkill[q.id] = q.skill_id; });

  // 4. Buscar skills únicas — también filtramos por rol_objetivo de la skill
  //    Esto resuelve el caso donde questions.rol_objetivo es null pero skills.rol_objetivo sí está seteado
  const skillIds = [...new Set(Object.values(preguntaToSkill))].filter(Boolean);
  if (skillIds.length === 0) return [];

  const { data: skills, error: skErr } = await supabase
    .from('skills')
    .select('id, nombre, tipo, rol_objetivo')
    .in('id', skillIds);

  if (skErr) throw skErr;

  // Filtrar skills por rol_objetivo: si se especifica un rol, excluir skills del rol contrario
  const validSkillIds = new Set(
    (skills || [])
      .filter((s: any) => {
        if (!rolObjetivo) return true;
        return s.rol_objetivo == null || s.rol_objetivo === rolObjetivo;
      })
      .map((s: any) => s.id)
  );

  const skillById: Record<string, { nombre: string; tipo: string }> = {};
  (skills || []).filter((s: any) => validSkillIds.has(s.id))
    .forEach((s: any) => { skillById[s.id] = { nombre: s.nombre, tipo: s.tipo }; });

  // 5. Agrupar por skill → calcular avg_auto, avg_jefe
  const skillMap: Record<string, {
    skill_nombre: string;
    skill_tipo: 'HARD' | 'SOFT';
    scores_auto: number[];
    scores_jefe: number[];
  }> = {};

  for (const r of responses as any[]) {
    const skillId = preguntaToSkill[r.pregunta_id];
    if (!skillId) continue;
    const skill = skillById[skillId];
    if (!skill?.nombre) continue;

    const key = skill.nombre;
    if (!skillMap[key]) {
      skillMap[key] = {
        skill_nombre: skill.nombre,
        skill_tipo: skill.tipo as 'HARD' | 'SOFT',
        scores_auto: [],
        scores_jefe: [],
      };
    }
    const tipo = evalTipoMap[r.evaluation_id];
    if (tipo === 'AUTO') skillMap[key].scores_auto.push(r.puntaje);
    else if (tipo === 'JEFE') skillMap[key].scores_jefe.push(r.puntaje);
  }

  // 6. Calcular promedios
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return Object.values(skillMap).map(s => {
    const a = avg(s.scores_auto);
    const j = avg(s.scores_jefe);
    const total = a !== null && j !== null ? (a + j) / 2 : (a ?? j ?? 0);
    return {
      skill_nombre: s.skill_nombre,
      skill_tipo: s.skill_tipo,
      avg_auto: a,
      avg_jefe: j,
      avg_total: total,
    };
  }).sort((a, b) => a.skill_nombre.localeCompare(b.skill_nombre));
}
