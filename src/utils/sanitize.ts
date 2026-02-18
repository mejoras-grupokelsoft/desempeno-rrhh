// src/utils/sanitize.ts

/**
 * Sanitiza texto plano: elimina tags HTML/script y caracteres peligrosos
 * Usar en comentarios, nombres, etc.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')          // Eliminar tags HTML
    .replace(/&[a-z]+;/gi, '')        // Eliminar entities HTML
    .replace(/javascript:/gi, '')     // Eliminar javascript: URIs
    .replace(/on\w+\s*=/gi, '')       // Eliminar event handlers (onclick=, etc.)
    .trim();
}

/**
 * Sanitiza una lista de emails: valida formato y elimina inyecciones
 * Retorna solo los emails con formato válido
 */
export function sanitizeEmailList(input: string): string[] {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return input
    .split(/[,;\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0 && emailRegex.test(e))
    .filter(e => !e.includes('<') && !e.includes('>'));  // Extra: no permitir < > en emails
}

/**
 * Sanitiza un email individual
 */
export function sanitizeEmail(input: string): string {
  return input.toLowerCase().trim().replace(/[<>"']/g, '');
}

/**
 * Logger seguro: solo imprime en desarrollo, nunca en producción
 */
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};
