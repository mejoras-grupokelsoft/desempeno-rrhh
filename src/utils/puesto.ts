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
