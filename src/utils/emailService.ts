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

/**
 * Genera el cuerpo HTML del email con estilo profesional
 */
export function generarCuerpoEmail(
  evaluadoNombre: string,
  _periodo: string,
  comentarioRRHH?: string
): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">
          Evaluación de Desempeño
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
          Gracias por completar tu autoevaluación de desempeño.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Este es un paso clave dentro del proceso y valoramos el tiempo y la reflexión que le dedicaste.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          El próximo paso será la evaluación por parte de tu líder, quien analizará tu desempeño considerando tanto los aspectos técnicos como los comportamentales del rol.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Una vez finalizada esa instancia, se coordinará una reunión de feedback entre vos y tu líder. En ese espacio se compartirán los resultados de la evaluación, se conversarán fortalezas y oportunidades de mejora, y se trabajará de manera conjunta en el camino de desarrollo y profesionalización para el próximo período.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Nuestro objetivo es que este proceso sea una herramienta de crecimiento, aprendizaje y alineación de expectativas.
        </p>
        
        ${comentarioRRHH ? `
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
          <p style="color: #1e40af; font-size: 13px; font-weight: 600; margin: 0 0 8px;">
            Observaciones adicionales:
          </p>
          <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0;">
            ${comentarioRRHH}
          </p>
        </div>
        ` : ''}
        
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
          Gracias nuevamente por tu participación.
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
