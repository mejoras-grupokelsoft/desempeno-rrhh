import React from 'react';

interface DumbbellLineProps {
  x: number;
  y1: number;
  y2: number;
  color: string;
  strokeWidth: number;
  isDashed: boolean;
}

/**
 * Componente que dibuja una línea vertical "mancuerna" flotante
 * conectando dos puntos (Q1 y Q2) sin tocar el eje X.
 * Esto crea el efecto visual de "cápsulas" o "cohetes" suspendidos.
 */
export const DumbbellLine: React.FC<DumbbellLineProps> = ({ 
  x, 
  y1, 
  y2, 
  color, 
  strokeWidth, 
  isDashed 
}) => {
  return (
    <line
      x1={x}
      y1={y1}
      x2={x}
      y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={isDashed ? '5 5' : 'none'}
      opacity={0.7}
      strokeLinecap="round"
    />
  );
};

export default DumbbellLine;
