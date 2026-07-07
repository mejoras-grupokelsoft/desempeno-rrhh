// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Evaluation, RadarDataPoint } from '../types';

// Convierte el SVG del logo a PNG base64 para usar en jsPDF (alta resolución)
async function getLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo-kelsoft.svg');
    if (!res.ok) return null;
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = 4; // 4x para alta resolución
        const canvas = document.createElement('canvas');
        canvas.width = 483 * scale;
        canvas.height = 99 * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch {
    return null;
  }
}

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

  // 9. Comentarios (1 de autoevaluación + 1 del líder)
  comentarios: { tipo: string; comentario: string }[];

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
  if (abs === 0) return { text: 'Coincidencia alta', color: GREEN };
  if (abs <= 1) return { text: 'Diferencia moderada', color: AMBER };
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
// HEADER REUTILIZABLE (aparece en todas las páginas)
// ============================================================
function drawHeader(doc: jsPDF, logoBase64: string | null, W: number): void {
  const margin = 18;
  const HEADER_H = 20;

  // Fondo gris claro
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 0, W, HEADER_H, 'F');

  // Logo centrado horizontalmente en el bloque logo+texto
  const logoW = 38;
  const logoH = 8;
  const totalW = logoW + 2 + 4 + 60; // logo + separador gap + text aprox
  const startX = (W - totalW) / 2;

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', startX, (HEADER_H - logoH) / 2, logoW, logoH);
  } else {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('GRUPO KELSOFT', startX, HEADER_H / 2 + 3);
  }

  // Separador vertical
  const sepX = startX + logoW + 4;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(sepX, 4, sepX, HEADER_H - 4);

  // Texto a la derecha del separador
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Evaluaci\u00f3n de Desempe\u00f1o', sepX + 4, HEADER_H / 2 + 3);

  // Línea horizontal inferior del header
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(0, HEADER_H, W, HEADER_H);

  // Reset
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
}

// ============================================================
// GENERADOR PRINCIPAL — 9 SECCIONES (spec RRHH)
// ============================================================

