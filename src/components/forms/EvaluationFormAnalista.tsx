// src/components/forms/EvaluationFormAnalista.tsx
import { useState } from 'react';
import { insertEvaluation, insertBatchResponses } from '../../lib/supabaseQueries';
import { useApp } from '../../context/AppContext';
import DynamicEvaluationForm from './DynamicEvaluationForm';

interface EvaluationFormAnalistaProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function EvaluationFormAnalista({ onSuccess, onError }: EvaluationFormAnalistaProps) {
  const { currentUser, currentPeriodo } = useApp();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!currentUser) {
    return <div className="p-4 bg-red-50 text-red-700 rounded">Debes iniciar sesión</div>;
  }

  const handleSubmit = async (respuestas: Record<string, 1 | 2 | 3 | 4>, comentarios: string) => {
    try {
      setSuccessMessage('');
      
      // 1. Crear evaluación principal
      const evaluation = await insertEvaluation({
        periodo: currentPeriodo,
        evaluado_email: currentUser.email,
        evaluado_nombre: currentUser.nombre,
        evaluador_email: currentUser.email, // Autoevaluación
        tipo_evaluador: 'AUTO',
        skill_nombre: 'general', // Placeholder - las respuestas específicas están en responses
        skill_tipo: 'SOFT',
        puntaje: 1, // Placeholder - el puntaje real está en responses
        area: currentUser.area || 'Sin área',
        comentario: comentarios || undefined,
      });

      // 2. Guardar respuestas por cada pregunta
      const responsesData = Object.entries(respuestas).map(([preguntaId, puntaje]) => ({
        evaluation_id: evaluation.id,
        pregunta_id: preguntaId,
        puntaje: puntaje as 1 | 2 | 3 | 4,
      }));

      await insertBatchResponses(responsesData);
      
      setSuccessMessage('✓ Autoevaluación guardada exitosamente');
      onSuccess?.();
      
      // Limpiar después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error guardando evaluación';
      onError?.(message);
    }
  };

  return (
    <div className="w-full">
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
          {successMessage}
        </div>
      )}
      
      <DynamicEvaluationForm
        evaluado={currentUser}
        tipoEvaluador="AUTO"
        areaId={currentUser.area_id || null}
        rolObjetivo="ANALISTA"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
