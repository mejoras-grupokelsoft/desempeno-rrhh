// src/components/RadarChart.tsx
import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { RadarDataPoint } from '../types';

interface RadarChartProps {
  data: RadarDataPoint[];
  title?: string;
  onClick?: () => void;
}

// Custom Tooltip mejorado
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const skill = payload[0].payload.skill;
  
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border-2 border-stone-200 p-4 min-w-[200px]">
      <p className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b-2 border-stone-200">
        {skill}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any) => {
          const colors: Record<string, string> = {
            'Seniority Esperado': 'text-stone-500',
            'Autoevaluación': 'text-blue-700',
            'Evaluación Líder': 'text-cyan-600',
            'Promedio Final': 'text-red-600'
          };
          
          return (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs font-medium text-stone-700">
                  {entry.name}
                </span>
              </div>
              <span className={`text-sm font-bold ${colors[entry.name] || 'text-slate-900'}`}>
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Custom tick para wrapping de texto
const CustomTick = (props: any) => {
  const { x, y, payload } = props;
  const words = payload.value.split(' ');
  
  // Si es muy largo, dividir en 2 líneas
  if (payload.value.length > 20) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    
    return (
      <text x={x} y={y} textAnchor="middle" fill="#57534e" fontSize="11" fontWeight="600">
        <tspan x={x} dy="-8">{line1}</tspan>
        <tspan x={x} dy="14">{line2}</tspan>
      </text>
    );
  }
  
  return (
    <text x={x} y={y} textAnchor="middle" fill="#57534e" fontSize="12" fontWeight="600">
      {payload.value}
    </text>
  );
};

export default function RadarChartComponent({ data, title, onClick }: RadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
        <p className="text-stone-500 text-center">No hay datos para mostrar</p>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md group relative"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {onClick && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Click para ver detalle
          </div>
        </div>
      )}
      {title && (
        <h3 className="text-lg font-bold text-slate-900 mb-6">
          {title}
        </h3>
      )}

      <ResponsiveContainer width="100%" height={600}>
        <RechartsRadar data={data}>
          <PolarGrid stroke="#e7e5e4" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="skill"
            tick={<CustomTick />}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fill: '#78716c', fontSize: 11 }}
          />

          {/* Pentágono Esperado (Target) - Stone punteado */}
          <Radar
            name="Seniority Esperado"
            dataKey="esperado"
            stroke="#d6d3d1"
            fill="transparent"
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          {/* Pentágono Autoevaluación - Azul más oscuro para mejor contraste */}
          <Radar
            name="Autoevaluación"
            dataKey="auto"
            stroke="#1e40af"
            fill="#3b82f6"
            fillOpacity={0.20}
            strokeWidth={2}
          />

          {/* Pentágono Evaluación Líder - Verde azulado para diferenciación */}
          <Radar
            name="Evaluación Líder"
            dataKey="jefe"
            stroke="#0891b2"
            fill="#06b6d4"
            fillOpacity={0.25}
            strokeWidth={2}
          />

          {/* Pentágono Promedio - Orange vibrante para resaltar */}
          <Radar
            name="Promedio Final"
            dataKey="promedio"
            stroke="#dc2626"
            fill="#ef4444"
            fillOpacity={0.15}
            strokeWidth={3}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
            }}
            iconType="circle"
            formatter={(value) => <span className="text-sm font-medium text-stone-700">{value}</span>}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}
