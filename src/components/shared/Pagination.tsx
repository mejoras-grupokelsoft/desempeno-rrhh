// src/components/shared/Pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  accentColor?: 'orange' | 'blue' | 'purple';
}

const ACCENT_ACTIVE: Record<string, string> = {
  orange: 'bg-orange-500 text-white',
  blue: 'bg-blue-500 text-white',
  purple: 'bg-purple-500 text-white',
};

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  accentColor = 'orange',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const firstItem = (currentPage - 1) * itemsPerPage + 1;
  const lastItem = Math.min(currentPage * itemsPerPage, totalItems);
  const activeClass = ACCENT_ACTIVE[accentColor] ?? ACCENT_ACTIVE.orange;

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-200">
      <div className="text-sm text-stone-600">
        Mostrando {firstItem} - {lastItem} de {totalItems} resultados
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 font-semibold text-sm hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Anterior
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-10 h-10 rounded-lg font-semibold text-sm transition ${
                currentPage === page
                  ? activeClass
                  : 'border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-2 rounded-lg border border-stone-200 text-stone-700 font-semibold text-sm hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
