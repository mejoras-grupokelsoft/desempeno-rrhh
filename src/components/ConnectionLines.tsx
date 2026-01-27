import React from 'react';

interface ConnectionLinesProps {
  data: Array<{
    persona: string;
    q1Score: number;
    q2Score: number;
    saltoNivel: boolean;
  }>;
  xAxisMap: any;
  yAxisMap: any;
  color: string;
}

/**
 * Componente customizado para Recharts que dibuja líneas verticales
 * conectando puntos Q1 con Q2, usando correctamente el sistema de coordenadas del gráfico.
 * Esto crea el efecto de "mancuernas flotantes" o "cohetes despegando".
 */
export const ConnectionLines: React.FC<ConnectionLinesProps> = ({ 
  data, 
  xAxisMap, 
  yAxisMap, 
  color 
}) => {
  // Obtener las escalas de los ejes
  const xAxis = xAxisMap?.[0];
  const yAxis = yAxisMap?.[0];
  
  if (!xAxis || !yAxis) return null;

  return (
    <g className="connection-lines">
      {data.map((entry, index) => {
        // Calcular posiciones usando las escalas de Recharts
        const xPos = xAxis.scale(index) + (xAxis.scale.bandwidth?.() || 0) / 2;
        const y1Pos = yAxis.scale(entry.q1Score);
        const y2Pos = yAxis.scale(entry.q2Score);
        
        const crecimiento = entry.q2Score - entry.q1Score;
        const lineColor = crecimiento > 0 
          ? color 
          : crecimiento < 0 
            ? '#ef4444' 
            : '#94a3b8';
        const strokeWidth = Math.abs(crecimiento) > 0.5 ? 3 : 2;
        
        return (
          <line
            key={`connection-${index}`}
            x1={xPos}
            y1={y1Pos}
            x2={xPos}
            y2={y2Pos}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={entry.saltoNivel ? '5 5' : 'none'}
            opacity={0.7}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

export default ConnectionLines;
