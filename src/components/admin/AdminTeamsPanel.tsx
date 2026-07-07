// src/components/admin/AdminTeamsPanel.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Team, TeamMember, Area, User } from '../../types';
import { logger } from '../../utils/sanitize';

interface ExpandedTeam {
  teamId: string;
  members: TeamMember[];
  users: User[];
}

interface FormData {
  nombre: string;
  descripcion: string;
  area_id: string;
  leader_email: string;
}

export default function AdminTeamsPanel() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ExpandedTeam | null>(null);
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    descripcion: '',
    area_id: '',
    leader_email: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('nombre', { ascending: true });

      // Cargar áreas
      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      // Cargar usuarios (para líderes y miembros)
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('nombre', { ascending: true });

      if (teamsError) {
        setError('No se pudieron cargar los equipos.');
        logger.error('Error loading teams:', teamsError);
        return;
      }

      setTeams(teamsData || []);
      setAreas(areasData || []);
      setUsers(usersData || []);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandTeam = async (team: Team) => {
    if (expandedTeam === team.id) {
      setExpandedTeam(null);
      setExpandedData(null);
      return;
    }

    try {
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', team.id);

      if (membersError) {
        logger.error('Error loading team members:', membersError);
        return;
      }

      setExpandedTeam(team.id);
      setExpandedData({
        teamId: team.id,
        members: membersData || [],
        users,
      });
    } catch (err: any) {
      logger.error('Error expanding team:', err);
    }
  };

  const handleSaveTeam = async () => {
    try {
      if (!formData.nombre.trim() || !formData.area_id || !formData.leader_email) {
        setError('Nombre, área y líder son obligatorios.');
        return;
      }

      if (editingTeam) {
        const { error: updateError } = await supabase
          .from('teams')
          .update({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            area_id: formData.area_id,
            leader_email: formData.leader_email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTeam.id);

        if (updateError) {
          setError('Error al actualizar el equipo.');
          logger.error('Error updating team:', updateError);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('teams')
          .insert({
            nombre: formData.nombre.trim(),
            descripcion: formData.descripcion.trim() || null,
            area_id: formData.area_id,
            leader_email: formData.leader_email,
          });

        if (insertError) {
          setError('Error al crear el equipo.');
          logger.error('Error creating team:', insertError);
          return;
        }
      }

      setShowForm(false);
      setEditingTeam(null);
      setFormData({ nombre: '', descripcion: '', area_id: '', leader_email: '' });
      setError('');
      await loadData();
    } catch (err: any) {
      setError('Error inesperado.');
      logger.error('Error saving team:', err);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      nombre: team.nombre,
      descripcion: team.descripcion || '',
      area_id: team.area_id,
      leader_email: team.leader_email,
    });
    setShowForm(true);
    setError('');
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTeam(null);
    setFormData({ nombre: '', descripcion: '', area_id: '', leader_email: '' });
    setError('');
  };

  const toggleMemberPermission = async (
    memberId: string,
    field: 'receives_evaluation_from_leader' | 'performs_self_evaluation' | 'can_evaluate_peers',
    currentValue: boolean
  ) => {
    try {
      const { error: updateError } = await supabase
        .from('team_members')
        .update({ [field]: !currentValue })
        .eq('id', memberId);

      if (updateError) {
        setError('Error al actualizar permiso.');
        logger.error('Error updating member permission:', updateError);
        return;
      }

      // Recargar equipo expandido
      if (expandedTeam) {
        const team = teams.find(t => t.id === expandedTeam);
        if (team) {
          handleExpandTeam(team);
        }
      }
    } catch (err: any) {
      setError('Error inesperado.');
      logger.error('Error toggling permission:', err);
    }
  };

  const addMemberToTeam = async (teamId: string, userEmail: string) => {
    try {
      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('user_email', userEmail)
        .single();

      if (existing) {
        setError('Este usuario ya es miembro del equipo.');
        return;
      }

      const { error: insertError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_email: userEmail,
          receives_evaluation_from_leader: true,
          performs_self_evaluation: true,
          can_evaluate_peers: false,
        });

      if (insertError) {
        setError('Error al agregar miembro.');
        logger.error('Error adding member:', insertError);
        return;
      }

      // Recargar equipo expandido
      const team = teams.find(t => t.id === teamId);
      if (team) {
        handleExpandTeam(team);
      }
    } catch (err: any) {
      setError('Error inesperado.');
      logger.error('Error adding member:', err);
    }
  };

  const removeMemberFromTeam = async (memberId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (deleteError) {
        setError('Error al remover miembro.');
        logger.error('Error removing member:', deleteError);
        return;
      }

      // Recargar equipo expandido
      if (expandedTeam) {
        const team = teams.find(t => t.id === expandedTeam);
        if (team) {
          handleExpandTeam(team);
        }
      }
    } catch (err: any) {
      setError('Error inesperado.');
      logger.error('Error removing member:', err);
    }
  };

  const getAreaName = (areaId: string) => {
    return areas.find(a => a.id === areaId)?.nombre || 'Desconocida';
  };

  const getLeaderName = (email: string) => {
    return users.find(u => u.email === email)?.nombre || email;
  };

  const getUnassignedUsers = () => {
    const assignedEmails = expandedData?.members.map(m => m.user_email) || [];
    return users.filter(u => !assignedEmails.includes(u.email));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Gestión de Equipos</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
          >
            + Nuevo Equipo
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
            {editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}
          </h3>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Nombre del Equipo *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) =>
                setFormData({ ...formData, nombre: e.target.value })
              }
              placeholder="Ej: Equipo A, Back-end, etc."
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
              Área *
            </label>
            <select
              value={formData.area_id}
              onChange={(e) =>
                setFormData({ ...formData, area_id: e.target.value })
              }
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="">Selecciona un área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Líder del Equipo *
            </label>
            <select
              value={formData.leader_email}
              onChange={(e) =>
                setFormData({ ...formData, leader_email: e.target.value })
              }
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="">Selecciona un líder</option>
              {users.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.nombre} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTeam}
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
          <p className="mt-4 text-stone-600">Cargando equipos...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-lg border border-stone-200">
          <p className="text-stone-600">No hay equipos disponibles.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <button
                onClick={() => handleExpandTeam(team)}
                className="w-full px-4 py-3 flex justify-between items-center hover:bg-stone-50 transition-colors"
              >
                <div className="text-left flex-1">
                  <div className="font-bold text-slate-900">{team.nombre}</div>
                  <div className="text-sm text-stone-600">
                    Área: {getAreaName(team.area_id)} | Líder: {getLeaderName(team.leader_email)}
                  </div>
                </div>
                <span className={`text-stone-400 transition-transform ${expandedTeam === team.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {expandedTeam === team.id && expandedData && (
                <div className="bg-stone-50 border-t border-stone-200 p-4 space-y-4">
                  {/* Botones de acción */}
                  <div className="flex gap-2 pb-3 border-b border-stone-200">
                    <button
                      onClick={() => handleEditTeam(team)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                  </div>

                  {/* Miembros del equipo */}
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">
                      📋 Miembros del Equipo ({expandedData.members.length})
                    </h4>

                    {expandedData.members.length === 0 ? (
                      <div className="text-sm text-stone-600 italic mb-3">Sin miembros</div>
                    ) : (
                      <div className="space-y-3 mb-3">
                        {expandedData.members.map((member) => (
                          <div
                            key={member.id}
                            className="bg-white border border-stone-200 rounded p-3 space-y-2"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="font-semibold text-slate-900 text-sm md:text-base">
                                {users.find(u => u.email === member.user_email)?.nombre || member.user_email}
                              </div>
                              <button
                                onClick={() => removeMemberFromTeam(member.id)}
                                className="text-red-600 hover:text-red-800 text-xs md:text-sm font-semibold whitespace-nowrap"
                              >
                                ✕ Quitar
                              </button>
                            </div>

                            <div className="space-y-2 text-sm">
                              <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={member.receives_evaluation_from_leader}
                                  onChange={() =>
                                    toggleMemberPermission(
                                      member.id,
                                      'receives_evaluation_from_leader',
                                      member.receives_evaluation_from_leader
                                    )
                                  }
                                  className="w-4 h-4 cursor-pointer"
                                />
                                <span className="text-stone-700">Recibe evaluación del líder</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={member.performs_self_evaluation}
                                  onChange={() =>
                                    toggleMemberPermission(
                                      member.id,
                                      'performs_self_evaluation',
                                      member.performs_self_evaluation
                                    )
                                  }
                                  className="w-4 h-4 cursor-pointer"
                                />
                                <span className="text-stone-700">Realiza autoevaluación</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={member.can_evaluate_peers}
                                  onChange={() =>
                                    toggleMemberPermission(
                                      member.id,
                                      'can_evaluate_peers',
                                      member.can_evaluate_peers
                                    )
                                  }
                                  className="w-4 h-4 cursor-pointer"
                                />
                                <span className="text-stone-700">Puede evaluar compañeros</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Agregar miembro */}
                    {getUnassignedUsers().length > 0 && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          id={`select-member-${team.id}`}
                          className="flex-1 px-3 py-2 border border-stone-200 rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                          <option value="">Agregar miembro...</option>
                          {getUnassignedUsers().map((user) => (
                            <option key={user.email} value={user.email}>
                              {user.nombre}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const select = document.getElementById(
                              `select-member-${team.id}`
                            ) as HTMLSelectElement;
                            if (select.value) {
                              addMemberToTeam(team.id, select.value);
                              select.value = '';
                            }
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition-colors"
                        >
                          ➕ Agregar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>💡 Cómo funciona:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Cada equipo tiene un área y un líder</li>
          <li>Un líder puede tener múltiples equipos</li>
          <li>Configura si cada miembro recibe evaluación, se autoevalúa, o evalúa compañeros</li>
          <li>Ejemplos: Nico evalúa a su equipo pero no se autoevalúa, su equipo se autoevalúa y lo evalúa a él</li>
        </ul>
      </div>
    </div>
  );
}
