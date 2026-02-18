// src/utils/__tests__/dateUtils.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getQuarter,
  getPreviousQuarter,
  filterByPeriod,
  comparePersonaBetweenPeriods,
  PERIODOS,
} from '../dateUtils';
import { crearEval } from '../../test/mockData';

afterEach(() => {
  vi.useRealTimers();
});

// =====================================================================
// getQuarter
// =====================================================================
describe('getQuarter', () => {
  it('Enero-Marzo → Q1', () => {
    expect(getQuarter(new Date(2025, 0, 1))).toBe(1);  // Enero
    expect(getQuarter(new Date(2025, 1, 15))).toBe(1); // Febrero
    expect(getQuarter(new Date(2025, 2, 31))).toBe(1); // Marzo
  });

  it('Abril-Junio → Q2', () => {
    expect(getQuarter(new Date(2025, 3, 1))).toBe(2);  // Abril
    expect(getQuarter(new Date(2025, 5, 30))).toBe(2); // Junio
  });

  it('Julio-Septiembre → Q3', () => {
    expect(getQuarter(new Date(2025, 6, 1))).toBe(3);  // Julio
    expect(getQuarter(new Date(2025, 8, 30))).toBe(3); // Septiembre
  });

  it('Octubre-Diciembre → Q4', () => {
    expect(getQuarter(new Date(2025, 9, 1))).toBe(4);   // Octubre
    expect(getQuarter(new Date(2025, 11, 31))).toBe(4); // Diciembre
  });
});

// =====================================================================
// getPreviousQuarter
// =====================================================================
describe('getPreviousQuarter', () => {
  it('en Q2 retorna Q1 del mismo año', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 15)); // Mayo = Q2
    const result = getPreviousQuarter();
    expect(result).toEqual({ year: 2025, quarter: 1 });
  });

  it('en Q1 retorna Q4 del año anterior', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 1, 15)); // Febrero = Q1
    const result = getPreviousQuarter();
    expect(result).toEqual({ year: 2024, quarter: 4 });
  });

  it('en Q4 retorna Q3 del mismo año', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 10, 15)); // Noviembre = Q4
    const result = getPreviousQuarter();
    expect(result).toEqual({ year: 2025, quarter: 3 });
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
    expect(values).toContain('Q_ACTUAL');
    expect(values).toContain('Q_ANTERIOR');
    expect(values).toContain('ULTIMOS_2Q');
    expect(values).toContain('ULTIMOS_3Q');
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
    const result = filterByPeriod(evals, 'Q_ACTUAL');
    expect(result).toHaveLength(0);
  });

  it('maneja array vacío', () => {
    const result = filterByPeriod([], 'Q_ACTUAL');
    expect(result).toEqual([]);
  });
});

// =====================================================================
// comparePersonaBetweenPeriods — fórmula min(avg, jefe)
// =====================================================================
describe('comparePersonaBetweenPeriods', () => {
  it('retorna estructura con qAnterior y qActual', () => {
    const result = comparePersonaBetweenPeriods([]);
    expect(result).toHaveProperty('qAnterior');
    expect(result).toHaveProperty('qActual');
    expect(Array.isArray(result.qAnterior)).toBe(true);
    expect(Array.isArray(result.qActual)).toBe(true);
  });

  it('aplica min(avg, jefe) en cada período', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 15)); // Mayo 2025 → Q2

    // Q1 (Enero-Marzo): auto=4, jefe=3 → min(3.5, 3) = 3
    // Q2 (Abril-Junio): auto=2, jefe=4 → min(3, 4) = 3
    const evals = [
      crearEval({ fecha: '2025-02-10', tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 4, skillTipo: 'HARD' }),
      crearEval({ fecha: '2025-02-10', tipoEvaluador: 'JEFE', skillNombre: 'JS', puntaje: 3, skillTipo: 'HARD' }),
      crearEval({ fecha: '2025-05-10', tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 2, skillTipo: 'HARD' }),
      crearEval({ fecha: '2025-05-10', tipoEvaluador: 'JEFE', skillNombre: 'JS', puntaje: 4, skillTipo: 'HARD' }),
    ];

    const result = comparePersonaBetweenPeriods(evals);

    // Q anterior (Q1)
    const jsAnterior = result.qAnterior.find(s => s.skill === 'JS');
    expect(jsAnterior).toBeDefined();
    expect(jsAnterior!.promedio).toBe(3); // min(3.5, 3)

    // Q actual (Q2)
    const jsActual = result.qActual.find(s => s.skill === 'JS');
    expect(jsActual).toBeDefined();
    expect(jsActual!.promedio).toBe(3); // min(3, 4)
  });

  it('maneja solo auto correctamente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 15));

    const evals = [
      crearEval({ fecha: '2025-05-10', tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 4, skillTipo: 'HARD' }),
    ];

    const result = comparePersonaBetweenPeriods(evals);
    const js = result.qActual.find(s => s.skill === 'JS');
    expect(js).toBeDefined();
    expect(js!.promedio).toBe(4); // fallback a auto
  });
});
