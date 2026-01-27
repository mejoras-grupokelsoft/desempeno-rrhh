// src/utils/filters.ts
import type { User, Evaluation, UserRole } from '../types';

/**
 * Filtra evaluaciones según el rol del usuario
 */
export function filterEvaluationsByRole(
  evaluations: Evaluation[],
  user: User
): Evaluation[] {
  const { rol, area, email } = user;

  // RRHH y Director ven todo
  if (rol === 'RRHH' || rol === 'Director') {
    return evaluations;
  }

  // Líder solo ve su área
  if (rol === 'Lider') {
    return evaluations.filter((e) => e.area === area);
  }

  // Analista solo ve sus propios datos
  if (rol === 'Analista') {
    return evaluations.filter((e) => e.evaluadoEmail === email);
  }

  return [];
}

/**
 * Obtiene lista única de áreas
 */
export function getUniqueAreas(evaluations: Evaluation[]): string[] {
  const areas = new Set(evaluations.map((e) => e.area));
  return Array.from(areas).sort();
}

/**
 * Obtiene lista única de evaluados (nombre completo + email)
 */
export function getUniqueEvaluados(evaluations: Evaluation[]): Array<{
  email: string;
  nombre: string;
}> {
  const map = new Map<string, string>();
  
  evaluations.forEach((e) => {
    if (!map.has(e.evaluadoEmail)) {
      map.set(e.evaluadoEmail, `${e.evaluadoNombre} ${e.evaluadoApellido || ''}`.trim());
    }
  });

  return Array.from(map.entries())
    .map(([email, nombre]) => ({ email, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Verifica si un usuario tiene permiso para ver todos los datos
 */
export function canSeeAll(rol: UserRole): boolean {
  return rol === 'RRHH' || rol === 'Director';
}

/**
 * Verifica si un usuario puede exportar datos
 */
export function canExport(rol: UserRole): boolean {
  return rol === 'RRHH' || rol === 'Director';
}

/**
 * Obtiene áreas únicas de habilidades HARD
 */
export function getUniqueHardSkillAreas(evaluations: Evaluation[]): string[] {
  const hardEvals = evaluations.filter(e => e.skillTipo === 'HARD');
  const areas = new Set(hardEvals.map((e) => e.area));
  return Array.from(areas).sort();
}
