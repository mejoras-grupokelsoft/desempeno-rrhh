// src/utils/__tests__/dateUtils.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getSemester,
  getPreviousSemester,
  filterByPeriod,
  comparePersonaBetweenPeriods,
  PERIODOS,
} from '../dateUtils';
import { crearEval } from '../../test/mockData';

afterEach(() => {
  vi.useRealTimers();
});

// =====================================================================
// =====================================================================
// getSemester
// =====================================================================
describe('getSemester', () => {
  it('Enero-Junio → S1', () => {
    expect(getSemester(new Date(2025, 0, 1))).toBe(1);  // Enero
    expect(getSemester(new Date(2025, 2, 15))).toBe(1); // Marzo
    expect(getSemester(new Date(2025, 5, 30))).toBe(1); // Junio
  });

  it('Julio-Diciembre → S2', () => {
    expect(getSemester(new Date(2025, 6, 1))).toBe(2);   // Julio
    expect(getSemester(new Date(2025, 11, 31))).toBe(2); // Diciembre
  });
});

// =====================================================================
// getPreviousSemester
// =====================================================================
describe('getPreviousSemester', () => {
  it('en S2 retorna S1 del mismo año', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 6, 15)); // Julio = S2
    const result = getPreviousSemester();
    expect(result).toEqual({ year: 2025, semester: 1 });
  });

  it('en S1 retorna S2 del año anterior', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 1, 15)); // Febrero = S1
    const result = getPreviousSemester();
    expect(result).toEqual({ year: 2024, semester: 2 });
  });
});

// =====================================================================
// PERIODOS — constante exportada
// =====================================================================
describe('PERIODOS', () => {
  it('contiene todos los períodos definidos', () => {
    expect(PERIODOS.length).toBeGreaterThanOrEqual(10);
    const values = PERIODOS.map(p => p.value);
    expect(values).toContain('HISTORICO');
    expect(values).toContain('ESTE_ANO');
    expect(values).toContain('S_ACTUAL');
    expect(values).toContain('S_ANTERIOR');
    expect(values).toContain('ULTIMOS_2S');
    expect(values).toContain('ULTIMOS_3S');
  });

  it('cada período tiene label', () => {
    PERIODOS.forEach(p => {
      expect(p.label).toBeTruthy();
    });
  });
});

// =====================================================================
// filterByPeriod
// =====================================================================
describe('filterByPeriod', () => {
  const evals = [
    crearEval({ fecha: '2024-01-15' }),
    crearEval({ fecha: '2024-06-15' }),
    crearEval({ fecha: '2025-01-15' }),
    crearEval({ fecha: '2025-06-15' }),
    crearEval({ fecha: '2025-09-15' }),
  ];

  it('HISTORICO retorna todas las evaluaciones', () => {
    const result = filterByPeriod(evals, 'HISTORICO');
    expect(result).toHaveLength(evals.length);
  });

  it('ESTE_ANO filtra solo evaluaciones del año actual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 6, 1));
    const result = filterByPeriod(evals, 'ESTE_ANO');
    expect(result.every(e => e.fecha.startsWith('2025'))).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filtra vacío si no hay datos en el período', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 6, 1));
    const result = filterByPeriod(evals, 'S_ACTUAL');
    expect(result).toHaveLength(0);
  });

  it('maneja array vacío', () => {
    const result = filterByPeriod([], 'S_ACTUAL');
    expect(result).toEqual([]);
  });
});

// =====================================================================
// comparePersonaBetweenPeriods — fórmula min(avg, jefe)
// =====================================================================
describe('comparePersonaBetweenPeriods', () => {
  it('retorna estructura con sAnterior y sActual', () => {
    const result = comparePersonaBetweenPeriods([]);
    expect(result).toHaveProperty('sAnterior');
    expect(result).toHaveProperty('sActual');
    expect(Array.isArray(result.sAnterior)).toBe(true);
    expect(Array.isArray(result.sActual)).toBe(true);
  });

  it('aplica min(avg, jefe) en cada período', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 6, 15)); // Julio 2025 → S2

    // S1 (Enero-Junio 2025): auto=4, jefe=3 → min(3.5, 3) = 3
    // S2 (Julio-Diciembre 2025): auto=2, jefe=4 → min(3, 4) = 3
    const evals = [
      crearEval({ fecha: '2025-02-10', tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 4, skillTipo: 'HARD' }),
      crearEval({ fecha: '2025-02-10', tipoEvaluador: 'JEFE', skillNombre: 'JS', puntaje: 3, skillTipo: 'HARD' }),
      crearEval({ fecha: '2025-07-10', tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 2, skillTipo: 'HARD' }),
      crearEval({ fecha: '2025-07-10', tipoEvaluador: 'JEFE', skillNombre: 'JS', puntaje: 4, skillTipo: 'HARD' }),
    ];

    const result = comparePersonaBetweenPeriods(evals);

    // S anterior (S1 2025)
    const jsAnterior = result.sAnterior.find(s => s.skill === 'JS');
    expect(jsAnterior).toBeDefined();
    expect(jsAnterior!.promedio).toBe(3); // min(3.5, 3)

    // S actual (S2 2025)
    const jsActual = result.sActual.find(s => s.skill === 'JS');
    expect(jsActual).toBeDefined();
    expect(jsActual!.promedio).toBe(3); // min(3, 4)
  });

  it('maneja solo auto correctamente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 6, 15)); // Julio 2025 → S2

    const evals = [
      crearEval({ fecha: '2025-07-10', tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 4, skillTipo: 'HARD' }),
    ];

    const result = comparePersonaBetweenPeriods(evals);
    const js = result.sActual.find(s => s.skill === 'JS');
    expect(js).toBeDefined();
    expect(js!.promedio).toBe(4); // fallback a auto
  });
});
