// src/utils/__tests__/emailService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generarCuerpoEmail, generarCuerpoRecordatorio, enviarEmailConPDF } from '../emailService';
import type { EmailRequest, ResultadoEvaluacion } from '../emailService';

const resultado: ResultadoEvaluacion = {
  promedioAuto: 3.2,
  promedioJefe: 3.6,
  promedioFinal: 3.4,
  seniorityAlcanzado: 'Semi Senior',
};

// =====================================================================
// generarCuerpoEmail
// =====================================================================
describe('generarCuerpoEmail', () => {
  it('incluye el nombre del evaluado', () => {
    const html = generarCuerpoEmail('Juan Pérez');
    expect(html).toContain('Juan Pérez');
  });

  it('contiene texto oficial de Capital Humano', () => {
    const html = generarCuerpoEmail('Test');
    expect(html).toContain('El proceso de evaluación de desempeño ha concluido');
    expect(html).toContain('reunión de feedback');
    expect(html).toContain('herramienta de crecimiento');
  });

  it('incluye firma de Capital Humano', () => {
    const html = generarCuerpoEmail('Test');
    expect(html).toContain('Capital Humano — capital.humano@grupokelsoft.com');
  });

  it('incluye el resumen de puntajes cuando se proporciona un resultado', () => {
    const html = generarCuerpoEmail('Test', undefined, resultado);
    expect(html).toContain('Resumen de tu Evaluación Final');
    expect(html).toContain('Semi Senior');
  });

  it('NO incluye el resumen de puntajes sin resultado', () => {
    const html = generarCuerpoEmail('Test');
    expect(html).not.toContain('Resumen de tu Evaluación Final');
  });

  it('incluye comentario de RRHH cuando se proporciona', () => {
    const html = generarCuerpoEmail('Test', 'Excelente rendimiento');
    expect(html).toContain('Excelente rendimiento');
    expect(html).toContain('Observaciones de Capital Humano');
  });

  it('NO incluye sección de observaciones sin comentario', () => {
    const html = generarCuerpoEmail('Test');
    expect(html).not.toContain('Observaciones de Capital Humano');
  });

  it('NO incluye sección de observaciones con string vacío', () => {
    const html = generarCuerpoEmail('Test', '');
    expect(html).not.toContain('Observaciones de Capital Humano');
  });

  it('genera HTML válido con estructura de email', () => {
    const html = generarCuerpoEmail('Test');
    expect(html).toContain('<div');
    expect(html).toContain('Evaluación de Desempeño');
    expect(html).toContain('Grupo KELSOFT');
  });

  it('incluye disclaimer de email automático', () => {
    const html = generarCuerpoEmail('Test');
    expect(html).toContain('email fue enviado automáticamente');
  });

  it('permite sobreescribir la plantilla (asunto/cuerpo editables)', () => {
    const html = generarCuerpoEmail('Test', undefined, undefined, {
      asunto: 'Asunto custom',
      cuerpoHtml: '<p>Hola {{nombre}}, texto custom.</p>',
    });
    expect(html).toContain('Hola Test, texto custom.');
  });
});

// =====================================================================
// generarCuerpoRecordatorio
// =====================================================================
describe('generarCuerpoRecordatorio', () => {
  it('incluye el nombre y el texto de recordatorio', () => {
    const html = generarCuerpoRecordatorio('Juan Pérez');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('todavía no completaste tu evaluación');
  });
});

// =====================================================================
// enviarEmailConPDF — con mocks de fetch (llama a la Netlify Function /api/send-email)
// =====================================================================
describe('enviarEmailConPDF', () => {
  const mockRequest: EmailRequest = {
    destinatarios: ['test@example.com'],
    asunto: 'Test Subject',
    cuerpoHTML: '<p>Test</p>',
    pdfBase64: 'base64data',
    nombreArchivo: 'test.pdf',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('envía POST a /api/send-email con los datos correctos', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'Enviado', enviados: ['test@example.com'], fallidos: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await enviarEmailConPDF(mockRequest);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/send-email');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.destinatarios).toEqual(['test@example.com']);
    expect(body.asunto).toBe('Test Subject');
    expect(body.pdfBase64).toBe('base64data');
    expect(body.nombreArchivo).toBe('test.pdf');

    expect(result.success).toBe(true);
  });

  it('no incluye pdfBase64/nombreArchivo cuando no se proporcionan (email sin adjunto)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ message: 'Enviado', enviados: ['test@example.com'], fallidos: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await enviarEmailConPDF({
      destinatarios: ['test@example.com'],
      asunto: 'Recordatorio',
      cuerpoHTML: '<p>Test</p>',
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.pdfBase64).toBeUndefined();
    expect(body.nombreArchivo).toBeUndefined();
  });

  it('maneja respuesta de error del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: true, message: 'Faltan credenciales de Gmail' }),
    }));

    const result = await enviarEmailConPDF(mockRequest);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Faltan credenciales de Gmail');
  });

  it('maneja error de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await enviarEmailConPDF(mockRequest);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error');
  });

  it('maneja error no-Error genérico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

    const result = await enviarEmailConPDF(mockRequest);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Error de conexión');
  });
});
