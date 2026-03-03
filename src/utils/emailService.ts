// src/utils/emailService.ts
import type jsPDF from 'jspdf';

export interface EmailRequest {
  destinatarios: string[]; // emails de destino
  asunto: string;
  cuerpoHTML: string;
  pdfBase64: string; // PDF codificado en base64
  nombreArchivo: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  enviados?: string[];
  fallidos?: string[];
}

/**
 * Convierte un jsPDF a base64 string (sin el prefijo data:)
 */
export function pdfToBase64(doc: jsPDF): string {
  // output('datauristring') devuelve algo como "data:application/pdf;filename=generated.pdf;base64,XXXXX"
  // Necesitamos solo la parte base64
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  return base64;
}

export interface ResultadoEvaluacion {
  promedioAuto: number;
  promedioJefe: number;
  promedioFinal: number;
  seniorityAlcanzado: string;
  area?: string;
  rol?: string;
}

/**
 * Genera el cuerpo HTML del email con los resultados finales de la evaluación
 */
export function generarCuerpoEmail(
  evaluadoNombre: string,
  _periodo: string,
  comentarioRRHH?: string,
  resultado?: ResultadoEvaluacion
): string {
  const seniorityColor = (s: string) => {
    if (s === 'Senior') return '#d97706';
    if (s === 'Semi Senior') return '#475569';
    if (s === 'Junior') return '#0369a1';
    return '#6b7280';
  };

  const resultadoHTML = resultado
    ? `
        <!-- Resumen de resultados -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin: 0 0 24px;">
          <p style="color: #1e293b; font-size: 14px; font-weight: 700; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.05em;">
            Resumen de tu Evaluación Final
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 12px; background: white; border-radius: 8px; margin-bottom: 6px; width: 33%;">
                <p style="color: #64748b; font-size: 11px; font-weight: 600; margin: 0 0 4px; text-transform: uppercase;">Autoevaluación</p>
                <p style="color: #3b82f6; font-size: 22px; font-weight: 800; margin: 0;">${resultado.promedioAuto.toFixed(2)}<span style="font-size: 12px; color: #94a3b8;"> / 4.0</span></p>
              </td>
              <td style="padding: 1px 6px; width: 4%; text-align: center; color: #94a3b8; font-size: 18px;">+</td>
              <td style="padding: 8px 12px; background: white; border-radius: 8px; width: 33%;">
                <p style="color: #64748b; font-size: 11px; font-weight: 600; margin: 0 0 4px; text-transform: uppercase;">Evaluación Líder</p>
                <p style="color: #f97316; font-size: 22px; font-weight: 800; margin: 0;">${resultado.promedioJefe.toFixed(2)}<span style="font-size: 12px; color: #94a3b8;"> / 4.0</span></p>
              </td>
              <td style="padding: 1px 6px; width: 4%; text-align: center; color: #94a3b8; font-size: 18px;">=</td>
              <td style="padding: 8px 12px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 8px; border: 1px solid #bbf7d0; width: 26%;">
                <p style="color: #14532d; font-size: 11px; font-weight: 600; margin: 0 0 4px; text-transform: uppercase;">Promedio Final</p>
                <p style="color: #16a34a; font-size: 22px; font-weight: 800; margin: 0;">${resultado.promedioFinal.toFixed(2)}<span style="font-size: 12px; color: #86efac;"> / 4.0</span></p>
              </td>
            </tr>
          </table>
          <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
            <span style="font-size: 13px; color: #475569;">Seniority alcanzado:</span>
            <span style="
              display: inline-block;
              margin-left: 8px;
              padding: 3px 12px;
              border-radius: 9999px;
              background: ${seniorityColor(resultado.seniorityAlcanzado)}22;
              color: ${seniorityColor(resultado.seniorityAlcanzado)};
              font-size: 13px;
              font-weight: 700;
              border: 1px solid ${seniorityColor(resultado.seniorityAlcanzado)}44;
            ">${resultado.seniorityAlcanzado}</span>
          </div>
        </div>`
    : '';

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">
          Resultados de tu Evaluación de Desempeño
        </h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">
          Grupo Kelsoft · Equipo de Capital Humano
        </p>
      </div>
      
      <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Hola <strong>${evaluadoNombre}</strong>,
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          El proceso de evaluación de desempeño ha concluido. Tanto tu autoevaluación como la evaluación por parte de tu líder ya fueron procesadas, y podemos compartirte los resultados finales.
        </p>

        ${resultadoHTML}

        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Adjunto a este email encontrarás tu <strong>Reporte PDF</strong> completo con el detalle de todas tus competencias (habilidades técnicas y conductuales), los comparativos con el nivel esperado para tu rol y el análisis de evolución respecto al período anterior.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          El próximo paso será una <strong>reunión de feedback 1:1 con tu líder</strong>, en la que se conversarán los resultados en detalle, se reconocerán tus fortalezas y se trabajará juntos en las oportunidades de desarrollo para el siguiente período.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Valoramos tu participación y el esfuerzo que dedicaste a este proceso. Nuestro objetivo es que sea una herramienta de crecimiento real y alineación de expectativas mutuas.
        </p>
        
        ${comentarioRRHH ? `
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
          <p style="color: #92400e; font-size: 13px; font-weight: 600; margin: 0 0 8px;">
            📝 Observaciones de Capital Humano:
          </p>
          <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0;">
            ${comentarioRRHH}
          </p>
        </div>
        ` : ''}
        
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
          Muchas gracias y felicitaciones por el proceso completado.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">
          Saludos,
        </p>
        <p style="color: #1e40af; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 600;">
          Equipo de Capital Humano KELSOFT
        </p>
      </div>
      
      <div style="background: #f3f4f6; padding: 16px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
          Este email fue enviado automáticamente desde el Sistema de Evaluación de Desempeño · Grupo Kelsoft
        </p>
      </div>
    </div>
  `.trim();
}

/**
 * Envía el PDF por email a través de Google Apps Script
 */
export async function enviarEmailConPDF(request: EmailRequest): Promise<EmailResponse> {
  const apiUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

  if (!apiUrl) {
    return {
      success: false,
      message: 'VITE_GOOGLE_SCRIPT_URL no está configurada en .env',
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Apps Script requiere text/plain para CORS
      },
      body: JSON.stringify({
        action: 'sendEmail',
        destinatarios: request.destinatarios,
        asunto: request.asunto,
        cuerpoHTML: request.cuerpoHTML,
        pdfBase64: request.pdfBase64,
        nombreArchivo: request.nombreArchivo,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        message: data.message || 'Error al enviar el email desde el servidor',
      };
    }

    return {
      success: true,
      message: data.message || 'Email enviado correctamente',
      enviados: data.enviados || request.destinatarios,
      fallidos: data.fallidos || [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de conexión al enviar email';
    return {
      success: false,
      message,
    };
  }
}
