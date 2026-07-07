// src/components/forms/LeaderNotesPanel.tsx
import { useState, useEffect } from 'react';
import {
  fetchLeaderNotes, upsertLeaderNote, updateLeaderNote, deleteLeaderNote,
  type LeaderNote
} from '../../lib/supabaseQueries';
import { useApp } from '../../context/AppContext';
import type { User } from '../../types';

interface LeaderNotesPanelProps {
  /** Lista de miembros del equipo para el selector */
  members: User[];
  /** Si se pasa, pre-selecciona esta persona */
  initialMember?: User | null;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

export default function LeaderNotesPanel({ members, initialMember }: LeaderNotesPanelProps) {
  const { currentUser } = useApp();
  const [selectedMember, setSelectedMember] = useState<User | null>(
    initialMember || (members.length === 1 ? members[0] : null)
  );

  // Si el padre cambia initialMember (ej: se seleccionó alguien en el form),
  // actualizar la selección solo si todavía no hay ninguna o si hay nueva
  useEffect(() => {
    if (initialMember) setSelectedMember(initialMember);
  }, [initialMember?.email]);
  const [notes, setNotes] = useState<LeaderNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editContenido, setEditContenido] = useState('');
  const [editFecha, setEditFecha] = useState(todayISO());
  const [editShared, setEditShared] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedMember) load(selectedMember.email);
    else setNotes([]);
  }, [selectedMember?.email, currentUser]);

  async function load(memberEmail: string) {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeaderNotes(currentUser.email, memberEmail);
      setNotes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setEditingId('new');
    setEditTitulo('');
    setEditContenido('');
    setEditFecha(todayISO());
    setEditShared(false);
    setError('');
  }

  function startEdit(note: LeaderNote) {
    setEditingId(note.id);
    setEditTitulo(note.titulo || '');
    setEditContenido(note.contenido);
    setEditFecha((note as any).fecha_nota || todayISO());
    setEditShared(note.is_shared);
    setError('');
  }

  async function handleSave() {
    if (!editContenido.trim() || !currentUser || !selectedMember) return;
    setSaving(true);
    setError('');
    try {
      if (editingId === 'new') {
        await upsertLeaderNote({
          leader_email: currentUser.email,
          member_email: selectedMember.email,
          titulo: editTitulo.trim() || undefined,
          contenido: editContenido.trim(),
          fecha_nota: editFecha,
          is_shared: editShared,
        });
      } else if (editingId) {
        await updateLeaderNote(editingId, {
          titulo: editTitulo.trim() || undefined,
          contenido: editContenido.trim(),
          fecha_nota: editFecha,
          is_shared: editShared,
        });
      }
      setEditingId(null);
      await load(selectedMember.email);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await deleteLeaderNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleShare(note: LeaderNote) {
    try {
      const updated = await updateLeaderNote(note.id, { is_shared: !note.is_shared });
      setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      {/* Selector de persona */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">
          Notas sobre:
        </label>
        <select
          value={selectedMember?.email || ''}
          onChange={e => {
            const m = members.find(u => u.email === e.target.value) || null;
            setSelectedMember(m);
            setEditingId(null);
          }}
          className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-stone-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">— Seleccioná una persona —</option>
          {members.map(m => (
            <option key={m.email} value={m.email}>{m.nombre}</option>
          ))}
        </select>
        {selectedMember && editingId !== 'new' && (
          <button
            onClick={startNew}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            + Nueva nota
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">❌ {error}</p>}

      {/* Formulario nueva/edición */}
      {editingId !== null && selectedMember && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-bold text-amber-800">
            {editingId === 'new' ? `✏️ Nueva nota — ${selectedMember.nombre}` : '✏️ Editando nota'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={editTitulo}
              onChange={e => setEditTitulo(e.target.value)}
              placeholder="Título (opcional)"
              className="px-3 py-2 text-sm border border-amber-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-amber-700 whitespace-nowrap">📅 Fecha:</label>
              <input
                type="date"
                value={editFecha}
                onChange={e => setEditFecha(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <textarea
            value={editContenido}
            onChange={e => setEditContenido(e.target.value)}
            placeholder="Observación, punto de mejora, logro, próximos pasos..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-amber-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            autoFocus
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editShared}
                onChange={e => setEditShared(e.target.checked)}
                className="w-4 h-4 accent-green-600"
              />
              <span>Compartir con {selectedMember.nombre}</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-2 text-sm font-semibold text-slate-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editContenido.trim()}
                className="px-5 py-2 text-sm font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : '💾 Guardar nota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!selectedMember && (
        <div className="text-center py-10 text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm font-medium">Seleccioná una persona para ver o agregar notas</p>
        </div>
      )}

      {selectedMember && loading && (
        <p className="text-stone-500 text-sm text-center py-4">Cargando notas...</p>
      )}

      {selectedMember && !loading && notes.length === 0 && editingId === null && (
        <div className="text-center py-8 text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
          <p className="text-2xl mb-1">📄</p>
          <p className="text-sm">No hay notas sobre {selectedMember.nombre} todavía.</p>
          <button onClick={startNew} className="mt-3 text-amber-600 text-sm font-semibold hover:underline">
            + Crear la primera nota
          </button>
        </div>
      )}

      {/* Lista de notas */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map(note => (
            <div
              key={note.id}
              className={`rounded-2xl border p-4 ${note.is_shared ? 'bg-green-50 border-green-200' : 'bg-white border-stone-200'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {note.titulo && <p className="font-semibold text-slate-800 text-sm">{note.titulo}</p>}
                    <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                      📅 {formatDisplayDate((note as any).fecha_nota || note.updated_at.split('T')[0])}
                    </span>
                    {note.is_shared && (
                      <span className="text-xs text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full">
                        ✓ Compartida
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.contenido}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(note)} title="Editar" className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl text-sm">✏️</button>
                  <button
                    onClick={() => toggleShare(note)}
                    title={note.is_shared ? 'Dejar de compartir' : 'Compartir'}
                    className="p-2 text-green-500 hover:bg-green-50 rounded-xl text-sm"
                  >{note.is_shared ? '🔒' : '📤'}</button>
                  <button onClick={() => handleDelete(note.id)} title="Eliminar" className="p-2 text-red-400 hover:bg-red-50 rounded-xl text-sm">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
