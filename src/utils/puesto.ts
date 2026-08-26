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
