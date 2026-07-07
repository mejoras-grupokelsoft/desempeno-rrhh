// src/components/admin/AdminSeedPanel.tsx
import { useState } from 'react';
import { seedAllData } from '../../lib/seedData';

export default function AdminSeedPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  const handleRunSeed = async () => {
    if (!window.confirm('⚠️ Esto poblará la BD con datos de prueba. ¿Estás seguro?')) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      await seedAllData();
      setResult({
        tipo: 'success',
        mensaje: '✅ Datos de prueba cargados exitosamente',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setResult({
        tipo: 'error',
        mensaje: `❌ Error: ${message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">🌱 Datos de Prueba</h2>
        <p className="text-gray-600 mb-4">
          Carga datos mock para testing del sistema completo. Esto incluye:
        </p>
        <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
          <li>8 usuarios (RRHH, Directors, Liders, Analistas)</li>
          <li>Asignaciones de usuarios a áreas</li>
          <li>HARD skills por área (IT y Ventas)</li>
          <li>SOFT skills globales (ya en BD)</li>
        </ul>
      </div>

      {result && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            result.tipo === 'success'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {result.mensaje}
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800 text-sm">
          <strong>⚠️ Nota:</strong> Asegúrate de haber ejecutado todas las migraciones primero (001-008).
        </p>
      </div>

      <button
        onClick={handleRunSeed}
        disabled={isLoading}
        className={`px-8 py-3 font-semibold rounded-lg transition-all ${
          isLoading
            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg'
        }`}
      >
        {isLoading ? '⏳ Cargando datos...' : '🌱 Ejecutar Seed'}
      </button>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-3">Usuarios creados:</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>RRHH:</strong> ana.rrhh@company.com</p>
          <p><strong>Director IT:</strong> carlos.director@company.com</p>
          <p><strong>Líder IT:</strong> maria.lider@company.com</p>
          <p><strong>Analista IT:</strong> juan.analista@company.com, sofia.analista@company.com</p>
          <p><strong>Líder Ventas:</strong> laura.lider@company.com</p>
          <p><strong>Analista Ventas:</strong> pablo.analista@company.com</p>
        </div>
      </div>
    </div>
  );
}
