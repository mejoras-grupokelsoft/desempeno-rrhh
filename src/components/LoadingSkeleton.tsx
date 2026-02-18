// src/components/LoadingSkeleton.tsx

/** Bloque de skeleton animado reutilizable */
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-200 rounded-lg ${className}`} />;
}

/** Skeleton para las cards de métricas (3 columnas) */
function MetricCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-stone-100 p-6">
          <SkeletonBlock className="h-4 w-32 mb-3" />
          <SkeletonBlock className="h-10 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton para un gráfico radar */
function RadarSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-6">
      <SkeletonBlock className="h-5 w-48 mb-6" />
      <div className="flex items-center justify-center" style={{ height: 400 }}>
        <div className="animate-pulse rounded-full border-4 border-stone-200" style={{ width: 280, height: 280 }} />
      </div>
      <div className="flex justify-center gap-6 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <SkeletonBlock className="h-3 w-3 rounded-full" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton para un gráfico de barras / evolución */
function ChartSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-8">
      <SkeletonBlock className="h-5 w-56 mb-2" />
      <SkeletonBlock className="h-3 w-72 mb-6" />
      <div className="flex items-end gap-3" style={{ height: 300 }}>
        {[40, 65, 50, 80, 35, 70, 55, 90, 45, 60].map((h, i) => (
          <SkeletonBlock key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Skeleton completo para el Dashboard (vista individual) */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filtros skeleton */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6">
        <SkeletonBlock className="h-5 w-20 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <SkeletonBlock className="h-3 w-16 mb-2" />
              <SkeletonBlock className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Métricas skeleton */}
      <MetricCardsSkeleton />

      {/* Gráficos skeleton */}
      <ChartSkeleton />
      <ChartSkeleton />

      {/* Radars skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RadarSkeleton />
        <RadarSkeleton />
      </div>
    </div>
  );
}

/** Skeleton para MetricasLider */
export function LiderSkeleton() {
  return (
    <div className="space-y-6">
      <MetricCardsSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-stone-100 p-4">
            <SkeletonBlock className="h-4 w-24 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <SkeletonBlock key={j} className="h-3 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <RadarSkeleton />
    </div>
  );
}

/** Skeleton para MetricasAnalista */
export function AnalistaSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-stone-100 p-5">
            <SkeletonBlock className="h-3 w-20 mb-3" />
            <SkeletonBlock className="h-8 w-16" />
          </div>
        ))}
      </div>
      <RadarSkeleton />
      <ChartSkeleton />
    </div>
  );
}

export default DashboardSkeleton;
