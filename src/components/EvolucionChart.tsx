// src/components/EvolucionChart.tsx
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import type { EvolucionDataPoint } from '../types';

interface EvolucionChartProps {
  data: EvolucionDataPoint[];
  title?: string;
}

const SENIORITY_BANDS = [
  { y1: 0, y2: 1, fill: '#fef2f2', label: 'Trainee', color: '#dc2626' },
  { y1: 1, y2: 2, fill: '#fefce8', label: 'Junior', color: '#ca8a04' },
  { y1: 2, y2: 3, fill: '#eff6ff', label: 'Semi Senior', color: '#2563eb' },
  { y1: 3, y2: 4, fill: '#f0fdf4', label: 'Senior', color: '#16a34a' },
];

const LINE_CONFIG = {
  esperado: { name: 'Seniority', color: '#78716c', dash: '6 3', width: 2.5 },
  auto: { name: 'Autoevaluación', color: '#1e40af', dash: undefined, width: 2 },
  jefe: { name: 'Evaluación Líder', color: '#0891b2', dash: undefined, width: 2 },
  promedio: { name: 'Promedio Final', color: '#dc2626', dash: undefined, width: 3 },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border-2 border-stone-200 p-4 min-w-[200px]">
      <p className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b-2 border-stone-200">
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any) => {
          if (entry.value === 0) return null;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs font-medium text-stone-700">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold" style={{ color: entry.color }}>
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Custom label para las bandas de seniority (renderizado en el margen derecho)
const BandLabel = ({ viewBox, label, color }: any) => {
  if (!viewBox) return null;
  const { y, height } = viewBox;
  return (
    <text
      x="98%"
      y={y + height / 2}
      textAnchor="end"
      fill={color}
      fontSize={11}
      fontWeight={600}
      opacity={0.7}
    >
      {label}
    </text>
  );
};

export default function EvolucionChart({ data, title }: EvolucionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 text-center mb-8">
        {title && <h3 className="text-lg font-bold text-slate-900 mb-4">{title}</h3>}
        <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-stone-500 text-sm font-medium">Sin datos de evoluci\u00f3n</p>
        <p className="text-stone-400 text-xs mt-1">Se necesitan evaluaciones en distintos trimestres</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 sm:p-6 transition-all hover:shadow-md mb-8">
      {title && (
        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
          {title}
        </h3>
      )}
      <p className="text-xs text-stone-500 mb-6">
        Evolucion del desempeno por trimestre con bandas de nivel de seniority
      </p>

      <ResponsiveContainer width="100%" height={400} minHeight={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 60, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />

          {/* Bandas de seniority como fondo */}
          {SENIORITY_BANDS.map((band) => (
            <ReferenceArea
              key={band.label}
              y1={band.y1}
              y2={band.y2}
              fill={band.fill}
              fillOpacity={1}
              label={<BandLabel label={band.label} color={band.color} />}
            />
          ))}

          <XAxis
            dataKey="trimestre"
            tick={{ fill: '#57534e', fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: '#d6d3d1' }}
          />
          <YAxis
            domain={[0, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: '#78716c', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#d6d3d1' }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            iconType="circle"
            formatter={(value: string) => (
              <span className="text-sm font-medium text-stone-700">{value}</span>
            )}
          />

          {/* Línea de Esperado - gris punteada */}
          <Line
            type="monotone"
            dataKey="esperado"
            name={LINE_CONFIG.esperado.name}
            stroke={LINE_CONFIG.esperado.color}
            strokeWidth={LINE_CONFIG.esperado.width}
            strokeDasharray={LINE_CONFIG.esperado.dash}
            dot={false}
            activeDot={{ r: 4 }}
          />

          {/* Línea de Autoevaluación - azul */}
          <Line
            type="monotone"
            dataKey="auto"
            name={LINE_CONFIG.auto.name}
            stroke={LINE_CONFIG.auto.color}
            strokeWidth={LINE_CONFIG.auto.width}
            dot={{ r: 4, fill: LINE_CONFIG.auto.color, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />

          {/* Línea de Evaluación Líder - cyan */}
          <Line
            type="monotone"
            dataKey="jefe"
            name={LINE_CONFIG.jefe.name}
            stroke={LINE_CONFIG.jefe.color}
            strokeWidth={LINE_CONFIG.jefe.width}
            dot={{ r: 4, fill: LINE_CONFIG.jefe.color, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />

          {/* Línea de Promedio - roja, más gruesa */}
          <Line
            type="monotone"
            dataKey="promedio"
            name={LINE_CONFIG.promedio.name}
            stroke={LINE_CONFIG.promedio.color}
            strokeWidth={LINE_CONFIG.promedio.width}
            dot={{ r: 5, fill: LINE_CONFIG.promedio.color, strokeWidth: 0 }}
            activeDot={{ r: 7 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
