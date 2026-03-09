// src/config/onboardingSteps.ts
import type { TooltipStep } from '../components/OnboardingTooltip';

// ─── RRHH / Director ──────────────────────────────────
export const dashboardSteps: TooltipStep[] = [
  {
    id: 'dashboard-tabs',
    title: 'Pestanas de Navegacion',
    description:
      'Usa estas pestanas para alternar entre la vista individual de cada persona, las metricas generales de la organizacion y la vista de equipo.',
    icon: '✨',
  },
  {
    id: 'dashboard-filtros',
    title: 'Panel de Filtros',
    description:
      'Filtra por periodo, area y persona. Podes buscar empleados por nombre y seleccionar el formulario (Lider o Analista) para enfocar tu analisis.',
    icon: '🔍',
  },
  {
    id: 'dashboard-cards',
    title: 'Tarjetas de Resumen',
    description:
      'Estas tarjetas muestran el promedio general, seniority esperado, seniority alcanzado y el estado (Cumple/No Cumple/Supero) de la persona seleccionada.',
    icon: '💡',
  },
  {
    id: 'dashboard-dumbbell',
    title: 'Grafico de Brecha (Dumbbell)',
    description:
      'Este grafico muestra la diferencia entre la autoevaluacion y la evaluacion del lider para cada skill. Cuanto mas corta la barra, mayor alineacion.',
    icon: '📏',
  },
  {
    id: 'dashboard-radar',
    title: 'Graficos de Radar',
    description:
      'Cada pentagono superpone el valor esperado (gris), la autoevaluacion (azul), la evaluacion del jefe (naranja) y el promedio final (verde). Asi identificas brechas rapidamente.',
    icon: '📊',
  },
  {
    id: 'dashboard-metricas',
    title: 'Metricas Generales',
    description:
      'Hace clic en la pestana "Metricas Generales" para ver indicadores agregados: distribucion de seniority, brechas promedio, tendencias y bandas por area.',
    icon: '📈',
  },
];

// ─── Lider ──────────────────────────────────────────────
// Orden: top-to-bottom dentro de cada sub-vista
export const liderSteps: TooltipStep[] = [
  // — Global —
  {
    id: 'lider-tabs',
    title: 'Tu Panel de Lider',
    description:
      'Tenes dos vistas: "Mi Desempeno" para revisar tus propias evaluaciones y "Mi Equipo" para ver como va tu equipo. Cambia entre ellas con estos botones.',
    icon: '✨',
  },
  // — Mi Desempeno (top → bottom) —
  {
    id: 'lider-mi-desempeno',
    title: 'Mis Metricas',
    description:
      'Aca ves tu promedio general, seniority alcanzado y seniority esperado de un vistazo.',
    icon: '💡',
  },
  {
    id: 'lider-skills-badges',
    title: 'Analisis de Skills',
    description:
      'Estas tarjetas te muestran que skills mejoraron, cuales bajaron y cuales mantuviste respecto al trimestre anterior. Usalo para enfocar tu desarrollo.',
    icon: '🏷️',
  },
  {
    id: 'lider-evolucion',
    title: 'Evolucion por Trimestre',
    description:
      'Este grafico de lineas compara tus puntajes del trimestre anterior vs el actual skill por skill para ver tu progreso.',
    icon: '📈',
  },
  {
    id: 'lider-radar',
    title: 'Mis Competencias (Radar)',
    description:
      'Los graficos de radar muestran tus Hard y Soft Skills. Podes alternar entre una vista compacta y otra detallada con el boton "Ver detalle".',
    icon: '📊',
  },
  // — Mi Equipo (top → bottom) —
  {
    id: 'lider-equipo-filtros',
    title: 'Filtros de Equipo',
    description:
      'Filtra por persona o periodo. Podes elegir periodos predefinidos o un rango de fechas personalizado para acotar los resultados.',
    icon: '🔍',
  },
  {
    id: 'lider-equipo-scatter',
    title: 'Bandas de Seniority',
    description:
      'El scatter chart compara el puntaje del Q anterior (eje X) vs el actual (eje Y). Las bandas de color indican las zonas de seniority. Puntos arriba de la diagonal estan mejorando.',
    icon: '📈',
  },
  {
    id: 'lider-equipo-tabla',
    title: 'Tabla de Equipo',
    description:
      'La tabla lista a cada miembro con sus promedios auto, jefe, final y la brecha (gap). Hace clic en una fila para ver el detalle de skills de esa persona.',
    icon: '👥',
  },
];

// ─── Analista ───────────────────────────────────────────
export const analistaSteps: TooltipStep[] = [
  {
    id: 'analista-tarjetas',
    title: 'Tarjetas de Resumen',
    description:
      'Estas cuatro tarjetas muestran tu autopuntuacion, la evaluacion de tu lider, el promedio final y el seniority que alcanzaste.',
    icon: '💡',
  },
  {
    id: 'analista-radar',
    title: 'Mis Competencias',
    description:
      'Los graficos de radar muestran tus Hard y Soft Skills. Podes cambiar a la vista detallada para ver por separado la autoevaluacion y la de tu jefe.',
    icon: '📊',
  },
  {
    id: 'analista-evolucion',
    title: 'Mi Evolucion',
    description:
      'El grafico de lineas muestra como cambio tu puntaje en los ultimos meses. La linea de referencia indica la meta de seniority para tu rol.',
    icon: '📈',
  },
  {
    id: 'analista-fortalezas',
    title: 'Fortalezas y Oportunidades',
    description:
      'Tus top 5 fortalezas (skills que superan lo esperado) y las 5 areas de mejora (skills por debajo del objetivo). Usalas para planificar tu desarrollo.',
    icon: '🎯',
  },
  {
    id: 'analista-feedback',
    title: 'Feedback de tu Lider',
    description:
      'Los comentarios que tu lider dejo sobre tus skills. Cada uno incluye la skill, fecha, puntaje y la observacion.',
    icon: '💬',
  },
];
