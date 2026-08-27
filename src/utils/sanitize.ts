// src/utils/sanitize.ts

/**
 * Normaliza texto: convierte a minúsculas y elimina acentos/diacríticos
 * Útil para búsquedas insensibles a acentos (ej: "café" = "cafe")
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
 * Sanitiza el cuerpo HTML de una plantilla de email editable (guardada en Supabase,
 * escribible por cualquiera con la anon key). A diferencia de sanitizeText, conserva
 * el marcado de formato (tags, estilos inline) pero elimina lo que puede ejecutar
 * código o navegar a un destino no controlado: <script>, <iframe>, <object>/<embed>,
 * event handlers (onclick=, onerror=, etc.) y URIs javascript:.
 */
export function sanitizeTemplateHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

/** Sanitiza el asunto de una plantilla de email: texto plano, sin HTML. */
export function sanitizeTemplateAsunto(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
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
