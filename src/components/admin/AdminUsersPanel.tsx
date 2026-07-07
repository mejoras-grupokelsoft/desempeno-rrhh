// src/components/admin/AdminUsersPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { normalizeText, sanitizeEmail } from '../../utils/sanitize';
import type { User, Area, UserRole } from '../../types';
import { logger } from '../../utils/sanitize';
import { changeUserRole, changeUserArea, generatePasswordResetToken } from '../../utils/userManagement';
import { syncUserToTeam } from '../../lib/supabaseQueries';

const ROLES: UserRole[] = ['RRHH', 'Director', 'Lider', 'Analista'];

const EMPTY_NEW_USER = { email: '', nombre: '', rol: 'Analista' as UserRole, area_id: '' };

interface BulkRow {
  email: string;
  nombre: string;
  rol: UserRole;
  area_id: string | null;
  areaNombre: string;
  valid: boolean;
  error?: string;
}

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<{
    rol: UserRole;
    area_id: string | null;
  } | null>(null);
  const [resetTokenUser, setResetTokenUser] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string>('');
  // Modal: agregar usuario
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  // Modal: importar CSV
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Filtros
  const [searchNombre, setSearchNombre] = useState('');
  const [filterRol, setFilterRol] = useState<UserRole | ''>('');
  const [filterArea, setFilterArea] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar usuarios
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('nombre', { ascending: true });

      if (usersError) {
        setError('No se pudieron cargar los usuarios.');
        logger.error('Error loading users:', usersError);
        return;
      }

      // Cargar áreas
      const { data: areasData, error: areasError } = await supabase
        .from('areas')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (areasError) {
        logger.error('Error loading areas:', areasError);
      }

      setUsers(usersData || []);
      setAreas(areasData || []);
    } finally {
      setLoading(false);
    }
  };

  const editRowRef = useRef<HTMLTableRowElement | null>(null);

  const handleEditStart = (user: User) => {
    setEditingUserId(user.id || user.email);
    setEditingUser({
      rol: user.rol,
      area_id: user.area_id || null,
    });
    setError('');
    // Scroll al row de edición después del render
    setTimeout(() => {
      if (editRowRef.current) {
        editRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleEditCancel = () => {
    setEditingUserId(null);
    setEditingUser(null);
    setResetTokenUser(null);
    setResetToken('');
  };

  const handleSaveChanges = async () => {
    if (!editingUserId || !editingUser) return;

    try {
      const user = users.find(u => (u.id || u.email) === editingUserId);
      if (!user) return;

      // Cambiar rol
      if (editingUser.rol !== user.rol) {
        const success = await changeUserRole(user.id || user.email, editingUser.rol);
        if (!success) {
          setError('Error al cambiar el rol. Verifica que seas RRHH y el usuario exista.');
          return;
        }
      }

      // Cambiar área
      if (editingUser.area_id !== (user.area_id || null)) {
        const success = await changeUserArea(user.id || user.email, editingUser.area_id);
        if (!success) {
          setError('Error al cambiar el área. Verifica que seas RRHH.');
          return;
        }
      }

      setError('');
      handleEditCancel();
      await loadData();
    } catch (err: any) {
      setError(`Error inesperado: ${err.message || 'Intentá de nuevo.'}`);
      logger.error('Error saving user changes:', err);
    }
  };

  const handleGeneratePasswordReset = async (user: User) => {
    try {
      const token = await generatePasswordResetToken(user.id || user.email);
      if (!token) {
        setError('Error al generar el token de reset.');
        return;
      }

      setResetTokenUser(user.email);
      setResetToken(token);
      setError('');
    } catch (err: any) {
      setError('Error al generar el token.');
      logger.error('Error generating reset token:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ── Agregar usuario individual ──────────────────────────────────────────
  const handleAddUser = async () => {
    setAddError('');
    const email = sanitizeEmail(newUser.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError('Email inválido.');
      return;
    }
    if (!newUser.nombre.trim()) {
      setAddError('El nombre es obligatorio.');
      return;
    }
    setAddLoading(true);
    try {
      const area = newUser.area_id ? areas.find(a => a.id === newUser.area_id) : null;
      const { error } = await supabase.from('users').insert([{
        email,
        nombre: newUser.nombre.trim(),
        rol: newUser.rol,
        area: area?.nombre || null,
        area_id: newUser.area_id || null,
      }]);
      if (error) { setAddError(error.message); return; }
      // Sincronizar con equipo del área automáticamente
      if (newUser.area_id) {
        try {
          await syncUserToTeam({ email, rol: newUser.rol, area_id: newUser.area_id, area: area?.nombre });
        } catch (syncErr) {
          logger.error('Error syncing team:', syncErr);
        }
      }
      setShowAddModal(false);
      setNewUser(EMPTY_NEW_USER);
      await loadData();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Importar CSV bulk ──────────────────────────────────────────────────
  const parseBulkText = (text: string): BulkRow[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map(line => {
      // Soporta: email,nombre,rol,area  (rol y area opcionales)
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      const [rawEmail = '', rawNombre = '', rawRol = '', rawArea = ''] = parts;
      const email = sanitizeEmail(rawEmail) || rawEmail;
      const nombre = rawNombre || email.split('@')[0];
      const rolInput = rawRol as UserRole;
      const rol: UserRole = ROLES.includes(rolInput) ? rolInput : 'Analista';
      const areaMatch = areas.find(a =>
        a.nombre.toLowerCase() === rawArea.toLowerCase()
      );
      const valid = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!nombre;
      return {
        email,
        nombre,
        rol,
        area_id: areaMatch?.id || null,
        areaNombre: areaMatch?.nombre || rawArea || '—',
        valid,
        error: !valid ? 'Email o nombre inválido' : undefined,
      };
    });
  };

  const handleBulkPreview = () => {
    setBulkResult('');
    setBulkRows(parseBulkText(bulkText));
  };

  const handleBulkImport = async () => {
    const validRows = bulkRows.filter(r => r.valid);
    if (validRows.length === 0) return;
    setBulkLoading(true);
    setBulkResult('');
    try {
      const toInsert = validRows.map(r => ({
        email: r.email,
        nombre: r.nombre,
        rol: r.rol,
        area: r.area_id ? areas.find(a => a.id === r.area_id)?.nombre || null : null,
        area_id: r.area_id,
      }));
      const { error } = await supabase
        .from('users')
        .upsert(toInsert, { onConflict: 'email' });
      if (error) { setBulkResult(`❌ ${error.message}`); return; }
      // Sincronizar cada usuario con el equipo de su área
      await Promise.allSettled(
        validRows
          .filter(r => r.area_id)
          .map(r => syncUserToTeam({ email: r.email, rol: r.rol, area_id: r.area_id!, area: r.areaNombre }))
      );
      setBulkResult(`✅ ${validRows.length} usuario(s) importados correctamente.`);
      setBulkRows([]);
      setBulkText('');
      await loadData();
    } catch (err: any) {
      setBulkResult(`❌ ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string || '';
      // Detectar si tiene header (primera línea contiene "email" o "correo")
      const lines = text.split('\n');
      const firstLine = lines[0]?.toLowerCase() || '';
      const hasHeader = firstLine.includes('email') || firstLine.includes('correo') || firstLine.includes('nombre');
      const body = hasHeader ? lines.slice(1).join('\n') : text;
      // Si es el CSV de PeopleForce, mapear columnas
      if (hasHeader && (firstLine.includes('correo') || firstLine.includes('nombres'))) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const emailIdx = headers.findIndex(h => h === 'correo');
        const nombreIdx = headers.findIndex(h => h === 'nombres');
        const apellidoIdx = headers.findIndex(h => h === 'apellidos');
        const deptIdx = headers.findIndex(h => h === 'departamento');
        const mapped = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const email = cols[emailIdx] || '';
          const nombre = [cols[nombreIdx] || '', cols[apellidoIdx] || ''].filter(Boolean).join(' ');
          const area = cols[deptIdx] || '';
          return `${email},${nombre},Analista,${area}`;
        }).filter(l => l.startsWith(',') === false && l.includes('@'));
        setBulkText(mapped.join('\n'));
      } else {
        setBulkText(body.trim());
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const getAreaName = (areaId: string | null) => {
    if (!areaId) return 'Sin área';
    return areas.find(a => a.id === areaId)?.nombre || 'Desconocida';
  };

  // Usuarios filtrados
  const filteredUsers = users.filter(u => {
    const matchNombre = !searchNombre.trim() ||
      normalizeText(u.nombre).includes(normalizeText(searchNombre)) ||
      normalizeText(u.email).includes(normalizeText(searchNombre));
    const matchRol = !filterRol || u.rol === filterRol;
    const matchArea = !filterArea ||
      (filterArea === 'sin-area' ? !u.area_id : u.area_id === filterArea);
    return matchNombre && matchRol && matchArea;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600">{filteredUsers.length} de {users.length} usuarios</span>
          <button
            onClick={() => { setShowAddModal(true); setAddError(''); setNewUser(EMPTY_NEW_USER); }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            + Agregar usuario
          </button>
          <button
            onClick={() => { setShowBulkModal(true); setBulkRows([]); setBulkText(''); setBulkResult(''); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            ⬆ Importar CSV
          </button>
        </div>
      </div>

      {/* ── Modal: Agregar usuario ────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Agregar usuario</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="usuario@grupokelsoft.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={newUser.nombre}
                  onChange={e => setNewUser({ ...newUser, nombre: e.target.value })}
                  placeholder="Nombre Apellido"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
                <select
                  value={newUser.rol}
                  onChange={e => setNewUser({ ...newUser, rol: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Área</label>
                <select
                  value={newUser.area_id}
                  onChange={e => setNewUser({ ...newUser, area_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Sin área</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            </div>
            {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{addError}</p>}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddUser}
                disabled={addLoading}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                {addLoading ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Importar CSV ───────────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Importar usuarios — CSV</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">Formatos aceptados:</p>
              <p>• Columnas: <code>email, nombre, rol, area</code> (rol y area son opcionales — default: Analista / Sin área)</p>
              <p>• También acepta el CSV de <strong>PeopleForce</strong> directamente (detecta las columnas automáticamente)</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold border border-gray-300 transition-colors"
              >
                📂 Cargar archivo .csv
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">O pegá las filas acá:</label>
              <textarea
                value={bulkText}
                onChange={e => { setBulkText(e.target.value); setBulkRows([]); setBulkResult(''); }}
                placeholder={'email,nombre,rol,area\npamela.gomez@grupokelsoft.com,Pamela Gomez,Lider,Recursos Humanos'}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleBulkPreview}
              disabled={!bulkText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Vista previa ({bulkText.trim().split('\n').filter(Boolean).length} filas)
            </button>

            {bulkRows.length > 0 && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Nombre</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Rol</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Área</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, i) => (
                        <tr key={i} className={`border-b ${row.valid ? 'hover:bg-gray-50' : 'bg-red-50'}`}>
                          <td className="px-3 py-2 font-mono text-xs">{row.email}</td>
                          <td className="px-3 py-2">{row.nombre}</td>
                          <td className="px-3 py-2">{row.rol}</td>
                          <td className="px-3 py-2">{row.areaNombre}</td>
                          <td className="px-3 py-2">
                            {row.valid
                              ? <span className="text-green-600 font-semibold">✓</span>
                              : <span className="text-red-600 text-xs">{row.error}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-green-600">{bulkRows.filter(r => r.valid).length} válidos</span>
                    {bulkRows.filter(r => !r.valid).length > 0 && (
                      <span className="ml-2 font-semibold text-red-500">{bulkRows.filter(r => !r.valid).length} con error (se omiten)</span>
                    )}
                  </p>
                  <button
                    onClick={handleBulkImport}
                    disabled={bulkLoading || bulkRows.filter(r => r.valid).length === 0}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-semibold text-sm transition-colors"
                  >
                    {bulkLoading ? 'Importando...' : `Importar ${bulkRows.filter(r => r.valid).length} usuario(s)`}
                  </button>
                </div>
              </div>
            )}
            {bulkResult && (
              <p className={`text-sm font-semibold px-3 py-2 rounded ${bulkResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {bulkResult}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">🔍 Buscar por nombre o email</label>
            <input
              type="text"
              value={searchNombre}
              onChange={(e) => setSearchNombre(e.target.value)}
              placeholder="Nombre o email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">👤 Filtrar por Rol</label>
            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value as UserRole | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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
              <option value="sin-area">Sin área</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        </div>
        {(searchNombre || filterRol || filterArea) && (
          <button
            onClick={() => { setSearchNombre(''); setFilterRol(''); setFilterArea(''); }}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {resetTokenUser && resetToken && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-blue-900">Token de Reset para {resetTokenUser}</p>
              <p className="text-sm text-blue-700 mt-1">
                Válido por 24 horas. Compartir este token con el usuario.
              </p>
            </div>
            <button
              onClick={() => {
                setResetTokenUser(null);
                setResetToken('');
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-blue-300 px-3 py-2 rounded font-mono text-sm break-all">
              {resetToken}
            </code>
            <button
              onClick={() => copyToClipboard(resetToken)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-stone-600">Cargando usuarios...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-stone-50 rounded-lg border border-stone-200">
          <p className="text-stone-600">No hay usuarios disponibles.</p>
        </div>
      ) : (
        <>
          {/* DESKTOP VIEW */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[150px]">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[150px]">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[100px]">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[120px]">Área</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron usuarios con los filtros aplicados.
                    </td>
                  </tr>
                ) : filteredUsers.map((user) => {
                  const isEditing = editingUserId === (user.id || user.email);

                  return (
                    <tr
                      key={user.id || user.email}
                      ref={isEditing ? editRowRef : null}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{user.nombre}</td>
                      <td className="px-4 py-3">
                        {isEditing && editingUser ? (
                          <select
                            value={editingUser.rol}
                            onChange={(e) =>
                              setEditingUser({ ...editingUser, rol: e.target.value as UserRole })
                            }
                            className="px-2 py-1 border border-stone-300 rounded text-sm"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded text-white text-sm font-semibold inline-block ${
                            user.rol === 'RRHH' ? 'bg-red-500' :
                            user.rol === 'Director' ? 'bg-blue-500' :
                            user.rol === 'Lider' ? 'bg-green-500' :
                            'bg-purple-500'
                          }`}>
                            {user.rol}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing && editingUser ? (
                          <select
                            value={editingUser.area_id || ''}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                area_id: e.target.value || null,
                              })
                            }
                            className="px-2 py-1 border border-stone-300 rounded text-sm"
                          >
                            <option value="">Sin área</option>
                            {areas.map((area) => (
                              <option key={area.id} value={area.id}>
                                {area.nombre}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-600">
                            {getAreaName(user.area_id || null)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveChanges}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold transition-colors"
                              >
                                ✓ Guardar
                              </button>
                              <button
                                onClick={handleEditCancel}
                                className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm font-semibold transition-colors"
                              >
                                ✕ Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditStart(user)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold transition-colors"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleGeneratePasswordReset(user)}
                                className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm font-semibold transition-colors"
                              >
                                🔑 Reset Pass
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

          {/* MOBILE/TABLET VIEW */}
          <div className="lg:hidden space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                No se encontraron usuarios con los filtros aplicados.
              </div>
            ) : filteredUsers.map((user) => {
              const isEditing = editingUserId === (user.id || user.email);

              return (
                <div
                  key={user.id || user.email}
                  ref={isEditing ? editRowRef : null}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${isEditing ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}
                >
                  {/* Header */}
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    <div className="font-mono text-xs text-gray-500 mb-1">{user.email}</div>
                    <div className="font-semibold text-base text-gray-800">{user.nombre}</div>
                  </div>

                  {/* Rol */}
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-gray-500">Rol</label>
                    {isEditing && editingUser ? (
                      <select
                        value={editingUser.rol}
                        onChange={(e) =>
                          setEditingUser({ ...editingUser, rol: e.target.value as UserRole })
                        }
                        className="w-full mt-1 px-2 py-2 border border-stone-300 rounded text-sm"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1">
                        <span className={`px-2 py-1 rounded text-white text-xs font-semibold inline-block ${
                          user.rol === 'RRHH' ? 'bg-red-500' :
                          user.rol === 'Director' ? 'bg-blue-500' :
                          user.rol === 'Lider' ? 'bg-green-500' :
                          'bg-purple-500'
                        }`}>
                          {user.rol}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Área */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-gray-500">Área</label>
                    {isEditing && editingUser ? (
                      <select
                        value={editingUser.area_id || ''}
                        onChange={(e) =>
                          setEditingUser({
                            ...editingUser,
                            area_id: e.target.value || null,
                          })
                        }
                        className="w-full mt-1 px-2 py-2 border border-stone-300 rounded text-sm"
                      >
                        <option value="">Sin área</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm text-gray-600">
                        {getAreaName(user.area_id || null)}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 flex-wrap">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSaveChanges}
                          className="flex-1 px-2 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-semibold transition-colors"
                        >
                          ✓ Guardar
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="flex-1 px-2 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs font-semibold transition-colors"
                        >
                          ✕ Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditStart(user)}
                          className="flex-1 px-2 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-semibold transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleGeneratePasswordReset(user)}
                          className="flex-1 px-2 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs font-semibold transition-colors"
                        >
                          🔑 Reset Pass
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
