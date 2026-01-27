// src/App.tsx
import { useApp } from './context/AppContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MetricasLider from './components/MetricasLider';
import MetricasAnalista from './components/MetricasAnalista';

function App() {
  const { currentUser, users, evaluations, skillsMatrix } = useApp();

  if (!currentUser) {
    return <Login />;
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
