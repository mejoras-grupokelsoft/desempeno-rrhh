// src/hooks/useEvaluations.ts
import { useState, useCallback } from 'react';
import { insertEvaluation, updateEvaluation, deleteEvaluation } from '../lib/supabaseQueries';
import { reverseAdaptEvaluation } from '../lib/adapters';
import type { Evaluation, SupabaseEvaluation } from '../types';

export function useEvaluations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvaluation = useCallback(
    async (evaluation: Omit<Evaluation, 'id' | 'fecha'> & { periodo: string }) => {
      try {
        setLoading(true);
        setError(null);
        const supabaseEval = reverseAdaptEvaluation(evaluation);
        const result = await insertEvaluation(supabaseEval);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al crear evaluación';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateExistingEvaluation = useCallback(
    async (id: string, updates: Partial<SupabaseEvaluation>) => {
      try {
        setLoading(true);
        setError(null);
        const result = await updateEvaluation(id, updates);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al actualizar evaluación';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeEvaluation = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);
        await deleteEvaluation(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al eliminar evaluación';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    createEvaluation,
    updateExistingEvaluation,
    removeEvaluation,
  };
}
