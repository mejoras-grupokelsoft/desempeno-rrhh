import { useState, useEffect, useRef } from 'react';
import { fetchQuestionsByArea } from '../../lib/supabaseQueries';
import { adaptQuestions } from '../../lib/adapters';
import type { Question, EvaluatorType, User } from '../../types';

interface DynamicEvaluationFormProps {
  evaluado: User; // Persona siendo evaluada
  tipoEvaluador: EvaluatorType; // 'AUTO' o 'JEFE'
  areaId: string | null; // UUID del área para filtrar preguntas HARD
  rolObjetivo?: string | null; // 'ANALISTA' | 'LIDER' — filtra preguntas por rol del evaluado
  onSubmit: (respuestas: Record<string, 1 | 2 | 3 | 4>, comentarios: string) => Promise<void>;
  onCancel?: () => void;
}

export default function DynamicEvaluationForm({
  evaluado,
  tipoEvaluador,
  areaId,
  rolObjetivo,
  onSubmit,
  onCancel,
}: DynamicEvaluationFormProps) {
  const [questionsHard, setQuestionsHard] = useState<Question[]>([]);
  const [questionsSoft, setQuestionsSoft] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, 1 | 2 | 3 | 4>>({});
  const [comentarios, setComentarios] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Cargar preguntas al montar el componente
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const [hardQuestions, softQuestions] = await Promise.all([
          fetchQuestionsByArea(areaId, 'HARD', false, rolObjetivo ?? undefined),
          fetchQuestionsByArea(null, 'SOFT', false, rolObjetivo ?? undefined),
        ]);
        setQuestionsHard(adaptQuestions(hardQuestions));
        setQuestionsSoft(adaptQuestions(softQuestions));
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando preguntas');
      } finally {
        setLoading(false);
      }
    };
    loadQuestions();
  }, [areaId, rolObjetivo]);

const RATING_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Nunca',
  2: 'A veces',
  3: 'Casi siempre',
  4: 'Siempre',
};

  const handleRatingChange = (questionId: string, score: 1 | 2 | 3 | 4) => {
    setRespuestas(prev => ({ ...prev, [questionId]: score }));
    // Quitar el resaltado rojo al responder
    if (missingIds.has(questionId)) {
      setMissingIds(prev => { const s = new Set(prev); s.delete(questionId); return s; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validar que todas las preguntas tengan respuesta
    const allQuestions = [...questionsHard, ...questionsSoft];
    const missingQuestions = allQuestions.filter(q => !respuestas[q.id]);
    
    if (missingQuestions.length > 0) {
      const ids = new Set(missingQuestions.map(q => q.id));
      setMissingIds(ids);
      setError(`Por favor respondé todas las preguntas (faltan ${missingQuestions.length})`);
      // Scroll a la primera pregunta sin responder
      const firstMissingId = missingQuestions[0].id;
      const el = questionRefs.current[firstMissingId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setMissingIds(new Set());

    try {
      setSubmitting(true);
      await onSubmit(respuestas, comentarios);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando evaluación');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center py-12 text-gray-500">
          ⏳ Cargando formulario...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">
        Evaluación de Desempeño
      </h2>
      <p className="text-gray-600 mb-6">
        Evaluando a <strong>{evaluado.nombre}</strong> ({evaluado.email})
        {tipoEvaluador === 'AUTO' ? ' - Autoevaluación' : ' - Evaluación del Jefe'}
      </p>

      {error && (
        <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-lg border border-red-200">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Hard Skills */}
        {questionsHard.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">
                H
              </span>
              Hard Skills (Habilidades Técnicas)
            </h3>
            <div className="space-y-4">
              {questionsHard.map(question => (
                <div
                  key={question.id}
                  ref={el => { questionRefs.current[question.id] = el; }}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg transition-colors ${
                    missingIds.has(question.id)
                      ? 'bg-red-50 border-2 border-red-400'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex-1">
                    <label className="text-gray-700 font-medium">{question.nombre}</label>
                    {question.descripcion && (
                      <p className="text-sm text-gray-500">{question.descripcion}</p>
                    )}
                    {missingIds.has(question.id) && (
                      <p className="text-xs text-red-600 font-semibold mt-1">⚠ Respuesta requerida</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {([1, 2, 3, 4] as (1 | 2 | 3 | 4)[]).map(score => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleRatingChange(question.id, score)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          respuestas[question.id] === score
                            ? 'bg-blue-500 text-white shadow-lg'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {RATING_LABELS[score]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Soft Skills */}
        {questionsSoft.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm">
                S
              </span>
              Soft Skills (Habilidades Blandas)
            </h3>
            <div className="space-y-4">
              {questionsSoft.map(question => (
                <div
                  key={question.id}
                  ref={el => { questionRefs.current[question.id] = el; }}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg transition-colors ${
                    missingIds.has(question.id)
                      ? 'bg-red-50 border-2 border-red-400'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="flex-1">
                    <label className="text-gray-700 font-medium">{question.nombre}</label>
                    {question.descripcion && (
                      <p className="text-sm text-gray-500">{question.descripcion}</p>
                    )}
                    {missingIds.has(question.id) && (
                      <p className="text-xs text-red-600 font-semibold mt-1">⚠ Respuesta requerida</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {([1, 2, 3, 4] as (1 | 2 | 3 | 4)[]).map(score => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleRatingChange(question.id, score)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          respuestas[question.id] === score
                            ? 'bg-purple-500 text-white shadow-lg'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {RATING_LABELS[score]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comentarios */}
        <section>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Comentarios Generales (Opcional)
          </label>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Agrega comentarios adicionales sobre el desempeño..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
          />
        </section>

        {/* Botones de acción */}
        <div className="flex gap-4 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || loading}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-white transition-all ${
              submitting || loading
                ? 'bg-gray-400 opacity-50'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? '⏳ Guardando...' : '✓ Guardar Evaluación'}
          </button>
        </div>
      </form>
    </div>
  );
}
