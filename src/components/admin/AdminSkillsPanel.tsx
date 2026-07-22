import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Skill, Area } from '../../types';

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

type FilterState = 'activos' | 'ocultos' | 'archivados' | 'todos';
type SkillType = 'HARD' | 'SOFT';

interface SkillRow extends Skill {
  estado: 'activo' | 'oculto' | 'archivado';
}

export default function AdminSkillsPanel() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [areasList, setAreasList] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<FilterState>('activos');
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillRow | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Filtros de búsqueda
  const [searchNombre, setSearchNombre] = useState('');
  const [filterTipo, setFilterTipo] = useState<SkillType | ''>('');
  const [filterArea, setFilterArea] = useState<string>('');

  // Cargar skills y áreas
  useEffect(() => {
    loadSkills();
    loadAreas();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('skills')
        .select('*')
        .order('orden', { ascending: true });

      if (fetchError) throw fetchError;
      setSkills((data || []) as SkillRow[]);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando skills');
    } finally {
      setLoading(false);
    }
  };

  const loadAreas = async () => {
    const { data, error: fetchError } = await supabase
      .from('areas')
      .select('*')
      .order('nombre', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setAreasList((data || []) as Area[]);
  };

  // Filtrar skills
  const filteredSkills = skills.filter(s => {
    const matchEstado = filter === 'activos' ? s.estado === 'activo' :
      filter === 'ocultos' ? s.estado === 'oculto' :
      filter === 'archivados' ? s.estado === 'archivado' : true;
    const matchNombre = !searchNombre.trim() ||
      normalizeText(s.nombre).includes(normalizeText(searchNombre));
    const matchTipo = !filterTipo || s.tipo === filterTipo;
    const matchArea = !filterArea ||
      (filterArea === 'global' ? !s.area : s.area === filterArea);
    return matchEstado && matchNombre && matchTipo && matchArea;
  });

  // Nombres de áreas activas desde la tabla `areas`, más cualquier área ya usada
  // en skills existentes (por si quedó inactiva o desincronizada), para no perder datos.
  const areasDisponibles = [...new Set([
    ...areasList.filter(a => a.activo).map(a => a.nombre),
    ...skills.map(s => s.area).filter(Boolean) as string[],
  ])].sort((a, b) => a.localeCompare(b));

  const counts = {
    activos: skills.filter(s => s.estado === 'activo').length,
    ocultos: skills.filter(s => s.estado === 'oculto').length,
    archivados: skills.filter(s => s.estado === 'archivado').length,
    todos: skills.length,
  };

  const handleCreate = async (formData: Omit<SkillRow, 'id' | 'createdAt' | 'updatedAt'> & { skillMatrixData?: Array<{ seniority: string; valor_esperado: number }> }) => {
    try {
      const { skillMatrixData, ...skillData } = formData;

      // Crear skill
      const { data, error: insertError } = await supabase
        .from('skills')
        .insert([skillData])
        .select();

      if (insertError) throw insertError;
      if (data) {
        setSkills([...skills, data[0]]);
        
        // Si hay datos de matriz, insertarlos
        if (skillMatrixData && skillMatrixData.length > 0) {
          const matrixInserts = skillMatrixData.map(m => ({
            skill_nombre: data[0].nombre,
            skill_tipo: data[0].tipo,
            seniority: m.seniority,
            valor_esperado: m.valor_esperado,
            area: data[0].area || null,
          }));
          
          const { error: matrixError } = await supabase
            .from('skills_matrix')
            .insert(matrixInserts);
          
          if (matrixError) {
            console.warn('⚠️ Advertencia: Skill creado pero no se pudieron guardar los puntajes:', matrixError.message);
          }
        }
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando skill');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<SkillRow> & { skillMatrixData?: Array<{ seniority: string; valor_esperado: number }> }) => {
    try {
      const { skillMatrixData, ...skillData } = updates;

      const { error: updateError } = await supabase
        .from('skills')
        .update(skillData)
        .eq('id', id);

      if (updateError) throw updateError;

      // Actualizar skills_matrix si se proporcionaron puntajes
      if (skillMatrixData && skillMatrixData.length > 0) {
        const skillNombre = skills.find(s => s.id === id)?.nombre || skillData.nombre;
        for (const m of skillMatrixData) {
          await supabase
            .from('skills_matrix')
            .update({ valor_esperado: m.valor_esperado })
            .eq('skill_nombre', skillNombre)
            .eq('seniority', m.seniority);
        }
      }

      setSkills(skills.map(s => s.id === id ? { ...s, ...skillData } : s));
      setEditingSkill(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando skill');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que querés eliminar esta skill?')) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('skills')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSkills(skills.filter(s => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando skill');
    }
  };

  const handleToggleEstado = async (skill: SkillRow) => {
    const nuevoEstado = skill.estado === 'activo' ? 'oculto' : 'activo';
    await handleUpdate(skill.id, { estado: nuevoEstado });
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-pink-100 rounded flex items-center justify-center">
              <span className="text-lg">⭐</span>
            </div>
            Skills (Habilidades)
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Gestiona las habilidades (skills) HARD y SOFT por área
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSkill(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
        >
          + Nuevo Skill
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          ❌ {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <input
            type="text"
            placeholder="Buscar skill..."
            value={searchNombre}
            onChange={(e) => setSearchNombre(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          {/* Tipo */}
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as SkillType | '')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todos los tipos</option>
            <option value="HARD">HARD (Técnicas)</option>
            <option value="SOFT">SOFT (Blandas)</option>
          </select>

          {/* Área */}
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todas las áreas</option>
            <option value="global">Global (Soft Skills)</option>
            {areasDisponibles.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

          {/* Estado */}
          <div className="flex gap-1 justify-end">
            {(['activos', 'ocultos', 'archivados', 'todos'] as FilterState[]).map(estado => (
              <button
                key={estado}
                onClick={() => setFilter(estado)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  filter === estado
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {estado === 'activos' ? `✓ (${counts.activos})` :
                 estado === 'ocultos' ? `👁 (${counts.ocultos})` :
                 estado === 'archivados' ? `📦 (${counts.archivados})` :
                 `📊 (${counts.todos})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div ref={tableRef} className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <tr>
              <th className="text-left px-6 py-3 font-semibold text-slate-700">Nombre</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-700">Tipo</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-700">Rol Objetivo</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-700">Área</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-700">Descripción</th>
              <th className="text-center px-6 py-3 font-semibold text-slate-700">Estado</th>
              <th className="text-center px-6 py-3 font-semibold text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSkills.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No hay skills que mostrar
                </td>
              </tr>
            ) : (
              filteredSkills.map(skill => (
                <tr key={skill.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-3 font-semibold text-slate-900">{skill.nombre}</td>
                  <td className="px-6 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      skill.tipo === 'HARD'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {skill.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {skill.rol_objetivo ? (
                      <span className={`px-3 py-1 rounded text-xs font-semibold ${
                        skill.rol_objetivo === 'LIDER'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {skill.rol_objetivo}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Ambos</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {skill.area ? (
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs">{skill.area}</span>
                    ) : (
                      <span className="text-slate-400 italic">Global</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">
                    {skill.descripcion}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button
                      onClick={() => handleToggleEstado(skill)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        skill.estado === 'activo'
                          ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                          : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
                      }`}
                    >
                      {skill.estado === 'activo' ? '✓ Activo' : '👁 Oculto'}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-center space-x-2">
                    <button
                      onClick={() => {
                        setEditingSkill(skill);
                        setShowForm(true);
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Formulario Modal */}
      {showForm && (
        <SkillFormModal
          skill={editingSkill}
          areas={areasDisponibles}
          onSave={editingSkill ? 
            (data) => handleUpdate(editingSkill.id, data) :
            handleCreate
          }
          onClose={() => {
            setShowForm(false);
            setEditingSkill(null);
          }}
        />
      )}
    </div>
  );
}

// Componente del formulario modal
function SkillFormModal({
  skill,
  areas,
  onSave,
  onClose,
}: {
  skill: SkillRow | null;
  areas: string[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const SENIORITY_LEVELS = ['Trainee', 'Junior', 'Semi Senior', 'Senior'];
  const [formData, setFormData] = useState({
    nombre: skill?.nombre || '',
    tipo: (skill?.tipo || 'SOFT') as SkillType,
    rol_objetivo: skill?.rol_objetivo || '' as string,
    area: skill?.area || '',
    descripcion: skill?.descripcion || '',
    estado: (skill?.estado || 'activo') as 'activo' | 'oculto',
    orden: skill?.orden || 0,
  });
  
  // Matriz de puntajes por seniority (para nuevos Y existentes)
  const [skillMatrix, setSkillMatrix] = useState<Array<{ seniority: string; valor_esperado: number }>>(
    SENIORITY_LEVELS.map(s => ({ seniority: s, valor_esperado: 1 }))
  );
  const [matrixLoading, setMatrixLoading] = useState(!!skill);
  const [saving, setSaving] = useState(false);

  // Estados para preguntas vinculadas
  const [linkedQuestions, setLinkedQuestions] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(!!skill);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [searchQuestion, setSearchQuestion] = useState('');

  // Cargar puntajes existentes si es edición
  useEffect(() => {
    if (!skill) return;
    
    // Cargar matriz
    supabase
      .from('skills_matrix')
      .select('seniority, valor_esperado')
      .eq('skill_nombre', skill.nombre)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSkillMatrix(SENIORITY_LEVELS.map(s => {
            const found = data.find((d: any) => d.seniority === s);
            return { seniority: s, valor_esperado: found ? found.valor_esperado : 1 };
          }));
        }
        setMatrixLoading(false);
      });

    // Cargar preguntas vinculadas
    supabase
      .from('questions')
      .select('id, pregunta, descripcion')
      .eq('skill_id', skill.id)
      .then(({ data: questionData }) => {
        setLinkedQuestions(questionData || []);
      });

    // Cargar todas las preguntas (para el selector)
    supabase
      .from('questions')
      .select('id, pregunta')
      .eq('estado', 'activo')
      .order('pregunta', { ascending: true })
      .then(({ data: allData }) => {
        setAllQuestions(allData || []);
        setQuestionsLoading(false);
      });
  }, [skill?.id, skill?.nombre]);

  // Preguntas disponibles para vincular (no vinculadas aún)
  const availableQuestions = allQuestions.filter(
    q => !linkedQuestions.find(lq => lq.id === q.id)
  );

  // Filtrar preguntas según búsqueda
  const filteredQuestions = availableQuestions.filter(q =>
    q.pregunta.toLowerCase().includes(searchQuestion.toLowerCase())
  );

    // Vincular una pregunta
  const handleLinkQuestion = async (questionId: string) => {
    try {
      const selectedQuestion = allQuestions.find(q => q.id === questionId);
      if (!selectedQuestion) return;

      // Actualizar en BD usando skill_id
      const { error } = await supabase
        .from('questions')
        .update({ skill_id: skill!.id })
        .eq('id', questionId);

      if (error) throw error;

      // Actualizar estado local
      setLinkedQuestions([...linkedQuestions, selectedQuestion]);
      setSearchQuestion('');
      setShowQuestionSelector(false);
    } catch (err) {
      console.error('Error vinculando pregunta:', err);
    }
  };

  // Desvincular una pregunta
  const handleUnlinkQuestion = async (questionId: string) => {
    try {
      // Actualizar en BD
      const { error } = await supabase
        .from('questions')
        .update({ skill_id: null })
        .eq('id', questionId);

      if (error) throw error;

      // Actualizar estado local
      setLinkedQuestions(linkedQuestions.filter(q => q.id !== questionId));
    } catch (err) {
      console.error('Error desvinculando pregunta:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Siempre incluir matriz (tanto para nuevos como existentes)
      await onSave({ ...formData, skillMatrixData: skillMatrix });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 my-8 max-h-screen overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-900 mb-4">
          {skill ? '✏️ Editar Skill' : '➕ Nuevo Skill'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Ej: Comunicación"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Rol Objetivo
            </label>
            <select
              value={formData.rol_objetivo}
              onChange={(e) => setFormData({ ...formData, rol_objetivo: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Ambos</option>
              <option value="ANALISTA">Analista</option>
              <option value="LIDER">Líder</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as SkillType })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="HARD">HARD (Técnica)</option>
                <option value="SOFT">SOFT (Blanda)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Área
              </label>
              <select
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Global</option>
                {areas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Breve descripción del skill"
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Matriz de puntajes */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">
              📊 Puntajes esperados por Seniority (1-4)
            </h4>
            {matrixLoading ? (
              <div className="text-xs text-slate-500">Cargando puntajes...</div>
            ) : (
              <div className="space-y-2">
                {skillMatrix.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600 min-w-24">
                      {item.seniority}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={item.valor_esperado}
                      onChange={(e) => {
                        const newMatrix = [...skillMatrix];
                        newMatrix[idx].valor_esperado = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                        setSkillMatrix(newMatrix);
                      }}
                      className="w-16 px-2 py-1 border border-blue-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preguntas Vinculadas - NUEVA SECCIÓN */}
          {skill && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-green-900">
                  🔗 Preguntas Vinculadas ({linkedQuestions.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowQuestionSelector(!showQuestionSelector)}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded font-semibold hover:bg-green-700 transition"
                >
                  {showQuestionSelector ? '✕ Cerrar' : '+ Agregar'}
                </button>
              </div>

              {/* Lista de preguntas vinculadas */}
              {questionsLoading ? (
                <div className="text-xs text-slate-500">Cargando preguntas...</div>
              ) : linkedQuestions.length === 0 ? (
                <p className="text-xs text-green-700 italic mb-3">
                  ⚠️ No hay preguntas vinculadas. Haz clic en "Agregar" para vincular preguntas a este skill.
                </p>
              ) : (
                <ul className="space-y-2 mb-3">
                  {linkedQuestions.map(q => (
                    <li key={q.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-green-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{q.pregunta}</p>
                        {q.descripcion && (
                          <p className="text-xs text-slate-500 truncate">{q.descripcion}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkQuestion(q.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-semibold hover:bg-red-200 transition flex-shrink-0"
                      >
                        ✕ Desvincular
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Selector de preguntas */}
              {showQuestionSelector && (
                <div className="border-t border-green-200 pt-3">
                  <input
                    type="text"
                    placeholder="🔍 Buscar pregunta..."
                    value={searchQuestion}
                    onChange={(e) => setSearchQuestion(e.target.value)}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                  />

                  {filteredQuestions.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      {searchQuestion ? 'No se encontraron preguntas.' : 'No hay más preguntas disponibles.'}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredQuestions.map(q => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleLinkQuestion(q.id)}
                          className="w-full text-left px-3 py-2 bg-white border border-green-200 rounded text-xs hover:bg-green-50 transition"
                        >
                          <span className="font-semibold text-slate-800">{q.pregunta}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
            >
              {saving ? '⏳ Guardando...' : '✓ Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
