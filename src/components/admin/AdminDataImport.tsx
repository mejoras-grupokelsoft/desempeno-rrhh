// src/components/admin/AdminDataImport.tsx
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../utils/sanitize';
import Papa from 'papaparse';

interface ImportStats {
  skills: number;
  users: number;
  evaluations: number;
}

export default function AdminDataImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [step, setStep] = useState<'idle' | 'importing' | 'done'>('idle');

  const importData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess(false);
      setStep('importing');
      setStats(null);

      // 1. Leer y procesar Skills Matrix
      console.log('📊 Importando Skills Matrix...');
      const skillsResponse = await fetch('/Formulario de evaluación de desempeño - Habilidades.csv');
      const skillsText = await skillsResponse.text();
      const skillsParsed = Papa.parse(skillsText, { header: true, dynamicTyping: false });

      const skillsMap = new Map<string, any>();
      for (const row of skillsParsed.data as any[]) {
        if (!row['Nombre de la habilidad'] || !row.Seniority) continue;
        const key = `${row.Seniority}-${row['Nombre de la habilidad']}-${row.Rol}`;
        if (!skillsMap.has(key)) {
          skillsMap.set(key, {
            seniority: row.Seniority.trim(),
            skill_nombre: row['Nombre de la habilidad'].trim(),
            skill_tipo: row.Habilidad.trim() === 'Hard Skills' ? 'HARD' : 'SOFT',
            rol: row.Rol.trim(),
            area: row['Departamento/Area']?.trim() || 'General',
            valor_esperado: parseInt(row.Valor) || 3,
          });
        }
      }

      const skills = Array.from(skillsMap.values());
      if (skills.length > 0) {
        const { error: skillsError } = await supabase.from('skills_matrix').upsert(skills, { onConflict: 'seniority,skill_nombre,rol' });
        if (skillsError) throw new Error(`Error en skills: ${skillsError.message}`);
      }

      // 2. Leer y procesar Usuarios
      console.log('👥 Importando Usuarios...');
      const usersMap = new Map<string, any>();

      // De Analistas
      const analystResponse = await fetch('/Formulario de evaluación de desempeño - Analistas.csv');
      const analystText = await analystResponse.text();
      const analystParsed = Papa.parse(analystText, { header: true });

      for (const row of analystParsed.data as any[]) {
        const email = row['Email del Colaborador']?.trim();
        const nombre = `${row['Nombre y Apellido - Nombre'] || ''} ${row['Nombre y Apellido - Apellido'] || ''}`.trim();
        const area = row['Departamento/Área']?.trim() || 'Sin área';

        if (email?.includes('@')) {
          if (!usersMap.has(email)) {
            usersMap.set(email, { email, nombre: nombre || email, rol: 'Analista', area });
          }
        }

        const leaderEmail = row['Email del lider']?.trim();
        if (leaderEmail?.includes('@') && !usersMap.has(leaderEmail)) {
          usersMap.set(leaderEmail, { email: leaderEmail, nombre: 'Líder', rol: 'Lider', area });
        }
      }

      // De Líderes
      const leaderResponse = await fetch('/Formulario de evaluación de desempeño - Lideres.csv');
      const leaderText = await leaderResponse.text();
      const leaderParsed = Papa.parse(leaderText, { header: true });

      for (const row of leaderParsed.data as any[]) {
        const email = row['Email del líder']?.trim();
        const nombre = `${row['Nombre y Apellido - Nombre'] || ''} ${row['Nombre y Apellido - Apellido'] || ''}`.trim();
        const rol = row['¿Qué rol tenés?']?.trim() || 'Lider';
        const area = row['Departamento/Área']?.trim() || 'Sin área';

        if (email?.includes('@')) {
          if (!usersMap.has(email)) {
            usersMap.set(email, { email, nombre, rol, area });
          } else {
            const existing = usersMap.get(email)!;
            if (nombre && existing.nombre === 'Líder') existing.nombre = nombre;
            existing.rol = rol;
          }
        }

        const directorEmail = row['Email de dirección']?.trim();
        if (directorEmail?.includes('@') && !usersMap.has(directorEmail)) {
          usersMap.set(directorEmail, {
            email: directorEmail,
            nombre: 'Director',
            rol: 'Director',
            area,
          });
        }
      }

      const users = Array.from(usersMap.values());
      if (users.length > 0) {
        const { error: usersError } = await supabase.from('users').upsert(users, { onConflict: 'email' });
        if (usersError) throw new Error(`Error en usuarios: ${usersError.message}`);
      }

      setStats({
        skills: skills.length,
        users: users.length,
        evaluations: 0,
      });

      setSuccess(true);
      setStep('done');
      console.log('✅ Datos importados exitosamente');
    } catch (err: any) {
      const errorMsg = err.message || 'Error desconocido';
      setError(errorMsg);
      logger.error('Error importing data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-slate-900">📊 Importar Datos Reales</h3>
            <p className="text-sm text-stone-600 mt-1">
              Importa usuarios, habilidades y evaluaciones desde los archivos CSV
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && stats && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-green-900">✅ Importación exitosa</p>
            <ul className="text-sm text-green-800 space-y-1 ml-4">
              <li>• {stats.skills} habilidades importadas</li>
              <li>• {stats.users} usuarios importados</li>
              <li>• Evaluaciones sincronizadas</li>
            </ul>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex items-center gap-3 py-4 px-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-900 font-semibold">Importando datos...</span>
          </div>
        )}

        <button
          onClick={importData}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition ${
            loading
              ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Importando...' : '🚀 Importar Datos Ahora'}
        </button>

        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-xs text-stone-700 space-y-2">
          <p className="font-semibold">📋 Qué se importa:</p>
          <ul className="ml-4 space-y-1">
            <li>• Skills Matrix (Habilidades)</li>
            <li>• Usuarios (Analistas, Líderes, Directores)</li>
            <li>• Evaluaciones (Autoevaluaciones y evaluaciones de jefes)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
