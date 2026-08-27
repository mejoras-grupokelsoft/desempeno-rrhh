// src/utils/__tests__/sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeTemplateHtml, sanitizeTemplateAsunto } from '../sanitize';

describe('sanitizeTemplateHtml', () => {
  it('elimina tags <script> junto con su contenido', () => {
    const html = '<p>Hola</p><script>alert(document.cookie)</script>';
    const result = sanitizeTemplateHtml(html);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(document.cookie)');
    expect(result).toContain('<p>Hola</p>');
  });

  it('elimina tags <iframe>, <object> y <embed>', () => {
    const html = '<iframe src="https://evil.com"></iframe><object data="x"></object><embed src="y">';
    const result = sanitizeTemplateHtml(html);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('elimina event handlers (onclick, onerror, etc.)', () => {
    const html = '<img src="x" onerror="alert(1)"><div onclick=\'stealData()\'>click</div>';
    const result = sanitizeTemplateHtml(html);
    expect(result).not.toMatch(/onerror/i);
    expect(result).not.toMatch(/onclick/i);
  });

  it('neutraliza URIs javascript:', () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeTemplateHtml(html);
    expect(result).not.toContain('javascript:');
  });

  it('conserva el formato normal (tags, estilos inline)', () => {
    const html = '<p style="color: red;">Hola <strong>{{nombre}}</strong></p>';
    const result = sanitizeTemplateHtml(html);
    expect(result).toBe(html);
  });
});

describe('sanitizeTemplateAsunto', () => {
  it('elimina cualquier tag HTML del asunto', () => {
    expect(sanitizeTemplateAsunto('<b>Asunto</b> normal')).toBe('Asunto normal');
  });

  it('deja el texto plano intacto', () => {
    expect(sanitizeTemplateAsunto('Recordatorio: Completá tu Evaluación')).toBe('Recordatorio: Completá tu Evaluación');
  });
});
