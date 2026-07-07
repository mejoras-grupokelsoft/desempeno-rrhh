import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { normalizeText } from '../../utils/sanitize';
import type { Question, QuestionType } from '../../types';

interface AdminQuestionFormProps {
  question?: Question | null;
  onSave: (data: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export default function AdminQuestionForm({ question, onSave, onCancel }: AdminQuestionFormProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<QuestionType>('SOFT');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [estado, setEstado] = useState<'activo' | 'archivado' | 'oculto'>('activo');
  const [orden, setOrden] = useState(0);
  const [puntajeMinimo, setPuntajeMinimo] = useState(1);
  const [puntajeMaximo, setPuntajeMaximo] = useState(4);
  const [skillNombre, setSkillNombre] = useState<string>('');
  const [skillId, setSkillId] = useState<string | null>(null);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScoreWarning, setShowScoreWarning] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; nombre: string }>>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  // Cargar áreas al montar
  useEffect(() => {
    const loadAreas = async () => {
      try {
        const { data, error: err } = await supabase
          .from('areas')
          .select('id, nombre')
          .order('nombre', { ascending: true });
        
        if (err) throw err;
        setAreas(data || []);
      } catch (err) {
        console.error('Error cargando áreas:', err);
      }
    };
    loadAreas();
  }, []);

  // Inicializar con datos de pregunta existente
  useEffect(() => {
    if (question) {
      setNombre(question.nombre);
      setDescripcion(question.descripcion || '');
      setTipo(question.tipo || 'HARD');
      setAreaId(question.areaId || null);
      setEstado(question.estado);
      setOrden(question.orden ?? 0);
      setPuntajeMinimo(question.puntajeMinimo ?? 1);
      setPuntajeMaximo(question.puntajeMaximo ?? 4);
      setSkillNombre(question.skillNombre || '');
      setSkillId((question as any).skillId || null);
    }
  }, [question]);

  // Áreas válidas en la BD
  const VALID_AREAS = areas.map(a => a.nombre);

  // Cargar skills activas de la BD según tipo y área
  useEffect(() => {
    const loadSkills = async () => {
      try {
        setSkillsLoading(true);
        
        let query = supabase
          .from('skills')
          .select('id, nombre')
          .eq('estado', 'activo')
          .eq('tipo', tipo);

        // Solo filtrar por área si se seleccionó una área válida
        if (areaId && areas.length > 0) {
          const selectedArea = areas.find(a => a.id === areaId);
          if (selectedArea) {
            query = query.eq('area', selectedArea.nombre);
          }
        } else if (tipo === 'SOFT') {
          // Soft skills globales (area = null)
          query = query.is('area', null);
        }
        // Para HARD sin área válida → devuelve TODAS las HARD skills

        const { data, error: err } = await query.order('nombre', { ascending: true });

        if (err) throw err;
        
        setAvailableSkills(data?.map(s => ({ id: s.id, nombre: s.nombre })) || []);
        // Si hay una skill seleccionada y el id no esta seteado, buscarlo
        if (skillNombre && !skillId && data) {
          const found = data.find((s: any) => s.nombre === skillNombre);
          if (found) setSkillId(found.id);
        }
      } catch (err) {
        console.error('Error cargando skills:', err);
        setAvailableSkills([]);
      } finally {
        setSkillsLoading(false);
      }
    };

    if (tipo !== 'COMENTARIO') {
      loadSkills();
    } else {
      setAvailableSkills([]);
    }
  }, [tipo, areaId, areas]);

  // Filtrar skills según búsqueda del usuario
  const filteredSkills = useMemo(() => {
    if (!skillNombre.trim()) return availableSkills;
    const normalized = normalizeText(skillNombre);
    return availableSkills.filter(s => normalizeText(s.nombre).includes(normalized));
  }, [skillNombre, availableSkills]);

  const handlePuntajeChange = (field: 'min' | 'max', value: string) => {
    const numValue = value === '' ? 0 : Math.floor(Number(value));
    if (isNaN(numValue)) return;

    if (field === 'min') {
      setPuntajeMinimo(numValue);
    } else {
      setPuntajeMaximo(numValue);
    }

    if (question && (numValue !== (field === 'min' ? question.puntajeMinimo ?? 1 : question.puntajeMaximo ?? 4))) {
      setShowScoreWarning(true);
    } else {
      setShowScoreWarning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (tipo !== 'COMENTARIO' && !skillNombre.trim()) {
      setError('Debés vincular esta pregunta a una habilidad de la skills matrix');
      return;
    }

    // Validación de puntajes
    if (tipo !== 'COMENTARIO') {
      if (puntajeMinimo >= puntajeMaximo) {
        setError('El puntaje mínimo debe ser menor al máximo');
        return;
      }
      if (puntajeMinimo < 0 || puntajeMaximo > 10) {
        setError('Los puntajes deben estar entre 0 y 10');
        return;
      }
      if (!Number.isInteger(puntajeMinimo) || !Number.isInteger(puntajeMaximo)) {
        setError('Los puntajes deben ser números enteros');
        return;
      }
    }

    try {
      setLoading(true);
      await onSave({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        areaId: areaId || null,
        estado,
        orden: 0,
        skillId: tipo !== 'COMENTARIO' ? (skillId || null) : null,
        skillNombre: tipo !== 'COMENTARIO' ? (skillNombre.trim() || null) : null,
      } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando pregunta');
    } finally {
      setLoading(false);
    }
  };

  const isComentario = tipo === 'COMENTARIO';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">
            {question ? '✏️ Editar Pregunta' : '✚ Nueva Pregunta'}
          </h3>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">
              {error}
            </div>
          )}

