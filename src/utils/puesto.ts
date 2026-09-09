// src/utils/puesto.ts
import type { User } from '../types';

/**
 * Resuelve el rol_objetivo a usar para filtrar preguntas/skills de una persona.
 * Prioriza el puesto real (ej: "Líder Técnico") sobre el rol de acceso genérico,
 * porque el puesto es lo que determina qué se le pregunta — no quién la evalúa.
 */
export function resolveRolObjetivo(user: Pick<User, 'rol' | 'puesto'>): string {
  if (user.puesto && user.puesto.trim()) return user.puesto.trim();
  return user.rol === 'Lider' ? 'LIDER' : 'ANALISTA';
}

/**
 * Valores de "puesto objetivo" contra los que puede matchear una pregunta/skill
 * para este usuario: su puesto específico (si lo tiene) y su rol de acceso genérico
 * (LIDER/ANALISTA). Así una pregunta con puesto objetivo "ANALISTA" aplica a
 * cualquier analista sin importar su puesto puntual (CH, Proyectos, Admin, Mejoras...),
 * sin tener que duplicar la pregunta por cada puesto.
 */
export function resolveRolObjetivos(user: Pick<User, 'rol' | 'puesto'>): string[] {
  const generico = user.rol === 'Lider' ? 'LIDER' : 'ANALISTA';
  const puesto = user.puesto?.trim();
  return puesto && puesto.toLowerCase() !== generico.toLowerCase() ? [puesto, generico] : [generico];
}

/** Compara el puesto objetivo de una pregunta/skill contra los valores aceptables, sin distinguir mayúsculas ni espacios. */
export function matchesRolObjetivo(questionRol: string | null | undefined, acceptable: string[]): boolean {
  if (!questionRol || !questionRol.trim()) return true;
  const normalized = questionRol.trim().toLowerCase();
  return acceptable.some(v => v.trim().toLowerCase() === normalized);
}

// skills_matrix.area no siempre coincide con users.area: a veces es solo una diferencia de
// tilde/nombre (Administración → "Administracion"), y a veces el área está subdividida por
// especialidad/puesto (Capital Humano tiene 3 sub-matrices, Proyectos tiene una para "PM").
// Confirmado con RRHH (2026-09-08): Killa → Comunicación y Cultura, Bianca → Plan de Carrera
// y Reclutamiento, Pamela (líder RRHH)/Nahuel (Generalista)/resto de Capital Humano → Recursos
// Humanos (genérico, incluye a Laura "Marca Personal" hasta que se defina un bucket propio),
// Sofía "PM Matcheador"/Ezequiel "PM Catálogo" → Mercado Libre, resto de Proyectos sin cambio.
const AREA_ALIASES: Record<string, string> = {
  'Administración': 'Administracion',
  'Operaciones': 'Operaciones Internas',
};

/**
 * Resuelve el valor de `area` a usar para buscar en skills_matrix, dado el área y puesto reales
 * de una persona (users.area / users.puesto).
 */
export function resolveSkillsMatrixArea(area: string | null | undefined, puesto?: string | null): string {
  const a = (area || '').trim();
  const p = (puesto || '').trim();

  if (a === 'Capital Humano') {
    if (p === 'Plan de Carrera y Reclutamiento') return 'Plan de Carrera y Reclutamiento';
    if (p.toLowerCase().startsWith('comunicación') || p.toLowerCase().startsWith('comunicacion')) return 'Comunicación y Cultura';
    return 'Recursos Humanos'; // Generalista, líder, sin puesto, o especialidad sin bucket propio todavía
  }

  if (a === 'Proyectos' && p.toUpperCase().startsWith('PM')) {
    return 'Mercado Libre';
  }

  return AREA_ALIASES[a] || a;
}
