import { useState, useEffect, useRef } from 'react';
import { fetchQuestions, createQuestion, updateQuestion, hideQuestion, archiveQuestion } from '../../lib/supabaseQueries';
import { adaptQuestions } from '../../lib/adapters';
import { supabase } from '../../lib/supabaseClient';
import { normalizeText } from '../../utils/sanitize';
import type { Question } from '../../types';
import AdminQuestionForm from './AdminQuestionForm';

type FilterState = 'activos' | 'ocultos' | 'archivados' | 'todos';

export default function AdminQuestionsPanel() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [areas, setAreas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [areaMap, setAreaMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<FilterState>('activos');
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [autoLinkLoading, setAutoLinkLoading] = useState(false);
  const [autoLinkResult, setAutoLinkResult] = useState<{ linked: number; notFound: string[] } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<FilterState, number>>({ activos: 0, ocultos: 0, archivados: 0, todos: 0 });
  // Filtros de búsqueda
  const [searchNombre, setSearchNombre] = useState('');
  const [filterTipo, setFilterTipo] = useState<'HARD' | 'SOFT' | 'COMENTARIO' | ''>('');
  const [filterArea, setFilterArea] = useState<string>('');

  // Cargar preguntas y áreas
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Cargar áreas (todas, incluso inactivas, para mostrar correctamente)
        const { data: areasData, error: areasErr } = await supabase
          .from('areas')
          .select('id, nombre');
        
        if (areasErr) throw areasErr;
        
        setAreas(areasData || []);
        
        // Crear mapeo id -> nombre
        const map: Record<string, string> = {};
        (areasData || []).forEach(a => {
          map[a.id] = a.nombre;
        });
        setAreaMap(map);
        
        // Cargar preguntas
        const questionsData = await fetchQuestions(true);
        setQuestions(adaptQuestions(questionsData));
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Restaurar scroll position cuando cambias de filtro
  useEffect(() => {
    setTimeout(() => {
      if (tableRef.current) {
        tableRef.current.scrollLeft = scrollPositions.current[filter];
      }
    }, 0);
  }, [filter]);

  // Scroll automático al formulario cuando se abre
  useEffect(() => {
    if (showForm && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, [showForm]);

  // Guardar scroll position antes de cambiar filtro
  const handleFilterChange = (newFilter: FilterState) => {
    if (tableRef.current) {
      scrollPositions.current[filter] = tableRef.current.scrollLeft;
    }
    setFilter(newFilter);
  };

  // Filtrar preguntas según el estado seleccionado + búsqueda adicional
  const filteredQuestions = questions.filter(q => {
    const resolvedTipo = q.tipo || q.skillTipo || '';
    const matchEstado = filter === 'activos' ? q.estado === 'activo' :
      filter === 'ocultos' ? q.estado === 'oculto' :
      filter === 'archivados' ? q.estado === 'archivado' : true;
    const normalized = normalizeText(searchNombre);
    const matchNombre = !searchNombre.trim() ||
      normalizeText(q.nombre).includes(normalized) ||
      normalizeText(q.descripcion || '').includes(normalized) ||
      normalizeText(q.skillNombre || '').includes(normalized);
    const matchTipo = !filterTipo || resolvedTipo === filterTipo;
    const matchArea = !filterArea ||
      (filterArea === 'global' ? !q.areaId : q.areaId === filterArea);
    return matchEstado && matchNombre && matchTipo && matchArea;
  });

  // Calcular conteos por estado (independientemente del filtro actual)
  const counts = {
    activos: questions.filter(q => q.estado === 'activo').length,
    ocultos: questions.filter(q => q.estado === 'oculto').length,
    archivados: questions.filter(q => q.estado === 'archivado').length,
    todos: questions.length
  };

  // Auto-vincular preguntas sin skill_id usando el nombre de la pregunta como match
  const handleAutoLink = async () => {
    setAutoLinkLoading(true);
    setAutoLinkResult(null);
    try {
      console.log('🔗 Iniciando auto-vinculación...');
      
      // 1. Obtener todas las skills activas con id y nombre
      const { data: skills, error: skillsErr } = await supabase
        .from('skills')
        .select('id, nombre')
        .eq('estado', 'activo');
      
      console.log('📚 Skills cargadas:', { count: skills?.length, skills, error: skillsErr });
      if (skillsErr) throw skillsErr;

      // Índice: nombre lowercase -> {id, nombre}
      const skillMap = new Map<string, { id: string; nombre: string }>();
      skills?.forEach(s => skillMap.set(s.nombre.toLowerCase().trim(), s));
      console.log('🗺️ Skill map creado:', Array.from(skillMap.keys()));

      // 2. Obtener TODAS las preguntas (sin filtrar por estado)
      const { data: todasPreguntas, error: qErr } = await supabase
        .from('questions')
        .select('id, pregunta, skill_id');
      
      console.log('❓ Preguntas cargadas:', { count: todasPreguntas?.length, error: qErr });
      if (qErr) throw new Error(`Error cargando preguntas: ${qErr.message} (${qErr.code})`);

      // Solo procesar las que no tienen skill_id válido
      const skillIds = new Set(skills?.map(s => s.id) || []);
      const preguntasSinVincular = (todasPreguntas || []).filter(
        q => !q.skill_id || !skillIds.has(q.skill_id)
      );

      console.log('🚫 Preguntas sin vincular:', { 
        count: preguntasSinVincular.length, 
        preguntas: preguntasSinVincular.map(p => ({ id: p.id, pregunta: p.pregunta, skill_id: p.skill_id }))
      });

      if (preguntasSinVincular.length === 0) {
        console.log('✅ Todas las preguntas ya tienen skill válida');
        setAutoLinkResult({ linked: 0, notFound: [], allLinked: true } as any);
        return;
      }

      let linked = 0;
      const notFound: string[] = [];
      const linkedList: Array<{pregunta: string; skill: string}> = [];

      // 3. Para cada pregunta, buscar skill por nombre
      for (const q of preguntasSinVincular) {
        const preguntaLower = q.pregunta?.toLowerCase().trim();
        if (!preguntaLower) {
          console.warn('⚠️ Pregunta sin nombre:', q.id);
          continue;
        }

        console.log(`🔍 Buscando skill para: "${q.pregunta}"`);

        // Match exacto primero
        let skill = skillMap.get(preguntaLower);
        console.log(`  → Match exacto: ${skill ? skill.nombre : 'NO'}`);

        // Si no hay match exacto, buscar por contenido parcial
        if (!skill) {
          for (const [key, s] of skillMap.entries()) {
            if (preguntaLower.includes(key) || key.includes(preguntaLower)) {
              console.log(`  → Match parcial encontrado: "${key}" → ${s.nombre}`);
              skill = s;
              break;
            }
          }
        }

        if (skill) {
          console.log(`✏️ Actualizando pregunta "${q.pregunta}" con skill_id ${skill.id}`);
          const { error: updErr, data: upData } = await supabase
            .from('questions')
            .update({ skill_id: skill.id })
            .eq('id', q.id)
            .select();
          
          console.log(`  → Update result:`, { updErr, upData });
          
          if (!updErr) {
            linked++;
            linkedList.push({ pregunta: q.pregunta, skill: skill.nombre });
            setQuestions(prev => prev.map(p =>
              p.id === q.id ? { ...p, skillId: skill!.id, skillNombre: skill!.nombre } : p
            ));
          } else {
            console.error(`  ❌ Error actualizando:`, updErr);
            notFound.push(q.pregunta);
          }
        } else {
          console.log(`❌ No se encontró skill para: "${q.pregunta}"`);
          notFound.push(q.pregunta);
        }
      }

      console.log('📊 Resultado final:', { linked, notFound, linkedList });
      setAutoLinkResult({ linked, notFound });
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('❌ Error en auto-vinculación:', msg);
      setError(`Error en auto-vinculación: ${msg}`);
    } finally {
      setAutoLinkLoading(false);
    }
  };

  const handleCreateQuestion = async (formData: any) => {
    try {
      // Solo columnas que existen en la tabla questions
      const supabaseData = {
        pregunta: formData.nombre,
        descripcion: formData.descripcion || null,
        skill_id: formData.skillId || null,
        rol_objetivo: formData.rolObjetivo || null,
        area_id: formData.areaId || null,
        estado: formData.estado || 'activo',
      };
      const newQuestion = await createQuestion(supabaseData as any);
      setQuestions([...questions, adaptQuestions([newQuestion])[0]]);
      setShowForm(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando pregunta');
    }
  };

  const handleUpdateQuestion = async (id: string, updates: Partial<Question>) => {
    try {
      // Solo columnas que existen realmente: pregunta, descripcion, skill_id, rol_objetivo, area_id, estado
      const supabaseUpdates = {
        ...(updates.nombre !== undefined && { pregunta: updates.nombre }),
        ...(updates.descripcion !== undefined && { descripcion: updates.descripcion }),
        ...(updates.areaId !== undefined && { area_id: updates.areaId }),
        ...(updates.rolObjetivo !== undefined && { rol_objetivo: updates.rolObjetivo }),
        ...(updates.estado !== undefined && { estado: updates.estado }),
        ...(updates.skillId !== undefined && { skill_id: updates.skillId }),
      };
      const updated = await updateQuestion(id, supabaseUpdates as any);
      setQuestions(questions.map(q => (q.id === id ? adaptQuestions([updated])[0] : q)));
      setEditingQuestion(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando pregunta');
    }
  };

  const handleHide = async (id: string) => {
    try {
      await hideQuestion(id);
      setQuestions(questions.map(q => (q.id === id ? { ...q, estado: 'oculto' } : q)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error ocultando pregunta');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveQuestion(id);
      setQuestions(questions.map(q => (q.id === id ? { ...q, estado: 'archivado' } : q)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error archivando pregunta');
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          ❌ {error}
        </div>
      )}

      {/* Header con botón crear */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Preguntas / Skills</h2>
        <div className="flex gap-2">
          {/* Auto-vincular Skills (oculto temporalmente)
          <button
            onClick={handleAutoLink}
            disabled={autoLinkLoading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition-all disabled:opacity-50 text-sm"
            title="Vincula automáticamente preguntas sin skill usando el nombre como referencia"
          >
            {autoLinkLoading ? '⏳ Vinculando...' : '🔗 Auto-vincular Skills'}
          </button>
          */}
          <button
            onClick={() => {
              setEditingQuestion(null);
              setShowForm(!showForm);
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all"
          >
            ✚ Nueva Pregunta
          </button>
        </div>
      </div>

      {/* Resultado del auto-vínculo */}
      {autoLinkResult && (
        <div className={`p-4 rounded-lg border ${
          (autoLinkResult as any).allLinked
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : autoLinkResult.notFound.length === 0
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          {(autoLinkResult as any).allLinked ? (
            <p className="font-semibold">ℹ️ Todas las preguntas ya tienen una skill vinculada. Nada que hacer.</p>
          ) : (
            <>
              <p className="font-semibold">
                ✅ {autoLinkResult.linked} pregunta(s) vinculadas automáticamente.
              </p>
              {autoLinkResult.notFound.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold">⚠️ {autoLinkResult.notFound.length} sin skill encontrada (requieren vinculación manual):</p>
                  <ul className="mt-1 text-xs list-disc list-inside max-h-32 overflow-y-auto">
                    {autoLinkResult.notFound.map(n => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
          <button
            onClick={() => setAutoLinkResult(null)}
            className="mt-2 text-xs underline opacity-70 hover:opacity-100"
          >Cerrar</button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div ref={formRef} className="mb-6">
          <AdminQuestionForm
            question={editingQuestion}
            onSave={editingQuestion ? (data) => handleUpdateQuestion(editingQuestion.id, data) : handleCreateQuestion}
            onCancel={() => {
              setShowForm(false);
              setEditingQuestion(null);
            }}
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b-2 border-gray-200 pb-2">
        {(['activos', 'ocultos', 'archivados', 'todos'] as FilterState[]).map(f => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-4 py-2 font-semibold transition-all ${
              filter === f
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Leyenda de Estados */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-blue-900 mb-3">📋 Leyenda de Estados:</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-green-500 rounded flex-shrink-0 mt-0.5"></div>
            <div>
              <div className="font-semibold text-gray-800">Activo</div>
              <div className="text-xs text-gray-600">Preguntas que se usan actualmente en evaluaciones</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-yellow-500 rounded flex-shrink-0 mt-0.5"></div>
            <div>
              <div className="font-semibold text-gray-800">Oculto</div>
              <div className="text-xs text-gray-600">Preguntas pausadas (no aparecen en nuevas evaluaciones)</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-red-500 rounded flex-shrink-0 mt-0.5"></div>
            <div>
              <div className="font-semibold text-gray-800">Archivado</div>
              <div className="text-xs text-gray-600">Preguntas histórico (solo lectura, no se pueden usar)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros de búsqueda */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">🔍 Buscar por nombre o skill</label>
            <input
              type="text"
              value={searchNombre}
              onChange={(e) => setSearchNombre(e.target.value)}
              placeholder="Nombre, descripción o skill vinculada..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">📊 Filtrar por Tipo</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              <option value="HARD">Hard Skill (Técnica)</option>
              <option value="SOFT">Soft Skill (Blanda)</option>
              <option value="COMENTARIO">💬 Comentario</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">🏢 Filtrar por Área</label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las áreas</option>
              <option value="global">🌐 Global</option>
              {areas.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        {(searchNombre || filterTipo || filterArea) && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Mostrando {filteredQuestions.length} resultado{filteredQuestions.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => { setSearchNombre(''); setFilterTipo(''); setFilterArea(''); }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              ✕ Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          ⏳ Cargando preguntas...
        </div>
      )}

      {/* Questions Table */}
      {!loading && filteredQuestions.length === 0 && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          No hay preguntas {filter !== 'todos' ? `en estado "${filter}"` : ''}.
        </div>
      )}

      {!loading && filteredQuestions.length > 0 && (
        <>
          {/* DESKTOP VIEW - Tabla normal */}
          <div className="hidden lg:block overflow-x-auto" ref={tableRef}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[60px]">Orden</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[250px]">Pregunta</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[100px]">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[180px]">🔗 Skill Vinculada</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[100px]">Rango</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[120px]">Área</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[100px]">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((q, idx) => {
                  const resolvedTipo = q.tipo || q.skillTipo;
                  const tipoLabel = resolvedTipo === 'COMENTARIO' ? '💬 Comentario' : (resolvedTipo || '❌ SIN TIPO');
                  const tipoClass = resolvedTipo === 'HARD' ? 'bg-blue-500' :
                    resolvedTipo === 'SOFT' ? 'bg-purple-500' :
                    resolvedTipo === 'COMENTARIO' ? 'bg-cyan-500' :
                    'bg-red-500';
                  const isComentario = resolvedTipo === 'COMENTARIO';
                  return (
                  <tr key={q.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{q.orden || idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div>{q.nombre}</div>
                      {q.descripcion && <div className="text-sm text-gray-500">{q.descripcion}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-white text-sm font-semibold inline-block ${tipoClass}`}>
                        {tipoLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isComentario ? (
                        <span className="text-gray-400 italic text-sm">N/A</span>
                      ) : q.skillNombre ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-200">
                          🔗 {q.skillNombre}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs border border-orange-200">
                          ⚠️ Sin vincular
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {isComentario ? (
                        <span className="text-gray-400 italic">N/A</span>
                      ) : (
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">
                          {q.puntajeMinimo ?? 1} - {q.puntajeMaximo ?? 4}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {q.areaId ? areaMap[q.areaId] || q.areaId : <span className="text-gray-400 italic">Global</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-white text-sm font-semibold inline-block ${
                        q.estado === 'activo' ? 'bg-green-500' :
                        q.estado === 'oculto' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}>
                        {q.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowForm(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold whitespace-nowrap transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        {q.estado === 'activo' && (
                          <>
                            <button
                              onClick={() => handleHide(q.id)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-semibold whitespace-nowrap transition-colors"
                            >
                              👁️ Ocultar
                            </button>
                            <button
                              onClick={() => handleArchive(q.id)}
                              className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-semibold whitespace-nowrap transition-colors"
                            >
                              📦 Archivar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE/TABLET VIEW - Tarjetas */}
          <div className="lg:hidden space-y-3">
            {filteredQuestions.map((q, idx) => {
              const resolvedTipo = q.tipo || q.skillTipo;
              const tipoLabel = resolvedTipo === 'COMENTARIO' ? '💬 Comentario' : (resolvedTipo || '❌ SIN TIPO');
              const tipoClass = resolvedTipo === 'HARD' ? 'bg-blue-500' :
                resolvedTipo === 'SOFT' ? 'bg-purple-500' :
                resolvedTipo === 'COMENTARIO' ? 'bg-cyan-500' :
                'bg-red-500';
              const isComentario = resolvedTipo === 'COMENTARIO';
              return (
              <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {/* Header de la tarjeta */}
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-base">{q.nombre}</div>
                    {q.descripcion && <div className="text-xs text-gray-500 mt-1">{q.descripcion}</div>}
                  </div>
                  <span className={`px-2 py-1 rounded text-white text-xs font-semibold ml-2 flex-shrink-0 ${
                    q.estado === 'activo' ? 'bg-green-500' :
                    q.estado === 'oculto' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}>
                    {q.estado}
                  </span>
                </div>

                {/* Detalles en grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Orden</div>
                    <div className="text-sm text-gray-800">{q.orden || idx + 1}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Tipo</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded text-white text-xs font-semibold inline-block ${tipoClass}`}>
                        {tipoLabel}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-gray-500">🔗 Skill Vinculada</div>
                    <div className="text-sm mt-0.5">
                      {isComentario ? (
                        <span className="text-gray-400 italic">N/A</span>
                      ) : q.skillNombre ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-200">
                          🔗 {q.skillNombre}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-xs border border-orange-200">
                          ⚠️ Sin vincular
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Rango</div>
                    <div className="text-sm text-gray-800">
                      {isComentario ? (
                        <span className="text-gray-400 italic">N/A</span>
                      ) : (
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded inline-block text-xs">
                          {q.puntajeMinimo ?? 1} - {q.puntajeMaximo ?? 4}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Área</div>
                    <div className="text-sm text-gray-800">
                      {q.areaId ? (areaMap[q.areaId] || q.areaId) : <span className="text-gray-400 italic">Global</span>}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setEditingQuestion(q);
                      setShowForm(true);
                    }}
                    className="flex-1 px-2 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-semibold transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  {q.estado === 'activo' && (
                    <>
                      <button
                        onClick={() => handleHide(q.id)}
                        className="flex-1 px-2 py-2 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 font-semibold transition-colors"
                      >
                        👁️ Ocultar
                      </button>
                      <button
                        onClick={() => handleArchive(q.id)}
                        className="flex-1 px-2 py-2 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 font-semibold transition-colors"
                      >
                        📦 Archivar
                      </button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