          {showScoreWarning && (
            <div className="p-4 bg-orange-50 text-orange-800 rounded border border-orange-200">
              ⚠️ <strong>Advertencia:</strong> Estás modificando el rango de puntaje de una pregunta existente.
              Esto puede afectar los gráficos y análisis de evaluaciones anteriores.
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej: Comunicación, JavaScript, etc."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción (Opcional)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={isComentario ? 'Ej: Recordar feedback sobre el desempeño, puntos a mejorar, logros...' : 'Describe qué se evalúa en esta pregunta...'}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Tipo y Área - Lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                value={tipo}
                onChange={(e) => { setTipo(e.target.value as QuestionType); setSkillNombre(''); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="HARD">Hard Skill (Técnica)</option>
                <option value="SOFT">Soft Skill (Blanda)</option>
                <option value="COMENTARIO">💬 Comentario (Texto libre)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Área (Opcional)
              </label>
              <select
                value={areaId || ''}
                onChange={(e) => { setAreaId(e.target.value || null); setSkillNombre(''); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">🌐 Global (todas las áreas)</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vinculación con Skills Matrix - Solo para HARD/SOFT */}
          {!isComentario && (
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <label className="block text-sm font-semibold text-indigo-900 mb-1">
                🔗 Habilidad en la Skills Matrix *
              </label>
              <p className="text-xs text-indigo-700 mb-2">
                Vinculá esta pregunta a una habilidad del cuadro de mando. Los gráficos usarán esta relación para calcular el desempeño por skill.
                {areaId && areas.find(a => a.id === areaId) ? ` — Mostrando sugerencias para "${areas.find(a => a.id === areaId)?.nombre}"` : ' — Seleccioná un área para ver sugerencias.'}
              </p>
              <div className="relative">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={skillNombre}
                    onChange={(e) => { setSkillNombre(e.target.value); setSkillId(null); setShowSkillSuggestions(true); }}
                    onFocus={() => setShowSkillSuggestions(true)}
                    placeholder={tipo === 'HARD' ? 'Ej: Gestión de campañas, Dominio de CRM...' : 'Ej: Comunicación clara y efectiva...'}
                    className="flex-1 px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSkillSuggestions(!showSkillSuggestions)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-semibold"
                    title="Abrir selector de habilidades"
                  >
                    ▼
                  </button>
                </div>

                {/* Dropdown de sugerencias */}
                {showSkillSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-indigo-200 rounded-lg shadow-lg max-h-56 overflow-y-auto top-full">
                    {skillsLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500 italic text-center">
                        ⏳ Cargando habilidades...
                      </div>
                    ) : filteredSkills.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 italic text-center">
                        {availableSkills.length === 0 
                          ? 'No hay habilidades disponibles para esta combinación de tipo y área'
                          : 'No se encontraron habilidades'}
                      </div>
                    ) : (
                      filteredSkills.map((skill: { id: string; nombre: string }) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => { 
                            setSkillNombre(skill.nombre); 
                            setSkillId(skill.id);
                            setShowSkillSuggestions(false); 
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm transition-colors border-b border-indigo-100 last:border-b-0 ${
                            skillId === skill.id ? 'bg-indigo-100 font-semibold text-indigo-800' : 'text-gray-700'
                          }`}
                        >
                          {skillId === skill.id && '✓ '}
                          {skill.nombre}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Click fuera para cerrar */}
                {showSkillSuggestions && (
                  <div 
                    className="fixed inset-0 z-0"
                    onClick={() => setShowSkillSuggestions(false)}
                  />
                )}
              </div>

              {/* Indicador de vinculación */}
              {skillNombre && (
                <div className="mt-2 flex items-center gap-2 text-xs text-indigo-700 bg-indigo-100 px-3 py-2 rounded">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                  <strong>Vinculado a:</strong> {skillNombre}
                  <button
                    type="button"
                    onClick={() => { setSkillNombre(''); setSkillId(null); }}
                    className="ml-auto text-indigo-600 hover:text-indigo-800 font-bold"
                    title="Desvincular skill"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Advertencia si no hay skill vinculada */}
              {!skillNombre && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                  <span className="text-lg">⚠️</span>
                  <strong>Obligatorio:</strong> Debes vincular una habilidad para crear esta pregunta
                </div>
              )}
            </div>
          )}

          {/* Rango de Puntaje - Solo mostrar si NO es Comentario */}
          {!isComentario && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📊 Puntaje Más Bajo (Mínimo)
                </label>
                <input
                  type="number"
                  value={puntajeMinimo}
                  onChange={(e) => handlePuntajeChange('min', e.target.value)}
                  min="0"
                  max="10"
                  step="1"
                  placeholder="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-600 mt-1">Solo números enteros (0-10)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📊 Puntaje Más Alto (Máximo)
                </label>
                <input
                  type="number"
                  value={puntajeMaximo}
                  onChange={(e) => handlePuntajeChange('max', e.target.value)}
                  min="0"
                  max="10"
                  step="1"
                  placeholder="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-600 mt-1">Solo números enteros (0-10)</p>
              </div>
            </div>
          )}

          {/* Estado y Orden - Lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as 'activo' | 'archivado' | 'oculto')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="activo">✓ Activo</option>
                <option value="oculto">👁️ Oculto</option>
                <option value="archivado">📦 Archivado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Orden
              </label>
              <input
                type="number"
                value={orden}
                onChange={(e) => setOrden(parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Controla el orden de aparición</p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-semibold transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all disabled:opacity-50"
            >
              {loading ? '⏳ Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
