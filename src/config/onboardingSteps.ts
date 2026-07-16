// src/config/onboardingSteps.ts
import type { TooltipStep } from '../components/OnboardingTooltip';

// ─── RRHH / Director ──────────────────────────────────
export const dashboardSteps: TooltipStep[] = [
  {
    id: 'dashboard-tabs',
    title: 'Pestañas de Navegación',
    description:
      'Usá estas pestañas para alternar entre la vista individual de cada persona, las métricas generales de la organización y la vista de equipo.',
    icon: '✨',
  },
  {
    id: 'dashboard-filtros',
    title: 'Panel de Filtros',
    description:
      'Filtrá por período, área y persona. Podés buscar empleados por nombre y seleccionar el formulario (Líder o Analista) para enfocar tu análisis.',
    icon: '🔍',
  },
  {
    id: 'dashboard-cards',
    title: 'Tarjetas de Resumen',
    description:
      'Estas tarjetas muestran el promedio general, seniority esperado, seniority alcanzado y el estado (Cumple/No Cumple/Superó) de la persona seleccionada.',
    icon: '💡',
  },
  {
    id: 'dashboard-dumbbell',
    title: 'Gráfico de Brecha (Dumbbell)',
    description:
      'Este gráfico muestra la diferencia entre la autoevaluación y la evaluación del líder para cada skill. Cuanto más corta la barra, mayor alineación.',
    icon: '📏',
  },
  {
    id: 'dashboard-radar',
    title: 'Gráficos de Radar',
    description:
      'Cada pentágono superpone el valor esperado (gris), la autoevaluación (azul), la evaluación del jefe (naranja) y el promedio final (verde). Así identificas brechas rápidamente.',
    icon: '📊',
  },
  {
    id: 'dashboard-metricas',
    title: 'Métricas Generales',
    description:
      'Hacé clic en la pestaña "Métricas Generales" para ver indicadores agregados: distribución de seniority, brechas promedio, tendencias y bandas por área.',
    icon: '📈',
  },
];

// ─── Lider ──────────────────────────────────────────────
// Orden: top-to-bottom dentro de cada sub-vista
export const liderSteps: TooltipStep[] = [
  // — Global —
  {
    id: 'lider-tabs',
    title: 'Tu Panel de Líder',
    description:
      'Tenés dos vistas: "Mi Desempeño" para revisar tus propias evaluaciones y "Mi Equipo" para ver como va tu equipo. Cambia entre ellas con estos botones.',
    icon: '✨',
  },
  // — Mi Desempeño (top → bottom) —
  {
    id: 'lider-mi-desempeno',
    title: 'Mis Métricas',
    description:
      'Acá ves tu promedio general, seniority alcanzado y seniority esperado de un vistazo.',
    icon: '💡',
  },
  {
    id: 'lider-skills-badges',
    title: 'Análisis de Skills',
    description:
      'Estas tarjetas te muestran que skills mejoraron, cuales bajaron y cuales mantuviste respecto al trimestre anterior. Usalo para enfocar tu desarrollo.',
    icon: '🏷️',
  },
  {
    id: 'lider-evolucion',
    title: 'Evolución por Trimestre',
    description:
      'Este gráfico de líneas compara tus puntajes del trimestre anterior vs el actual skill por skill para ver tu progreso.',
    icon: '📈',
  },
  {
    id: 'lider-radar',
    title: 'Mis Competencias (Radar)',
    description:
      'Los gráficos de radar muestran tus Hard y Soft Skills. Podés alternar entre una vista compacta y otra detallada con el botón "Ver detalle".',
    icon: '📊',
  },
  // — Mi Equipo (top → bottom) —
  {
    id: 'lider-equipo-filtros',
    title: 'Filtros de Equipo',
    description:
      'Filtrá por persona o período. Podés elegir períodos predefinidos o un rango de fechas personalizado para acotar los resultados.',
    icon: '🔍',
  },
  {
    id: 'lider-equipo-scatter',
    title: 'Bandas de Seniority',
    description:
      'El scatter chart compara el puntaje del Q anterior (eje X) vs el actual (eje Y). Las bandas de color indican las zonas de seniority. Puntos arriba de la diagonal están mejorando.',
    icon: '📈',
  },
  {
    id: 'lider-equipo-tabla',
    title: 'Tabla de Equipo',
    description:
      'La tabla lista a cada miembro con sus promedios auto, jefe, final y la brecha (gap). Hacé clic en una fila para ver el detalle de skills de esa persona.',
    icon: '👥',
  },
];

// ─── Analista ───────────────────────────────────────────
export const analistaSteps: TooltipStep[] = [
  {
    id: 'analista-tarjetas',
    title: 'Tarjetas de Resumen',
    description:
      'Estas cuatro tarjetas muestran tu autopuntuación, la evaluación de tu líder, el promedio final y el seniority que alcanzaste.',
    icon: '💡',
  },
  {
    id: 'analista-radar',
    title: 'Mis Competencias',
    description:
      'Los gráficos de radar muestran tus Hard y Soft Skills. Podés cambiar a la vista detallada para ver por separado la autoevaluación y la de tu jefe.',
    icon: '📊',
  },
  {
    id: 'analista-evolucion',
    title: 'Mi Evolución',
    description:
      'El gráfico de líneas muestra como cambió tu puntaje en los últimos meses. La línea de referencia indica la meta de seniority para tu rol.',
    icon: '📈',
  },
  {
    id: 'analista-fortalezas',
    title: 'Fortalezas y Oportunidades',
    description:
      'Tus top 5 fortalezas (skills que superan lo esperado) y las 5 áreas de mejora (skills por debajo del objetivo). Usalas para planificar tu desarrollo.',
    icon: '🎯',
  },
  {
    id: 'analista-feedback',
    title: 'Feedback de tu Líder',
    description:
      'Los comentarios que tu líder dejó sobre tus skills. Cada uno incluye la skill, fecha, puntaje y la observación.',
    icon: '💬',
  },
];
