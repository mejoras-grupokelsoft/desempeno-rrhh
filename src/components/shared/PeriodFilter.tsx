// src/components/shared/PeriodFilter.tsx
import { PERIODOS, type PeriodoType } from '../../utils/dateUtils';

interface PeriodFilterProps {
  filtroModo: 'periodo' | 'rango';
  setFiltroModo: (mode: 'periodo' | 'rango') => void;
  selectedPeriodo: PeriodoType;
  setSelectedPeriodo: (periodo: PeriodoType) => void;
  fechaInicio: string;
  setFechaInicio: (date: string) => void;
  fechaFin: string;
  setFechaFin: (date: string) => void;
  /** Color accent: 'orange' (RRHH), 'blue' (Analista), 'purple' (Lider) */
  accentColor?: 'orange' | 'blue' | 'purple';
  compact?: boolean;
}

const ACCENT = {
  orange: {
    active: 'bg-orange-600 text-white shadow-md',
    inactive: 'bg-white text-stone-600 border border-stone-200 hover:border-orange-300',
    ring: 'focus:ring-orange-500',
    select: 'focus:ring-orange-500',
    tab: 'bg-white text-orange-700 shadow-sm',
  },
  blue: {
    active: 'bg-blue-600 text-white shadow-md',
    inactive: 'bg-white text-stone-600 border border-stone-200 hover:border-blue-300',
    ring: 'focus:ring-blue-500',
    select: 'focus:ring-blue-500',
    tab: 'bg-white text-blue-700 shadow-sm',
  },
  purple: {
    active: 'bg-purple-600 text-white shadow-md',
    inactive: 'bg-white text-stone-600 border border-stone-200 hover:border-purple-300',
    ring: 'focus:ring-purple-500',
    select: 'focus:ring-purple-500',
    tab: 'bg-white text-purple-700 shadow-sm',
  },
};

export default function PeriodFilter({
  filtroModo,
  setFiltroModo,
  selectedPeriodo,
  setSelectedPeriodo,
  fechaInicio,
  setFechaInicio,
  fechaFin,
  setFechaFin,
  accentColor = 'orange',
  compact = false,
}: PeriodFilterProps) {
  const colors = ACCENT[accentColor];

  if (compact) {
    // Usado dentro del header del Analista / Lider
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-stone-700">📅 Período:</span>
        <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
          <button
            onClick={() => setFiltroModo('periodo')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              filtroModo === 'periodo' ? colors.tab : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            📅 Períodos
          </button>
          <button
            onClick={() => setFiltroModo('rango')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              filtroModo === 'rango' ? colors.tab : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            📆 Rango
          </button>
        </div>
        {filtroModo === 'periodo' ? (
          <select
            value={selectedPeriodo}
            onChange={(e) => setSelectedPeriodo(e.target.value as PeriodoType)}
            className={`px-4 py-2 border border-stone-200 rounded-xl ${colors.ring} focus:border-transparent outline-none bg-white transition text-sm`}
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaInicio}
              max={fechaFin || undefined}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={`px-3 py-2 border border-stone-200 rounded-xl text-sm ${colors.ring} focus:border-transparent outline-none bg-white`}
            />
            <span className="text-stone-400 text-sm">a</span>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio || undefined}
              onChange={(e) => setFechaFin(e.target.value)}
              className={`px-3 py-2 border border-stone-200 rounded-xl text-sm ${colors.ring} focus:border-transparent outline-none bg-white`}
            />
          </div>
        )}
      </div>
    );
  }

  // Versión completa (usada en MetricasRRHH dentro del panel de filtros)
  return (
    <div className="col-span-full">
      <label className="block text-sm font-semibold text-stone-800 mb-3">Filtro Temporal</label>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFiltroModo('periodo')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            filtroModo === 'periodo' ? colors.active : colors.inactive
          }`}
        >
          📅 Periodos Predefinidos
        </button>
        <button
          onClick={() => setFiltroModo('rango')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            filtroModo === 'rango' ? colors.active : colors.inactive
          }`}
        >
          🗓️ Rango Personalizado
        </button>
      </div>

      {filtroModo === 'periodo' ? (
        <select
          value={selectedPeriodo}
          onChange={(e) => setSelectedPeriodo(e.target.value as PeriodoType)}
          className={`w-full px-4 py-2.5 border border-stone-200 rounded-xl ${colors.ring} focus:border-transparent outline-none bg-white transition`}
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={fechaInicio}
              max={fechaFin || undefined}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={`w-full px-4 py-2.5 border border-stone-200 rounded-xl ${colors.ring} focus:border-transparent outline-none bg-white transition`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio || undefined}
              onChange={(e) => setFechaFin(e.target.value)}
              className={`w-full px-4 py-2.5 border border-stone-200 rounded-xl ${colors.ring} focus:border-transparent outline-none bg-white transition`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
