// src/utils/__tests__/emailService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generarCuerpoEmail, enviarEmailConPDF } from '../emailService';
import type { EmailRequest } from '../emailService';

// =====================================================================
// generarCuerpoEmail
// =====================================================================
describe('generarCuerpoEmail', () => {
  it('incluye el nombre del evaluado', () => {
    const html = generarCuerpoEmail('Juan Pérez', 'Q2 2025');
    expect(html).toContain('Juan Pérez');
  });

  it('contiene texto oficial de Capital Humano', () => {
    const html = generarCuerpoEmail('Test', 'Q1');
    expect(html).toContain('Gracias por completar tu autoevaluación de desempeño');
    expect(html).toContain('evaluación por parte de tu líder');
    expect(html).toContain('reunión de feedback');
    expect(html).toContain('herramienta de crecimiento');
  });

  it('incluye firma de Equipo de Capital Humano KELSOFT', () => {
    const html = generarCuerpoEmail('Test', 'Q1');
    expect(html).toContain('Equipo de Capital Humano KELSOFT');
  });

  it('incluye comentario de RRHH cuando se proporciona', () => {
    const html = generarCuerpoEmail('Test', 'Q1', 'Excelente rendimiento');
    expect(html).toContain('Excelente rendimiento');
    expect(html).toContain('Observaciones adicionales');
  });

  it('NO incluye sección de observaciones sin comentario', () => {
    const html = generarCuerpoEmail('Test', 'Q1');
    expect(html).not.toContain('Observaciones adicionales');
  });

  it('NO incluye sección de observaciones con string vacío', () => {
    const html = generarCuerpoEmail('Test', 'Q1', '');
    expect(html).not.toContain('Observaciones adicionales');
  });

  it('genera HTML válido con estructura de email', () => {
    const html = generarCuerpoEmail('Test', 'Q1');
    expect(html).toContain('<div');
    expect(html).toContain('Evaluación de Desempeño');
    expect(html).toContain('Grupo Kelsoft');
  });

  it('incluye disclaimer de email automático', () => {
    const html = generarCuerpoEmail('Test', 'Q1');
    expect(html).toContain('email fue enviado automáticamente');
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
