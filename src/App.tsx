// src/App.tsx
import { useApp } from './context/AppContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MetricasLider from './components/MetricasLider';
import MetricasAnalista from './components/MetricasAnalista';
import { DashboardSkeleton, LiderSkeleton, AnalistaSkeleton } from './components/LoadingSkeleton';
import ErrorBanner from './components/ErrorBanner';

function App() {
  const { currentUser, users, evaluations, skillsMatrix, loading, error, refetch } = useApp();

  if (!currentUser) {
    return <Login />;
  }

  // Loading skeleton después de login (cargando datos del API)
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white shadow-sm border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="animate-pulse flex justify-between items-center">
              <div>
                <div className="h-6 w-40 bg-stone-200 rounded-lg mb-2" />
                <div className="h-4 w-56 bg-stone-200 rounded-lg" />
              </div>
              <div className="h-10 w-32 bg-stone-200 rounded-xl" />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {currentUser.rol === 'Lider' ? <LiderSkeleton /> :
           currentUser.rol === 'Analista' ? <AnalistaSkeleton /> :
           <DashboardSkeleton />}
        </main>
      </div>
    );
  }

  // Error de conexión con botón de reintentar
  if (error) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white shadow-sm border-b border-stone-100">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard RRHH</h1>
            <p className="text-sm text-stone-500">{currentUser.nombre} · {currentUser.rol}</p>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <ErrorBanner message={error} onRetry={refetch} />
        </main>
      </div>
    );
  }

  // Ruteo basado en rol
  if (currentUser.rol === 'Lider') {
    return (
      <MetricasLider 
        evaluations={evaluations}
        users={users}
        skillsMatrix={skillsMatrix}
        currentUser={currentUser}
      />
    );
  }

  if (currentUser.rol === 'Analista') {
    return (
      <MetricasAnalista
        evaluations={evaluations}
        skillsMatrix={skillsMatrix}
        currentUser={currentUser}
      />
    );
  }

  // Director y RRHH ven Dashboard completo
  return <Dashboard />;
}

export default App;
