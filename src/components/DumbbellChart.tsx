// src/components/DumbbellChart.tsx
import { useState } from 'react';

export interface DumbbellDataPoint {
  skill: string;
  autoAnterior: number;
  jefeAnterior: number;
  autoActual: number;
  jefeActual: number;
  esperado: number;
}

interface DumbbellChartProps {
  data: DumbbellDataPoint[];
  title?: string;
}

const SCALE_MAX = 5;

const COLORS = {
  auto: '#1e40af',
  jefe: '#0891b2',
  esperado: '#a8a29e',
  gapAnterior: '#d6d3d1',
  gapActual: '#ef4444',
};

export default function DumbbellChart({ data, title }: DumbbellChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  // Ordenar por brecha actual (mayor diferencia primero)
  const sorted = [...data].sort(
    (a, b) => Math.abs(b.autoActual - b.jefeActual) - Math.abs(a.autoActual - a.jefeActual)
  );

  const toPercent = (val: number) => (val / SCALE_MAX) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md mb-8">
      {title && (
        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
      )}
      <p className="text-xs text-stone-500 mb-5">
        Brecha auto vs lider por skill. Fila superior: Q anterior (desvanecido). Fila inferior: Q actual (solido).
      </p>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mb-5 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.auto }} />
          <span className="text-stone-700">Autoevaluacion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.jefe }} />
          <span className="text-stone-700">Evaluacion Lider</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent" style={{ borderBottomColor: COLORS.esperado }} />
          <span className="text-stone-700">Esperado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-[3px] rounded" style={{ backgroundColor: COLORS.gapAnterior }} />
          <span className="text-stone-700">Q Anterior</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-[3px] rounded" style={{ backgroundColor: COLORS.gapActual }} />
          <span className="text-stone-700">Q Actual</span>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-0">
        {/* Scale header */}
        <div className="flex items-center h-6">
          <div className="w-[140px] flex-shrink-0" />
          <div className="flex-1 relative">
            <div className="flex justify-between text-[10px] text-stone-400 font-medium px-0">
              {[0, 1, 2, 3, 4, 5].map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </div>
          <div className="w-[60px] flex-shrink-0" />
        </div>

        {sorted.map((point, idx) => {
          const gapAnterior = Math.abs(point.autoAnterior - point.jefeAnterior);
          const gapActual = Math.abs(point.autoActual - point.jefeActual);
          const hasAnterior = point.autoAnterior > 0 || point.jefeAnterior > 0;
          const hasActual = point.autoActual > 0 || point.jefeActual > 0;
          const isHovered = hoveredIdx === idx;

          // Gap change indicator
          const gapChange = hasAnterior && hasActual ? gapActual - gapAnterior : null;

          return (
            <div
              key={point.skill}
              className={`rounded-lg transition-all cursor-default ${
                isHovered ? 'bg-stone-50' : ''
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-start">
                {/* Skill name */}
                <div
                  className="w-[140px] flex-shrink-0 text-xs font-medium text-stone-700 pr-3 truncate text-right pt-3"
                  title={point.skill}
                >
                  {point.skill}
                </div>

                {/* Dual track container */}
                <div className="flex-1 py-1">
                  {/* Q Anterior row (faded) */}
                  <div className="relative h-5">
                    {/* Background track */}
                    <div className="absolute inset-y-[8px] left-0 right-0 bg-stone-50 h-[3px]" />

                    {/* Grid lines */}
                    {[1, 2, 3, 4].map((tick) => (
                      <div
                        key={tick}
                        className="absolute top-0 bottom-0 w-px bg-stone-100"
                        style={{ left: `${toPercent(tick)}%` }}
                      />
                    ))}

                    {hasAnterior && (
                      <>
                        {/* Connecting line Q anterior */}
                        {point.autoAnterior > 0 && point.jefeAnterior > 0 && (
                          <div
                            className="absolute top-[7px] h-[5px] rounded-full"
                            style={{
                              left: `${toPercent(Math.min(point.autoAnterior, point.jefeAnterior))}%`,
                              width: `${toPercent(gapAnterior)}%`,
                              backgroundColor: COLORS.gapAnterior,
                            }}
                          />
                        )}

                        {/* Auto dot Q anterior (hollow) */}
                        {point.autoAnterior > 0 && (
                          <div
                            className="absolute top-[4px] w-[10px] h-[10px] rounded-full border-2 bg-white"
                            style={{
                              left: `${toPercent(point.autoAnterior)}%`,
                              transform: 'translateX(-50%)',
                              borderColor: COLORS.auto,
                              opacity: 0.4,
                            }}
                          />
                        )}

                        {/* Jefe dot Q anterior (hollow) */}
                        {point.jefeAnterior > 0 && (
                          <div
                            className="absolute top-[4px] w-[10px] h-[10px] rounded-full border-2 bg-white"
                            style={{
                              left: `${toPercent(point.jefeAnterior)}%`,
                              transform: 'translateX(-50%)',
                              borderColor: COLORS.jefe,
                              opacity: 0.4,
                            }}
                          />
                        )}
                      </>
                    )}

                    {!hasAnterior && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] text-stone-300">sin datos Q anterior</span>
                      </div>
                    )}
                  </div>

                  {/* Q Actual row (solid) */}
                  <div className="relative h-5">
                    {/* Background track */}
                    <div className="absolute inset-y-[8px] left-0 right-0 bg-stone-100 h-[3px]" />

                    {/* Grid lines */}
                    {[1, 2, 3, 4].map((tick) => (
                      <div
                        key={tick}
                        className="absolute top-0 bottom-0 w-px bg-stone-200"
                        style={{ left: `${toPercent(tick)}%` }}
                      />
                    ))}

                    {/* Esperado marker */}
                    {point.esperado > 0 && (
                      <div
                        className="absolute top-[1px]"
                        style={{ left: `${toPercent(point.esperado)}%`, transform: 'translateX(-50%)' }}
                      >
                        <div
                          className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent"
                          style={{ borderTopColor: COLORS.esperado }}
                        />
                      </div>
                    )}

                    {hasActual && (
                      <>
                        {/* Connecting line Q actual */}
                        {point.autoActual > 0 && point.jefeActual > 0 && (
                          <div
                            className="absolute top-[7px] h-[5px] rounded-full opacity-40"
                            style={{
                              left: `${toPercent(Math.min(point.autoActual, point.jefeActual))}%`,
                              width: `${toPercent(gapActual)}%`,
                              backgroundColor: gapActual > 0.5 ? COLORS.gapActual : '#a8a29e',
                            }}
                          />
                        )}

                        {/* Auto dot Q actual (solid) */}
                        {point.autoActual > 0 && (
                          <div
                            className="absolute top-[4px] w-[11px] h-[11px] rounded-full border-2 border-white shadow-sm"
                            style={{
                              left: `${toPercent(point.autoActual)}%`,
                              transform: 'translateX(-50%)',
                              backgroundColor: COLORS.auto,
                            }}
                          />
                        )}

                        {/* Jefe dot Q actual (solid) */}
                        {point.jefeActual > 0 && (
                          <div
                            className="absolute top-[4px] w-[11px] h-[11px] rounded-full border-2 border-white shadow-sm"
                            style={{
                              left: `${toPercent(point.jefeActual)}%`,
                              transform: 'translateX(-50%)',
                              backgroundColor: COLORS.jefe,
                            }}
                          />
                        )}
                      </>
                    )}

                    {!hasActual && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] text-stone-300">sin datos Q actual</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gap change indicator */}
                <div className="w-[60px] flex-shrink-0 text-right pl-2 pt-2">
                  {gapChange !== null ? (
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-bold ${
                        gapChange < -0.1 ? 'text-green-600' : gapChange > 0.1 ? 'text-red-500' : 'text-stone-400'
                      }`}>
                        {gapChange < -0.1 ? 'Cerro' : gapChange > 0.1 ? 'Abrio' : 'Igual'}
                      </span>
                      <span className={`text-[10px] font-medium ${
                        gapChange < -0.1 ? 'text-green-500' : gapChange > 0.1 ? 'text-red-400' : 'text-stone-300'
                      }`}>
                        {gapActual.toFixed(1)}
                      </span>
                    </div>
                  ) : hasActual ? (
                    <span className={`text-[10px] font-bold ${
                      gapActual > 1 ? 'text-red-500' : gapActual > 0.5 ? 'text-amber-500' : 'text-green-600'
                    }`}>
                      {gapActual.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-300">-</span>
                  )}
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-stone-100 mx-2" />
            </div>
          );
        })}
      </div>

      {/* Tooltip on hover */}
      {hoveredIdx !== null && sorted[hoveredIdx] && (() => {
        const p = sorted[hoveredIdx];
        return (
          <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
            <p className="font-bold text-slate-900 mb-2">{p.skill}</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {/* Q Anterior */}
              <div>
                <p className="text-[10px] font-semibold text-stone-400 mb-1">Q ANTERIOR</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full border-2 bg-white" style={{ borderColor: COLORS.auto, opacity: 0.6 }} />
                    <span className="text-stone-600">Auto:</span>
                    <span className="font-bold" style={{ color: COLORS.auto }}>
                      {p.autoAnterior > 0 ? p.autoAnterior.toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full border-2 bg-white" style={{ borderColor: COLORS.jefe, opacity: 0.6 }} />
                    <span className="text-stone-600">Lider:</span>
                    <span className="font-bold" style={{ color: COLORS.jefe }}>
                      {p.jefeAnterior > 0 ? p.jefeAnterior.toFixed(2) : '-'}
                    </span>
                  </div>
                </div>
              </div>
              {/* Q Actual */}
              <div>
                <p className="text-[10px] font-semibold text-stone-700 mb-1">Q ACTUAL</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.auto }} />
                    <span className="text-stone-600">Auto:</span>
                    <span className="font-bold" style={{ color: COLORS.auto }}>
                      {p.autoActual > 0 ? p.autoActual.toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.jefe }} />
                    <span className="text-stone-600">Lider:</span>
                    <span className="font-bold" style={{ color: COLORS.jefe }}>
                      {p.jefeActual > 0 ? p.jefeActual.toFixed(2) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {p.esperado > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-200 flex items-center gap-2">
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent" style={{ borderBottomColor: COLORS.esperado }} />
                <span className="text-stone-600">Esperado:</span>
                <span className="font-bold" style={{ color: COLORS.esperado }}>{p.esperado.toFixed(2)}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
