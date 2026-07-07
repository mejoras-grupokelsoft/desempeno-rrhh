// src/components/admin/AdminAreasPanel.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Area, User } from '../../types';
import { logger } from '../../utils/sanitize';

interface AreaFormData {
  nombre: string;
  descripcion: string;
  parent_area_id: string | null;
  lider_email: string | null;
  activo: boolean;
}

export default function AdminAreasPanel() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState<AreaFormData>({
    nombre: '',
    descripcion: '',
    parent_area_id: null,
    lider_email: null,
    activo: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar áreas CON jerarquía
      const { data: areasData, error: areasError } = await supabase
        .from('areas')
        .select('*')
        .order('nombre', { ascending: true });

      // Cargar usuarios (para líder)
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('nombre', { ascending: true });

      if (areasError) {
        setError('No se pudieron cargar las áreas.');
        logger.error('Error loading areas:', areasError);
        return;
      }

      setAreas(areasData || []);
      setUsers(usersData || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.nombre.trim()) {
        setError('El nombre del área es obligatorio.');
        return;
      }

      if (editingArea) {
        // Actualizar
        const { error: supabaseError } = await supabase
          .from('areas')
          .update({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            parent_area_id: formData.parent_area_id || null,
            lider_email: formData.lider_email || null,
            activo: formData.activo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingArea.id);

        if (supabaseError) {
          setError(`Error al actualizar el área. ${supabaseError.message || 'Verifica permisos.'}`);
          logger.error('Error updating area:', supabaseError);
          return;
        }
      } else {
        // Crear
        const { error: supabaseError } = await supabase
          .from('areas')
          .insert({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            parent_area_id: formData.parent_area_id || null,
            lider_email: formData.lider_email || null,
            activo: formData.activo,
          });

        if (supabaseError) {
          if (supabaseError.code === '23505') {
            setError('Esta área ya existe.');
          } else {
            setError(`Error al crear el área. ${supabaseError.message || 'Verifica permisos.'}`);
          }
          logger.error('Error creating area:', supabaseError);
          return;
        }
      }

      setShowForm(false);
      setEditingArea(null);
      setFormData({ nombre: '', descripcion: '', parent_area_id: null, lider_email: null, activo: true });
      setError('');
      await loadData();
    } catch (err: any) {
      setError(`Error inesperado: ${err.message || 'Intentá de nuevo.'}`);
      logger.error('Error saving area:', err);
    }
  };

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setFormData({
      nombre: area.nombre,
      descripcion: area.descripcion || '',
      parent_area_id: area.parent_area_id || null,
      lider_email: area.lider_email || null,
      activo: area.activo,
    });
    setShowForm(true);
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingArea(null);
    setFormData({ nombre: '', descripcion: '', parent_area_id: null, lider_email: null, activo: true });
    setError('');
  };

  // Construir árbol jerárquico
  const buildHierarchy = (list: Area[], parentId: string | null = null, depth = 0): { area: Area; depth: number }[] => {
    return list
      .filter(a => (a.parent_area_id || null) === parentId)
      .flatMap(area => [
        { area, depth },
        ...buildHierarchy(list, area.id, depth + 1),
      ]);
  };

  const hierarchyList = buildHierarchy(areas);

  const getLeaderName = (email: string | null | undefined) => {
    if (!email) return 'Sin líder';
    return users.find(u => u.email === email)?.nombre || email;
  };

  const getAreaName = (areaId: string | null | undefined) => {
    if (!areaId) return 'Área raíz';
    return areas.find(a => a.id === areaId)?.nombre || 'Desconocida';
  };

  // Áreas que pueden ser padres (solo las raíz o sin hijos directos que causen ciclos)
  const validParentAreas = editingArea
    ? areas.filter(a => a.id !== editingArea.id)
    : areas;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Gestión de Áreas (Jerárquico)</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
          >
            + Nueva Área
          </button>
        )}
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <h3 className="font-bold text-lg text-slate-900">
            {editingArea ? 'Editar Área' : 'Nueva Área'}
          </h3>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) =>
                setFormData({ ...formData, nombre: e.target.value })
              }
              placeholder="Ej: Reclutamiento, Comunicaciones, etc."
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
              placeholder="Descripción opcional..."
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Área Padre (Para crear sub-área)
            </label>
            <select
              value={formData.parent_area_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, parent_area_id: e.target.value || null })
              }
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="">Ninguna (Área raíz)</option>
              {validParentAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {'  '.repeat(areas.filter(a => a.id === area.id).length > 0 ? 1 : 0)}{area.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Líder / Responsable
            </label>
            <select
              value={formData.lider_email || ''}
              onChange={(e) =>
                setFormData({ ...formData, lider_email: e.target.value || null })
              }
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="">Sin líder asignado</option>
              {users.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.nombre} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) =>
                setFormData({ ...formData, activo: e.target.checked })
              }
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-stone-700">Activo</span>
          </label>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-stone-600">Cargando áreas...</p>
        </div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-lg border border-stone-200">
          <p className="text-stone-600">No hay áreas disponibles.</p>
        </div>
      ) : (
        <>
          {/* DESKTOP VIEW */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[150px]">Área Padre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[150px]">Líder</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[100px]">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[100px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyList.map(({ area, depth }) => (
                  <tr key={area.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <span style={{ marginLeft: `${depth * 24}px` }}>
                        {depth > 0 ? '└─ ' : ''}{area.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {getAreaName(area.parent_area_id)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {getLeaderName(area.lider_email)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-white text-sm font-semibold inline-block ${
                        area.activo ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {area.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleEdit(area)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold transition-colors"
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE/TABLET VIEW */}
          <div className="lg:hidden space-y-3">
            {hierarchyList.map(({ area, depth }) => (
              <div key={area.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                  <div className="flex-1">
                    <div className="font-semibold text-base text-gray-800">
                      {'  '.repeat(depth)}{depth > 0 ? '└─ ' : ''}{area.nombre}
                    </div>
                    {area.descripcion && (
                      <div className="text-sm text-gray-600 mt-1">{area.descripcion}</div>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-white text-xs font-semibold ml-2 flex-shrink-0 ${
                    area.activo ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {area.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 mb-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Área Padre</div>
                    <div className="text-gray-700">{getAreaName(area.parent_area_id)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Líder</div>
                    <div className="text-gray-700">{getLeaderName(area.lider_email)}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleEdit(area)}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold transition-colors"
                >
                  ✏️ Editar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>💡 Estructura Jerárquica:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><strong>Área raíz</strong>: Recursos Humanos, Dirección, etc. (sin área padre)</li>
          <li><strong>Sub-área</strong>: Reclutamiento, Comunicaciones (tienen área padre)</li>
          <li><strong>Líder</strong>: Asigna responsable a cada área o sub-área</li>
          <li>Ejemplo: RRHH (Líder: Pame) → Reclutamiento (Líder: X) → Plan de Carrera (Líder: Y)</li>
        </ul>
      </div>
    </div>
  );
}
