// src/components/forms/EvaluationFormLider.tsx
import { useState } from 'react';
import { insertEvaluation, insertBatchResponses } from '../../lib/supabaseQueries';
import { useApp } from '../../context/AppContext';
import DynamicEvaluationForm from './DynamicEvaluationForm';
import type { User } from '../../types';

interface EvaluationFormLiderProps {
  /** Si se pasa, se usa esta lista en lugar de filtrar por área */
  eligibleMembers?: User[];
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onMemberSelected?: (member: User | null) => void;
}

export default function EvaluationFormLider({ eligibleMembers, onSuccess, onError, onMemberSelected }: EvaluationFormLiderProps) {
  const { currentUser, users, currentPeriodo } = useApp();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  if (!currentUser) {
    return <div className="p-4 bg-red-50 text-red-700 rounded">Debes iniciar sesión</div>;
  }

  // Si se pasan miembros explícitos (desde teams), usarlos.
  // Fallback: filtrar por área/rol como antes.
  const getEligibleEmployees = (): User[] => {
    // Siempre excluir al evaluador de la lista (no puede evaluarse a sí mismo aquí)
    const exclude = (u: User) => u.email !== currentUser.email;
    if (eligibleMembers && eligibleMembers.length > 0) return eligibleMembers.filter(exclude);
    if (currentUser.rol === 'RRHH' || currentUser.rol === 'Director') {
      return users.filter(exclude);
    }
    return users.filter(u => u.area === currentUser.area && exclude(u));
  };

  const handleEmployeeSelect = (email: string) => {
    setSelectedEmployeeEmail(email);
    const employee = email
      ? (users.find(u => u.email === email) || eligibleMembers?.find(u => u.email === email) || null)
      : null;
    setSelectedEmployee(employee);
    onMemberSelected?.(employee);
  };

  const handleSubmit = async (respuestas: Record<string, 1 | 2 | 3 | 4>, comentarios: string) => {
    if (!selectedEmployee) {
      onError?.('Debes seleccionar un empleado');
      return;
    }

    try {
      setSuccessMessage('');

      const evaluation = await insertEvaluation({
        periodo: currentPeriodo,
        evaluado_email: selectedEmployee.email,
        evaluado_nombre: selectedEmployee.nombre,
        evaluador_email: currentUser.email,
        tipo_evaluador: 'JEFE',
        skill_nombre: 'general',
        skill_tipo: 'SOFT',
        puntaje: 1,
        area: selectedEmployee.area || 'Sin área',
        comentario: comentarios || undefined,
      });

      const responsesData = Object.entries(respuestas).map(([preguntaId, puntaje]) => ({
        evaluation_id: evaluation.id,
        pregunta_id: preguntaId,
        puntaje: puntaje as 1 | 2 | 3 | 4,
      }));

      await insertBatchResponses(responsesData);

      setSuccessMessage(`✓ Evaluación de ${selectedEmployee.nombre} guardada exitosamente`);
      setSelectedEmployeeEmail('');
      setSelectedEmployee(null);
      onSuccess?.();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error guardando evaluación';
      onError?.(message);
    }
  };

  const eligibleEmployees = getEligibleEmployees();

  return (
    <div className="w-full">
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 font-semibold">
          {successMessage}
        </div>
      )}

      {!selectedEmployee ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Seleccioná a quién querés evaluar:
          </p>
          {eligibleEmployees.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              No hay miembros de equipo para evaluar en este período.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {eligibleEmployees.map(emp => (
                <button
                  key={emp.email}
                  onClick={() => handleEmployeeSelect(emp.email)}
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-400 hover:shadow-md transition-all text-left"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-700 font-bold text-sm">
                      {emp.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{emp.nombre}</p>
                    <p className="text-xs text-gray-500">{emp.area || 'Sin área'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => { setSelectedEmployee(null); setSelectedEmployeeEmail(''); }}
            className="mb-4 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            ← Cambiar persona
          </button>
          <DynamicEvaluationForm
            evaluado={selectedEmployee}
            tipoEvaluador="JEFE"
            areaId={selectedEmployee.area_id || null}
            rolObjetivo={selectedEmployee.rol === 'Lider' ? 'LIDER' : 'ANALISTA'}
            onSubmit={handleSubmit}
            onCancel={() => { setSelectedEmployee(null); setSelectedEmployeeEmail(''); }}
          />
        </div>
      )}
    </div>
  );
}

