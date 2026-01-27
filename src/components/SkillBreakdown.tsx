import React from 'react';
// @ts-ignore - TypeScript no detecta el uso en JSX
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SkillData {
  skill: string;
  scoreA: number;
  scoreB: number;
  cambio: number;
  skillTipo: 'HARD' | 'SOFT';
}

interface SkillBreakdownInlineProps {
  personaNombre: string;
  skills: SkillData[];
  periodoA: string;
  periodoB: string;
}

/**
 * Componente inline con desglose de skills por persona
 * Dos gráficos lado a lado: Hard Skills y Soft Skills
 */
export const SkillBreakdownInline: React.FC<SkillBreakdownInlineProps> = ({
  personaNombre,
  skills,
  periodoA,
  periodoB
}) => {
  // Separar por tipo
  const hardSkills = skills.filter(s => s.skillTipo === 'HARD');
  const softSkills = skills.filter(s => s.skillTipo === 'SOFT');

  const renderSkillChart = (data: SkillData[], titulo: string, colorA: string, colorB: string, isHard: boolean) => {
    // Verificar si hay datos del período anterior
    const hayPeriodoAnterior = data.some(s => s.scoreA > 0);
    
    const iconSVG = isHard ? (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
    
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 transition-all hover:shadow-md">
        <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          {iconSVG}
          {titulo}
        </h4>
        {data.length === 0 ? (
          <p className="text-stone-500 italic text-center py-8">No hay datos para este período</p>
        ) : (
        <>
          <div className="mb-2 text-xs text-stone-600">
            Mostrando {data.length} skills (valores de 0 a 5)
          </div>
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={index}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-48 text-xs font-semibold text-slate-700" title={item.skill}>
                    {item.skill}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    {/* Barra Anterior (gris semi-transparente) */}
                    {hayPeriodoAnterior && (
                      <div className="flex-1 bg-stone-100 rounded-full h-5 relative overflow-hidden">
                        <div 
                          className="h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold transition-all"
                          style={{ 
                            width: `${(item.scoreA / 5) * 100}%`,
                            backgroundColor: colorA,
                            opacity: 0.6,
                            color: '#475569'
                          }}
                        >
                          {item.scoreA > 0 && item.scoreA.toFixed(1)}
                        </div>
                      </div>
                    )}
                    {/* Barra Actual (color sólido) */}
                    <div className="flex-1 bg-stone-100 rounded-full h-5 relative overflow-hidden">
                      <div 
                        className="h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold text-white transition-all"
                        style={{ 
                          width: `${(item.scoreB / 5) * 100}%`,
                          backgroundColor: colorB
                        }}
                      >
                        {item.scoreB > 0 && item.scoreB.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {hayPeriodoAnterior && (
                      <span className="font-semibold text-stone-500">{item.scoreA.toFixed(1)}</span>
                    )}
                    <span className="font-bold" style={{ color: colorB }}>
                      {item.scoreB.toFixed(1)}
                    </span>
                    {item.cambio !== 0 && (
                      <span className={`font-bold ${item.cambio > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.cambio > 0 ? '+' : ''}{item.cambio.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Leyenda */}
          <div className="mt-4 pt-3 border-t border-stone-200 flex gap-4 text-xs">
            {hayPeriodoAnterior && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: colorA, opacity: 0.6 }}></div>
                <span className="text-stone-600">Anterior</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: colorB }}></div>
              <span className="text-stone-600">Actual</span>
            </div>
          </div>
        
      </>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-4 mt-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl shadow-sm border border-orange-200 p-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div>
            <h3 className="text-lg font-bold text-white">
              📊 Desglose de Skills - {personaNombre}
            </h3>
            <p className="text-orange-100 text-xs">
              Comparando {periodoA} vs {periodoB}
            </p>
          </div>
        </div>
      </div>

      {/* Dos gráficos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderSkillChart(hardSkills, 'Hard Skills', '#94a3b8', '#3b82f6', true)}
        {renderSkillChart(softSkills, 'Soft Skills', '#fdba74', '#f97316', false)}
      </div>
    </div>
  );
};
