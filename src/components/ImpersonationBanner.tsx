// src/components/ImpersonationBanner.tsx
import { useApp } from '../context/AppContext';

export default function ImpersonationBanner() {
  const { currentUser, realUser, isImpersonating, stopImpersonation } = useApp();

  if (!isImpersonating || !currentUser) return null;

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold shadow-md">
      <span>
        🎭 Viendo la app como <strong>{currentUser.nombre}</strong>
        {' '}({currentUser.rol}{currentUser.puesto ? ` · ${currentUser.puesto}` : ''})
        {realUser && <> — impersonado por {realUser.nombre}</>}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-100 text-xs font-bold">
        Solo lectura: no se pueden guardar evaluaciones
      </span>
      <button
        onClick={stopImpersonation}
        className="px-3 py-1 rounded-lg bg-white text-amber-800 hover:bg-amber-50 transition-colors font-bold"
      >
        ✕ Salir
      </button>
    </div>
  );
}
