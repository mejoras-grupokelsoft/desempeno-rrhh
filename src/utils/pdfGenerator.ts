// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Evaluation, RadarDataPoint } from '../types';

// ============================================================
// TIPOS
// ============================================================

export interface PDFReporteData {
  // 1. Datos básicos
  evaluadoNombre: string;
  evaluadoEmail: string;
  rol: string;
  area: string;
  periodoEvaluado: string;
  liderEvaluadorNombre: string;

  // 2. Resultados generales
  promedioGeneral: number;        // Hard + Soft combinado
  seniorityAlcanzado: string;

  // 3. Resultados por dimensión
  radarDataHard: RadarDataPoint[];
  radarDataSoft: RadarDataPoint[];

  // 7. Evolución / proyección (opcional, a partir de 2da evaluación)
  evolucion?: {
    promedioAnterior: number;
    promedioActual: number;
    tendencia: 'mejora' | 'estable' | 'descenso';
  };

  // 8. Seniority
  seniorityEsperado: string;

  // 9. Comentarios
  comentarios: { fecha: string; skill: string; comentario: string; puntaje: number }[];

  // Extra: comentario libre de RRHH (textarea al generar)
  comentarioRRHH?: string;
}

// ============================================================
// HELPERS
// ============================================================

const BLUE = [30, 64, 175] as const;
const GREEN = [22, 163, 74] as const;
const RED = [220, 38, 38] as const;
const AMBER = [217, 119, 6] as const;
const GRAY = [120, 113, 108] as const;

function nivelDescripcion(promedio: number): string {
  if (promedio >= 3.5) return 'Supera lo esperado';
  if (promedio >= 2.5) return 'Cumple lo esperado';
  if (promedio >= 1.5) return 'En desarrollo';
  return 'Requiere atención';
}

function brechaLabel(diff: number): { text: string; color: readonly [number, number, number] } {
  const abs = Math.abs(diff);
  if (abs <= 0.3) return { text: 'Coincidencia alta', color: GREEN };
  if (abs <= 0.8) return { text: 'Diferencia moderada', color: AMBER };
  return { text: 'Diferencia significativa', color: RED };
}

function promedio(arr: RadarDataPoint[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, d) => s + d.promedio, 0) / arr.length;
}

function checkPageBreak(doc: jsPDF, yPos: number, needed: number): number {
  if (yPos + needed > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    return 20;
  }
  return yPos;
}

function sectionTitle(doc: jsPDF, text: string, yPos: number, margin: number, sectionNum: number): number {
  yPos = checkPageBreak(doc, yPos, 20);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text(`${sectionNum}. ${text}`, margin, yPos);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos + 2, doc.internal.pageSize.getWidth() - margin, yPos + 2);
  return yPos + 9;
}

// ============================================================
// GENERADOR PRINCIPAL — 9 SECCIONES (spec RRHH)
// ============================================================