export async function generarPDFIndividual(data: PDFReporteData): Promise<jsPDF> {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 16;

  // ===== HEADER (página 1) =====
  const logoBase64 = await getLogoBase64();
  drawHeader(doc, logoBase64, W);
  y = 26;

  // Título de la página
  doc.setTextColor(...BLUE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Evaluaci\u00f3n de Desempe\u00f1o', W / 2, y, { align: 'center' });
  y += 8;

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
      head: [['Habilidad', 'Autoevaluación', 'Líder', 'Promedio Ponderado', 'Diferencia (Auto vs Líder)']],
      body: data.radarDataHard.map(s => {
        const diff = s.auto - s.jefe;
        return [s.skill, s.auto.toFixed(2), s.jefe.toFixed(2), s.promedio.toFixed(2), (diff >= 0 ? '+' : '') + diff.toFixed(2)];
      }),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 38 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 4 && hookData.section === 'body') {
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
      head: [['Habilidad', 'Autoevaluación', 'Líder', 'Promedio Ponderado', 'Diferencia (Auto vs Líder)']],
      body: data.radarDataSoft.map(s => {
        const diff = s.auto - s.jefe;
        return [s.skill, s.auto.toFixed(2), s.jefe.toFixed(2), s.promedio.toFixed(2), (diff >= 0 ? '+' : '') + diff.toFixed(2)];
      }),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 38 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.column.index === 4 && hookData.section === 'body') {
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
      head: [['Habilidad', 'Autoevaluación', 'Líder', 'Diferencia (Auto vs Líder)', 'Indicador']],
      body: brechas.map(b => {
        const bl = brechaLabel(b.diff);
        return [b.skill, b.auto.toFixed(2), b.jefe.toFixed(2), (b.diff >= 0 ? '+' : '') + b.diff.toFixed(2), bl.text];
      }),
      theme: 'striped',
      headStyles: { fillColor: [...BLUE], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 35 },
        4: { cellWidth: 38 },
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
    .filter(s => s.promedio > 0)
    .sort((a, b) => b.promedio - a.promedio)
    .slice(0, 5);

  if (fortalezas.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Habilidad', 'Promedio Ponderado', 'Categoría']],
      body: fortalezas.map((s, i) => {
        const isHard = data.radarDataHard.some(h => h.skill === s.skill);
        return [(i + 1).toString(), s.skill, s.promedio.toFixed(2), isHard ? 'Hard' : 'Soft'];
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
    .filter(s => s.promedio > 0)
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
      head: [['#', 'Habilidad', 'Promedio Ponderado', 'Orientación']],
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
    const tendenciaLabel = tendencia === 'mejora' ? '+ Mejora' : tendencia === 'descenso' ? '- Descenso' : '= Estable';
    const tendenciaColor = tendencia === 'mejora' ? GREEN : tendencia === 'descenso' ? RED : GRAY;

    y = checkPageBreak(doc, y, 60);

    // ---- GRÁFICO DE BARRAS VISUAL ----
    const barLabelWidth = 30;
    const barStartX = margin + barLabelWidth + 3;
    const barMaxWidth = W - margin - barStartX - 20;
    const barHeight = 12;
    const maxScale = 4;

    // Barra S Anterior
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('S Anterior', margin, y + 8);
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(barStartX, y, barMaxWidth, barHeight, 2, 2, 'F');
    const barWidthAnt = Math.max(2, (promedioAnterior / maxScale) * barMaxWidth);
    doc.setFillColor(148, 163, 184);
    doc.roundedRect(barStartX, y, barWidthAnt, barHeight, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (barWidthAnt > 20) {
      doc.setTextColor(255, 255, 255);
      doc.text(promedioAnterior.toFixed(2), barStartX + barWidthAnt - 2, y + 8, { align: 'right' });
    } else {
      doc.setTextColor(80, 80, 80);
      doc.text(promedioAnterior.toFixed(2), barStartX + barWidthAnt + 3, y + 8);
    }
    y += barHeight + 6;

    // Barra S Actual
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('S Actual', margin, y + 8);
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(barStartX, y, barMaxWidth, barHeight, 2, 2, 'F');
    const barWidthAct = Math.max(2, (promedioActual / maxScale) * barMaxWidth);
    const actualBarColor: readonly [number, number, number] = tendencia === 'mejora' ? GREEN : tendencia === 'descenso' ? RED : BLUE;
    doc.setFillColor(...actualBarColor);
    doc.roundedRect(barStartX, y, barWidthAct, barHeight, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (barWidthAct > 20) {
      doc.setTextColor(255, 255, 255);
      doc.text(promedioActual.toFixed(2), barStartX + barWidthAct - 2, y + 8, { align: 'right' });
    } else {
      doc.setTextColor(80, 80, 80);
      doc.text(promedioActual.toFixed(2), barStartX + barWidthAct + 3, y + 8);
    }
    y += barHeight + 4;

    // Escala
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i <= maxScale; i++) {
      const xPos = barStartX + (i / maxScale) * barMaxWidth;
      doc.text(i.toString(), xPos, y + 3, { align: 'center' });
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(xPos, y - barHeight * 2 - 10, xPos, y);
    }
    y += 8;

    // Línea resumen de variación
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const tendColor: readonly [number, number, number] = tendenciaColor;
    doc.setTextColor(...tendColor);
    const variacionText = `Variación: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}  ·  ${tendenciaLabel}`;
    doc.text(variacionText, W / 2, y, { align: 'center' });
    y += 12;
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

  if (data.evolucion) {
    // Segunda evaluación en adelante → mostrar comparación
    const seniorityLevels = ['Trainee', 'Junior', 'Semi Senior', 'Senior'];
    const idxEsperado = seniorityLevels.indexOf(data.seniorityEsperado);
    const idxAlcanzado = seniorityLevels.indexOf(data.seniorityAlcanzado);
    const brechaSeniority = idxAlcanzado - idxEsperado;
    const brechaTexto = brechaSeniority > 0
      ? 'Subió de nivel'
      : brechaSeniority === 0
        ? 'Se mantiene en el mismo nivel'
        : 'Bajó de nivel';
    const brechaColor = brechaSeniority > 0 ? GREEN : brechaSeniority === 0 ? BLUE : RED;

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Valor']],
      body: [
        ['Seniority Alcanzado (período actual)', data.seniorityAlcanzado],
        ['Seniority Período Anterior', data.seniorityEsperado !== 'Junior' ? data.seniorityEsperado : 'Ver período anterior'],
        ['Variación', brechaTexto],
      ],
      theme: 'grid',
      headStyles: { fillColor: [...BLUE], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
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
    doc.text('Comparación entre el seniority del período actual y el período anterior.', margin, y);
    y += 8;
  } else {
    // Primera evaluación → solo mostrar el seniority determinado
    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Valor']],
      body: [
        ['Seniority Determinado', data.seniorityAlcanzado],
      ],
      theme: 'grid',
      headStyles: { fillColor: [...BLUE], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    y = checkPageBreak(doc, y, 10);
    doc.text('Primera evaluación — la comparación de nivel se mostrará a partir del siguiente período.', margin, y);
    y += 8;
  }

  // ================================================================
  // 9. COMENTARIOS
  // ================================================================
  y = sectionTitle(doc, 'Comentarios', y, margin, 9);

  if (data.comentarios.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Fuente', 'Comentario']],
      body: data.comentarios.map(c => [c.tipo, c.comentario]),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35 },
        1: { cellWidth: 'auto' },
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

  // ===== HEADER Y FOOTER EN TODAS LAS PÁGINAS =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Header en cada página
    drawHeader(doc, logoBase64, W);
    // Footer
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
export async function generarPDFConsolidado(
  area: string,
  periodo: string,
  evaluaciones: Evaluation[],
  promedioArea: number,
  totalEvaluados: number,
  resultados: any[] = []
): Promise<jsPDF> {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 18;
  const BLUE: [number, number, number] = [30, 64, 175];
  const GRAY: [number, number, number] = [100, 100, 100];

  // Logo cargado una sola vez — se reutiliza en header de cada página
  const logoBase64 = await getLogoBase64();

  const addFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      // Header en cada página
      drawHeader(doc, logoBase64, W);
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(
        `Generado el ${new Date().toLocaleDateString('es-AR')} · Página ${i} de ${pages}`,
        W / 2, H - 8, { align: 'center' }
      );
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, H - 12, W - margin, H - 12);
    }
  };

  let y = 14;

  // ===== HEADER CONSOLIDADO (página 1) =====
  drawHeader(doc, logoBase64, W);
  y = 26;

  // Título de la página
  doc.setTextColor(...BLUE);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte Consolidado de Evaluaciones', W / 2, y, { align: 'center' });
  y += 8;

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ===== INFO GENERAL =====
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Área: ${area}   ·   Período: ${periodo}   ·   Total evaluados: ${totalEvaluados}   ·   Promedio general: ${promedioArea.toFixed(2)}`, margin, y);
  y += 10;

  // ===== TABLA RESUMEN POR PERSONA =====
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('Resumen por persona', margin, y);
  y += 5;

  // Agrupar por área
  const porArea = new Map<string, any[]>();
  for (const p of resultados) {
    const areaKey = p.area || 'Sin área';
    if (!porArea.has(areaKey)) porArea.set(areaKey, []);
    porArea.get(areaKey)!.push(p);
  }

  for (const [areaNombre, personas] of Array.from(porArea.entries()).sort()) {
    // Subtítulo de área
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text(`[ ${areaNombre} ]`, margin, y + 4);
    y += 8;

    const promedioAreaLocal = personas.reduce((s, p) => s + (p.promedioFinal || 0), 0) / personas.length;

    autoTable(doc, {
      startY: y,
      head: [['Nombre', 'Rol', 'Auto', 'Jefe', 'Promedio', 'Seniority', 'Estado']],
      body: personas.map(p => {
        const auto = typeof p.promedioAuto === 'number' ? p.promedioAuto.toFixed(2) : '-';
        const jefe = typeof p.promedioJefe === 'number' ? p.promedioJefe.toFixed(2) : '-';
        const prom = typeof p.promedioFinal === 'number' ? p.promedioFinal.toFixed(2) : '-';
        const diff = p.promedioFinal - promedioAreaLocal;
        const estado = diff > 0.3 ? '+ Sobre promedio' : diff < -0.3 ? '- Bajo promedio' : '= En promedio';
        return [
          p.nombre || p.evaluadoNombre || '-',
          p.rol || '-',
          auto,
          jefe,
          prom,
          p.seniorityAlcanzado || '-',
          estado,
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: BLUE, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 28 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 24 },
        6: { cellWidth: 28 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.section === 'body') {
          const val = data.cell.raw as string;
          if (val.startsWith('+')) data.cell.styles.textColor = [22, 101, 52];
          else if (val.startsWith('-')) data.cell.styles.textColor = [185, 28, 28];
          else data.cell.styles.textColor = [80, 80, 80];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
    if (y > H - 40) { doc.addPage(); y = 20; }
  }

  // ===== OPORTUNIDADES DE MEJORA POR AREA =====
  if (evaluaciones.length > 0) {
    if (y > H - 60) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text('Oportunidades de mejora por area', margin, y);
    y += 6;

    // Agrupar evaluaciones por area
    const evalsPorArea = new Map<string, typeof evaluaciones>();
    for (const e of evaluaciones) {
      if (!e.skillNombre || e.skillNombre === 'general') continue;
      const a = e.area || 'Sin area';
      if (!evalsPorArea.has(a)) evalsPorArea.set(a, []);
      evalsPorArea.get(a)!.push(e);
    }

    for (const [areaNombre, evalsArea] of Array.from(evalsPorArea.entries()).sort()) {
      if (y > H - 50) { doc.addPage(); y = 20; }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLUE);
      doc.text(`[ ${areaNombre} ]`, margin, y + 4);
      y += 7;

      const skillMapArea = new Map<string, { sum: number; count: number; tipo: string }>();
      for (const e of evalsArea) {
        if (!skillMapArea.has(e.skillNombre)) skillMapArea.set(e.skillNombre, { sum: 0, count: 0, tipo: e.skillTipo || '' });
        const d = skillMapArea.get(e.skillNombre)!;
        d.sum += e.puntaje;
        d.count += 1;
      }

      const skillsOrdenadas = Array.from(skillMapArea.entries())
        .map(([nombre, d]) => ({ nombre, promedio: d.sum / d.count, tipo: d.tipo }))
        .filter(s => s.promedio < 3) // Solo mostrar las que necesitan mejora
        .sort((a, b) => a.promedio - b.promedio)
        .slice(0, 5);

      if (skillsOrdenadas.length === 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text('Sin oportunidades identificadas para esta area.', margin + 5, y);
        y += 6;
        continue;
      }

      autoTable(doc, {
        startY: y,
        head: [['Habilidad', 'Tipo', 'Promedio', 'Brecha']],
        body: skillsOrdenadas.map(s => [
          s.nombre,
          s.tipo,
          s.promedio.toFixed(2),
          s.promedio < 2 ? 'Alta' : 'Media',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 20, halign: 'center' },
        },
        margin: { left: margin + 5, right: margin },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  addFooter();
  return doc;
}
