// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Evaluation, RadarDataPoint } from '../types';

interface PDFIndividualData {
  evaluadoNombre: string;
  evaluadoEmail: string;
  area: string;
  rol: string;
  seniorityEsperado: string;
  seniorityAlcanzado: string;
  promedioGeneral: number;
  gapAutoLider: number;
  fechaEvaluacion: string;
  evaluadorNombre: string;
  radarData: RadarDataPoint[];
  comentarioRRHH?: string;
}

/**
 * Genera PDF individual de evaluación de desempeño
 */
export function generarPDFIndividual(data: PDFIndividualData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // ===== HEADER =====
  // Logo (placeholder - agregar logo real después)
  doc.setFillColor(30, 64, 175); // Azul corporativo
  doc.rect(margin, yPos, 30, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('GRUPO', margin + 3, yPos + 7);
  doc.text('KELSOFT', margin + 15, yPos + 7);
  doc.setTextColor(0, 0, 0);

  // Título principal
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Evaluación de Desempeño', pageWidth / 2, yPos + 7, { align: 'center' });
  
  yPos += 20;

  // Línea separadora
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // ===== SECCIÓN 1: INFORMACIÓN DEL EVALUADO =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Información del Evaluado', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const infoData = [
    ['Nombre:', data.evaluadoNombre],
    ['Email:', data.evaluadoEmail],
    ['Área:', data.area],
    ['Rol:', data.rol],
    ['Fecha de Evaluación:', data.fechaEvaluacion],
    ['Evaluador:', data.evaluadorNombre]
  ];

  infoData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 50, yPos);
    yPos += 6;
  });

  yPos += 5;

  // ===== SECCIÓN 2: RESULTADOS CONSOLIDADOS =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Resultados Consolidados', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // Tabla de resultados principales
  autoTable(doc, {
    startY: yPos,
    head: [['Métrica', 'Valor']],
    body: [
      ['Seniority Esperado', data.seniorityEsperado],
      ['Seniority Alcanzado', data.seniorityAlcanzado],
      ['Promedio General', data.promedioGeneral.toFixed(2) + ' / 4.0'],
      ['Gap Auto-Líder', data.gapAutoLider.toFixed(2) + ' puntos']
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: margin, right: margin }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ===== SECCIÓN 3: DESGLOSE POR SKILLS =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Desglose por Habilidades', margin, yPos);
  yPos += 8;

  // Preparar datos de la tabla
  const skillsTableData = data.radarData.map((skill) => {
    const gap = skill.promedio - skill.esperado;
    const gapText = gap >= 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2);
    return [
      skill.skill,
      skill.auto.toFixed(2),
      skill.jefe.toFixed(2),
      skill.promedio.toFixed(2),
      skill.esperado.toFixed(2),
      gapText
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Habilidad', 'Auto', 'Líder', 'Promedio', 'Esperado', 'Gap']],
    body: skillsTableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' }
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Colorear la columna de Gap
      if (data.column.index === 5 && data.section === 'body') {
        const value = parseFloat(data.cell.text[0]);
        if (value >= 0) {
          data.cell.styles.textColor = [34, 197, 94]; // Verde
        } else if (value < -0.5) {
          data.cell.styles.textColor = [239, 68, 68]; // Rojo
        } else {
          data.cell.styles.textColor = [234, 179, 8]; // Amarillo
        }
      }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ===== SECCIÓN 4: ANÁLISIS CUALITATIVO =====
  // Identificar fortalezas (gap positivo o cero)
  const fortalezas = data.radarData
    .filter(s => s.promedio >= s.esperado)
    .sort((a, b) => (b.promedio - b.esperado) - (a.promedio - a.esperado))
    .slice(0, 3);

  // Identificar áreas de mejora (gap negativo)
  const areasMejora = data.radarData
    .filter(s => s.promedio < s.esperado)
    .sort((a, b) => (a.promedio - a.esperado) - (b.promedio - b.esperado))
    .slice(0, 3);

  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('Análisis Cualitativo', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // Fortalezas
  if (fortalezas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94); // Verde
    doc.text('✓ Fortalezas Destacadas:', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    fortalezas.forEach((skill, index) => {
      const gap = skill.promedio - skill.esperado;
      doc.text(
        `${index + 1}. ${skill.skill}: ${skill.promedio.toFixed(2)}/4.0 (${gap >= 0 ? '+' : ''}${gap.toFixed(2)} vs esperado)`,
        margin + 5,
        yPos
      );
      yPos += 5;
    });
    yPos += 3;
  }

  // Áreas de mejora
  if (areasMejora.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // Rojo
    doc.text('⚠ Áreas de Mejora:', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    areasMejora.forEach((skill, index) => {
      const gap = skill.promedio - skill.esperado;
      doc.text(
        `${index + 1}. ${skill.skill}: ${skill.promedio.toFixed(2)}/4.0 (${gap.toFixed(2)} vs esperado)`,
        margin + 5,
        yPos
      );
      yPos += 5;
    });
    yPos += 3;
  }

  // ===== SECCIÓN 5: COMENTARIO ADICIONAL DE RRHH =====
  if (data.comentarioRRHH && data.comentarioRRHH.trim()) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    yPos += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('Comentarios de Recursos Humanos', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Dividir texto largo en líneas
    const comentarioLines = doc.splitTextToSize(data.comentarioRRHH, pageWidth - 2 * margin);
    doc.text(comentarioLines, margin, yPos);
    yPos += comentarioLines.length * 5 + 5;
  }

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
    doc.text(
      'CONFIDENCIAL - Uso exclusivo interno',
      pageWidth / 2,
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