export function generarPDFIndividual(data: PDFReporteData): jsPDF {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 16;

  // ===== HEADER =====
  doc.setFillColor(...BLUE);
  doc.rect(margin, y, 32, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('GRUPO', margin + 3, y + 5);
  doc.text('KELSOFT', margin + 3, y + 9.5);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(19);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Evaluación de Desempeño', W / 2, y + 7, { align: 'center' });
  y += 18;

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ================================================================
  // 1. DATOS BÁSICOS
  // ================================================================
  y = sectionTitle(doc, 'Datos Básicos', y, margin, 1);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const basicFields: [string, string][] = [
    ['Nombre y Apellido', data.evaluadoNombre],
    ['Rol', data.rol],
    ['Área', data.area],
    ['Período Evaluado', data.periodoEvaluado],
    ['Líder Evaluador', data.liderEvaluadorNombre],
  ];
  basicFields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '-', margin + 52, y);
    y += 6;
  });
  y += 4;

  // ================================================================
  // 2. RESULTADOS GENERALES
  // ================================================================
  y = sectionTitle(doc, 'Resultados Generales', y, margin, 2);

  const nivelLabel = nivelDescripcion(data.promedioGeneral);
  const allSkills = [...data.radarDataHard, ...data.radarDataSoft];
  const promedioHard = promedio(data.radarDataHard);
  const promedioSoft = promedio(data.radarDataSoft);

  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: [
      ['Puntaje Total (Hard + Soft)', `${data.promedioGeneral.toFixed(2)} / 4.00`],
      ['Desglose Hard Skills', `${promedioHard.toFixed(2)} / 4.00`],
      ['Desglose Soft Skills', `${promedioSoft.toFixed(2)} / 4.00`],
      ['Nivel Alcanzado', `${data.seniorityAlcanzado} — "${nivelLabel}"`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...BLUE], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ================================================================
  // 3. RESULTADOS POR DIMENSIÓN (HARD / SOFT)
  // ================================================================
  y = sectionTitle(doc, 'Resultados por Dimensión', y, margin, 3);

  // — 3a. HARD SKILLS —
  if (data.radarDataHard.length > 0) {
    y = checkPageBreak(doc, y, 15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Hard Skills', margin, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Promedio: ${promedioHard.toFixed(2)}`, margin + 50, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Habilidad', 'Auto', 'Líder', 'Diferencia']],
      body: data.radarDataHard.map(s => {
        const diff = s.auto - s.jefe;
        return [s.skill, s.auto.toFixed(2), s.jefe.toFixed(2), (diff >= 0 ? '+' : '') + diff.toFixed(2)];
      }),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 3 && hookData.section === 'body') {
          const v = parseFloat(hookData.cell.text[0]);
          hookData.cell.styles.textColor = v > 0.3 ? [...AMBER] : v < -0.3 ? [...RED] : [...GREEN];
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // — 3b. SOFT SKILLS —
  if (data.radarDataSoft.length > 0) {
    y = checkPageBreak(doc, y, 15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Soft Skills', margin, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Promedio: ${promedioSoft.toFixed(2)}`, margin + 50, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Habilidad', 'Auto', 'Líder', 'Diferencia']],
      body: data.radarDataSoft.map(s => {
        const diff = s.auto - s.jefe;
        return [s.skill, s.auto.toFixed(2), s.jefe.toFixed(2), (diff >= 0 ? '+' : '') + diff.toFixed(2)];
      }),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 3 && hookData.section === 'body') {
          const v = parseFloat(hookData.cell.text[0]);
          hookData.cell.styles.textColor = v > 0.3 ? [...AMBER] : v < -0.3 ? [...RED] : [...GREEN];
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text('Valor del espejo: cómo me veo (Auto) vs cómo me ven (Líder).', margin, y);
  y += 8;

  // ================================================================
  // 4. BRECHAS DE PERCEPCIÓN
  // ================================================================
  y = sectionTitle(doc, 'Brechas de Percepción', y, margin, 4);

  const brechas = allSkills
    .map(s => ({ skill: s.skill, diff: s.auto - s.jefe, auto: s.auto, jefe: s.jefe }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (brechas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Habilidad', 'Auto', 'Líder', 'Diferencia', 'Indicador']],
      body: brechas.map(b => {
        const bl = brechaLabel(b.diff);
        return [b.skill, b.auto.toFixed(2), b.jefe.toFixed(2), (b.diff >= 0 ? '+' : '') + b.diff.toFixed(2), bl.text];
      }),
      theme: 'striped',
      headStyles: { fillColor: [...BLUE], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 25 },
        4: { cellWidth: 45 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 4 && hookData.section === 'body') {
          const txt = hookData.cell.text[0];
          if (txt === 'Coincidencia alta') hookData.cell.styles.textColor = [...GREEN];
          else if (txt === 'Diferencia moderada') hookData.cell.styles.textColor = [...AMBER];
          else hookData.cell.styles.textColor = [...RED];
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  y = checkPageBreak(doc, y, 10);
  doc.text('Clave para el feedback: las diferencias significativas son oportunidades de conversación.', margin, y);
  y += 8;

  // ================================================================
  // 5. FORTALEZAS DESTACADAS
  // ================================================================
  y = sectionTitle(doc, 'Fortalezas Destacadas', y, margin, 5);

  const fortalezas = allSkills
    .filter(s => s.jefe > 0)
    .sort((a, b) => b.jefe - a.jefe)
    .slice(0, 5);

  if (fortalezas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Habilidad', 'Puntaje Líder', 'Categoría']],
      body: fortalezas.map((s, i) => {
        const isHard = data.radarDataHard.some(h => h.skill === s.skill);
        return [(i + 1).toString(), s.skill, s.jefe.toFixed(2), isHard ? 'Hard' : 'Soft'];
      }),
      theme: 'striped',
      headStyles: { fillColor: [...GREEN], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 70 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Sin datos suficientes para identificar fortalezas.', margin, y);
    y += 8;
  }

  // ================================================================
  // 6. OPORTUNIDADES DE MEJORA
  // ================================================================
  y = sectionTitle(doc, 'Oportunidades de Mejora', y, margin, 6);

  const mejoras = allSkills
    .filter(s => s.jefe > 0)
    .sort((a, b) => a.promedio - b.promedio)
    .slice(0, 3);

  if (mejoras.length > 0) {
    const orientacion = (prom: number): string => {
      if (prom < 1.5) return 'Área de desarrollo prioritaria';
      if (prom < 2.5) return 'Oportunidad de crecimiento';
      return 'Refuerzo sugerido';
    };

    autoTable(doc, {
      startY: y,
      head: [['#', 'Habilidad', 'Puntaje', 'Orientación']],
      body: mejoras.map((s, i) => [
        (i + 1).toString(),
        s.skill,
        s.promedio.toFixed(2),
        orientacion(s.promedio),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [...RED], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 60 },
        2: { halign: 'center', cellWidth: 25 },
        3: { cellWidth: 60, fontStyle: 'italic' },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Sin datos suficientes para identificar áreas de mejora.', margin, y);
    y += 8;
  }

  // ================================================================
  // 7. EVOLUCIÓN / PROYECCIÓN
  // ================================================================
  y = sectionTitle(doc, 'Evolución / Proyección', y, margin, 7);

  if (data.evolucion) {
    const { promedioAnterior, promedioActual, tendencia } = data.evolucion;
    const diff = promedioActual - promedioAnterior;
    const tendenciaLabel = tendencia === 'mejora' ? '▲ Mejora' : tendencia === 'descenso' ? '▼ Descenso' : '= Estable';
    const tendenciaColor = tendencia === 'mejora' ? GREEN : tendencia === 'descenso' ? RED : GRAY;

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Valor']],
      body: [
        ['Puntaje Q Anterior', promedioAnterior.toFixed(2)],
        ['Puntaje Q Actual', promedioActual.toFixed(2)],
        ['Variación', (diff >= 0 ? '+' : '') + diff.toFixed(2)],
        ['Tendencia', tendenciaLabel],
      ],
      theme: 'grid',
      headStyles: { fillColor: [...BLUE], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.row.index === 3 && hookData.column.index === 1 && hookData.section === 'body') {
          hookData.cell.styles.textColor = [...tendenciaColor];
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text('Primera evaluación registrada — la evolución se mostrará a partir de la segunda.', margin, y);
    y += 8;
  }

  // ================================================================
  // 8. SENIORITY / NIVEL DEL ROL
  // ================================================================
  y = sectionTitle(doc, 'Seniority / Nivel del Rol', y, margin, 8);

  const seniorityLevels = ['Trainee', 'Junior', 'Semi Senior', 'Senior'];
  const idxEsperado = seniorityLevels.indexOf(data.seniorityEsperado);
  const idxAlcanzado = seniorityLevels.indexOf(data.seniorityAlcanzado);
  const brechaSeniority = idxAlcanzado - idxEsperado;
  const brechaTexto = brechaSeniority > 0
    ? 'Superó el nivel esperado'
    : brechaSeniority === 0
      ? 'Alcanza el nivel esperado'
      : `Brecha de ${Math.abs(brechaSeniority)} nivel(es) por debajo`;
  const brechaColor = brechaSeniority > 0 ? GREEN : brechaSeniority === 0 ? GREEN : RED;

  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: [
      ['Seniority Actual (según resultados)', data.seniorityAlcanzado],
      ['Seniority Objetivo del Rol', data.seniorityEsperado],
      ['Brecha', brechaTexto],
    ],
    theme: 'grid',
    headStyles: { fillColor: [...BLUE], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    margin: { left: margin, right: margin },
    didParseCell: (hookData) => {
      if (hookData.row.index === 2 && hookData.column.index === 1 && hookData.section === 'body') {
        hookData.cell.styles.textColor = [...brechaColor];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  y = checkPageBreak(doc, y, 10);
  doc.text('Clave para expectativas de crecimiento profesional.', margin, y);
  y += 8;

  // ================================================================
  // 9. COMENTARIOS
  // ================================================================
  y = sectionTitle(doc, 'Comentarios', y, margin, 9);

  if (data.comentarios.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Skill', 'Puntaje', 'Comentario']],
      body: data.comentarios.map(c => [c.fecha, c.skill, c.puntaje.toString(), c.comentario]),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { halign: 'center', cellWidth: 18 },
        3: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text('No se registraron comentarios en esta evaluación.', margin, y);
    y += 8;
  }

  // — Comentario libre de RRHH —
  if (data.comentarioRRHH && data.comentarioRRHH.trim()) {
    y = checkPageBreak(doc, y, 25);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text('Observaciones de RRHH', margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(data.comentarioRRHH, W - 2 * margin);
    y = checkPageBreak(doc, y, lines.length * 5 + 5);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 5;
  }

  // ===== FOOTER EN TODAS LAS PÁGINAS =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Documento generado el ${new Date().toLocaleDateString('es-AR')} — Página ${i} de ${pageCount}`,
      W / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      'CONFIDENCIAL — Uso exclusivo interno',
      W / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Genera PDF consolidado de área
 */
export function generarPDFConsolidado(
  area: string,
  periodo: string,
  evaluaciones: Evaluation[],
  promedioArea: number,
  totalEvaluados: number
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // ===== HEADER =====
  doc.setFillColor(30, 64, 175);
  doc.rect(margin, yPos, 30, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('GRUPO', margin + 3, yPos + 7);
  doc.text('KELSOFT', margin + 15, yPos + 7);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte Consolidado de Evaluaciones', pageWidth / 2, yPos + 7, { align: 'center' });
  yPos += 20;

  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // ===== RESUMEN EJECUTIVO =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Resumen Ejecutivo', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: yPos,
    head: [['Métrica', 'Valor']],
    body: [
      ['Área', area || 'Todas las áreas'],
      ['Período', periodo],
      ['Total de Evaluados', totalEvaluados.toString()],
      ['Promedio General del Área', promedioArea.toFixed(2) + ' / 4.0']
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: margin, right: margin }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ===== DETALLES =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Detalle de Evaluaciones', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Este reporte contiene información agregada del período seleccionado.', margin, yPos);
  doc.text('Para ver detalles individuales, genere PDFs por evaluado desde la vista individual.', margin, yPos + 5);
  yPos += 15;

  // Resumen de evaluaciones por área
  const evaluadosUnicos = new Set(evaluaciones.map(e => e.evaluadoEmail)).size;
  doc.setFontSize(10);
  doc.text(`Total de evaluaciones registradas: ${evaluaciones.length}`, margin, yPos);
  yPos += 5;
  doc.text(`Evaluados únicos: ${evaluadosUnicos}`, margin, yPos);

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Documento generado el ${new Date().toLocaleDateString('es-AR')} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return doc;
}
