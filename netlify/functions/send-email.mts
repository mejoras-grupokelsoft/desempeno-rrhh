// netlify/functions/send-email.mts
// Envía el reporte PDF por email usando Gmail SMTP (Google Workspace) vía nodemailer.
// Reemplaza el viejo relay de Google Apps Script.
//
// Requiere configurar en Netlify (Site configuration → Environment variables):
//   GMAIL_USER          → cuenta de envío, ej: capital.humano@grupokelsoft.com
//   GMAIL_APP_PASSWORD  → contraseña de aplicación de 16 caracteres (no la contraseña normal),
//                          generada en https://myaccount.google.com/apppasswords
//                          (requiere verificación en 2 pasos activada en esa cuenta)
//   GMAIL_FROM_EMAIL    → (opcional) remitente mostrado, ej: 'Evaluación de Desempeño <capital.humano@grupokelsoft.com>'
//                          si no se define, se arma uno a partir de GMAIL_USER
import type { Config } from '@netlify/functions';
import nodemailer from 'nodemailer';

interface EmailRequestBody {
  destinatarios: string[];
  asunto: string;
  cuerpoHTML: string;
  pdfBase64?: string;
  nombreArchivo?: string;
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: true, message: 'Método no permitido' }, 405);
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    return jsonResponse(
      { error: true, message: 'Falta configurar GMAIL_USER y GMAIL_APP_PASSWORD en las variables de entorno de Netlify.' },
      500
    );
  }

  let body: EmailRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: true, message: 'Body inválido' }, 400);
  }

  const { destinatarios, asunto, cuerpoHTML, pdfBase64, nombreArchivo } = body;

  if (!destinatarios?.length || !asunto || !cuerpoHTML) {
    return jsonResponse({ error: true, message: 'Faltan datos requeridos (destinatarios, asunto, cuerpoHTML)' }, 400);
  }
  if ((pdfBase64 && !nombreArchivo) || (!pdfBase64 && nombreArchivo)) {
    return jsonResponse({ error: true, message: 'pdfBase64 y nombreArchivo deben enviarse juntos' }, 400);
  }

  const fromEmail = process.env.GMAIL_FROM_EMAIL || `"Capital Humano KELSOFT" <${gmailUser}>`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
  });

  const enviados: string[] = [];
  const fallidos: string[] = [];
  const errores: { destinatario: string; error: string }[] = [];

  for (const destinatario of destinatarios) {
    try {
      await transporter.sendMail({
        from: fromEmail,
        to: destinatario,
        subject: asunto,
        html: cuerpoHTML,
        ...(pdfBase64 && nombreArchivo
          ? { attachments: [{ filename: nombreArchivo, content: pdfBase64, encoding: 'base64' as const }] }
          : {}),
      });
      enviados.push(destinatario);
    } catch (err) {
      console.error(`Error enviando email a ${destinatario}:`, err);
      fallidos.push(destinatario);
      errores.push({ destinatario, error: describeSmtpError(err) });
    }
  }

  const todosFallaron = fallidos.length > 0 && enviados.length === 0;
  // El detalle del primer error va en el mensaje para que se vea en pantalla sin mirar logs
  const detalle = errores.length > 0 ? ` — ${errores[0].error}` : '';

  return jsonResponse({
    error: todosFallaron,
    message: fallidos.length === 0
      ? 'Email enviado correctamente'
      : `Enviados: ${enviados.length}, fallidos: ${fallidos.length}${detalle}`,
    enviados,
    fallidos,
    errores,
  }, todosFallaron ? 502 : 200);
};

// Resume el error de nodemailer sin datos sensibles: código SMTP + respuesta del servidor
function describeSmtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
  const partes = [
    e.responseCode ? String(e.responseCode) : e.code,
    (e.response || e.message || 'Error desconocido').slice(0, 200),
  ].filter(Boolean);
  return partes.join(' ');
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/send-email',
};
