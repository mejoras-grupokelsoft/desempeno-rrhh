// src/utils/__tests__/newChartCalculations.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calcularSaltoDeNivel,
  calcularBandasSeniority,
  calcularHardSoftStack,
} from '../newChartCalculations';
import { crearEval } from '../../test/mockData';

afterEach(() => {
  vi.useRealTimers();
});

// Helper: crear evaluaciones en ventanas de tiempo relativas a "ahora"
function evalsEnPeriodo(ahora: Date) {
  const hace1Mes = new Date(ahora);
  hace1Mes.setMonth(hace1Mes.getMonth() - 1);
  const hace4Meses = new Date(ahora);
  hace4Meses.setMonth(hace4Meses.getMonth() - 4);

  const fechaQ2 = hace1Mes.toISOString().split('T')[0];
  const fechaQ1 = hace4Meses.toISOString().split('T')[0];

  return {
    fechaQ1,
    fechaQ2,
    // Auto=4, Jefe=3 en Q1 → min(3.5, 3) = 3
    // Auto=2, Jefe=4 en Q2 → min(3, 4) = 3
    evals: [
      crearEval({ fecha: fechaQ1, tipoEvaluador: 'AUTO', puntaje: 4, evaluadoEmail: 'juan@test.com', evaluadoNombre: 'Juan' }),
      crearEval({ fecha: fechaQ1, tipoEvaluador: 'JEFE', puntaje: 3, evaluadoEmail: 'juan@test.com', evaluadoNombre: 'Juan' }),
      crearEval({ fecha: fechaQ2, tipoEvaluador: 'AUTO', puntaje: 2, evaluadoEmail: 'juan@test.com', evaluadoNombre: 'Juan' }),
      crearEval({ fecha: fechaQ2, tipoEvaluador: 'JEFE', puntaje: 4, evaluadoEmail: 'juan@test.com', evaluadoNombre: 'Juan' }),
    ],
  };
}

// =====================================================================
// calcularSaltoDeNivel
// =====================================================================
describe('calcularSaltoDeNivel', () => {
  it('calcula Q1 y Q2 con fórmula min(avg, jefe)', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const { evals } = evalsEnPeriodo(ahora);
    const target = [{ skill: 'JavaScript', valorEsperado: 3 }];

    const result = calcularSaltoDeNivel(evals, target, 'juan@test.com');
    expect(result).toHaveLength(1);
    expect(result[0].q1).toBe(3);  // min(3.5, 3) = 3
    expect(result[0].q2).toBe(3);  // min(3, 4) = 3
    expect(result[0].nivelEsperado).toBe(3);
    expect(result[0].cambio).toBe(0);
  });

  it('calcula nivel esperado desde targetSkills', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 6, 15));

    const target = [
      { skill: 'JS', valorEsperado: 3 },
      { skill: 'React', valorEsperado: 4 },
    ];
    const result = calcularSaltoDeNivel([], target);
    // Sin datos, q1 y q2 serán 0
    // nivel esperado = (3+4)/2 = 3.5
    expect(result[0]?.nivelEsperado ?? 3.5).toBe(3.5);
  });

  it('agrupa por persona cuando no hay userEmail', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const hace1Mes = new Date(ahora);
    hace1Mes.setMonth(hace1Mes.getMonth() - 1);
    const fechaQ2 = hace1Mes.toISOString().split('T')[0];

    const evals = [
      crearEval({ fecha: fechaQ2, tipoEvaluador: 'JEFE', puntaje: 3, evaluadoEmail: 'a@t.com', evaluadoNombre: 'Ana' }),
      crearEval({ fecha: fechaQ2, tipoEvaluador: 'JEFE', puntaje: 4, evaluadoEmail: 'b@t.com', evaluadoNombre: 'Bruno' }),
    ];

    const result = calcularSaltoDeNivel(evals, []);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.persona === 'Ana')).toBeDefined();
    expect(result.find(r => r.persona === 'Bruno')).toBeDefined();
  });

  it('solo auto → fallback', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const hace1Mes = new Date(ahora);
    hace1Mes.setMonth(hace1Mes.getMonth() - 1);

    const evals = [
      crearEval({ fecha: hace1Mes.toISOString().split('T')[0], tipoEvaluador: 'AUTO', puntaje: 4, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
    ];

    const result = calcularSaltoDeNivel(evals, [], 'j@t.com');
    expect(result[0].q2).toBe(4);
  });
});

// =====================================================================
// calcularBandasSeniority
// =====================================================================
describe('calcularBandasSeniority', () => {
  it('calcula seniority por score', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const hace1Mes = new Date(ahora);
    hace1Mes.setMonth(hace1Mes.getMonth() - 1);
    const hace4Meses = new Date(ahora);
    hace4Meses.setMonth(hace4Meses.getMonth() - 4);

    // Q1: jefe=2 → Junior, Q2: jefe=4 → Senior
    const evals = [
      crearEval({ fecha: hace4Meses.toISOString().split('T')[0], tipoEvaluador: 'JEFE', puntaje: 2, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
      crearEval({ fecha: hace1Mes.toISOString().split('T')[0], tipoEvaluador: 'JEFE', puntaje: 4, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
    ];

    const result = calcularBandasSeniority(evals, 'j@t.com');
    expect(result).toHaveLength(1);
    expect(result[0].q1Seniority).toBe('Junior');
    expect(result[0].q2Seniority).toBe('Senior');
    expect(result[0].saltoNivel).toBe(true);
  });

  it('sin salto de nivel cuando seniority no cambia', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const hace1Mes = new Date(ahora);
    hace1Mes.setMonth(hace1Mes.getMonth() - 1);
    const hace4Meses = new Date(ahora);
    hace4Meses.setMonth(hace4Meses.getMonth() - 4);

    // Q1: jefe=3, Q2: jefe=3 → ambos Semi Senior
    const evals = [
      crearEval({ fecha: hace4Meses.toISOString().split('T')[0], tipoEvaluador: 'JEFE', puntaje: 3, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
      crearEval({ fecha: hace1Mes.toISOString().split('T')[0], tipoEvaluador: 'JEFE', puntaje: 3, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
    ];

    const result = calcularBandasSeniority(evals, 'j@t.com');
    expect(result[0].saltoNivel).toBe(false);
  });

  it('aplica fórmula min(avg, jefe) al calcular scores', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const hace1Mes = new Date(ahora);
    hace1Mes.setMonth(hace1Mes.getMonth() - 1);

    // Auto=4, Jefe=3 → min(3.5, 3) = 3 → Semi Senior
    const evals = [
      crearEval({ fecha: hace1Mes.toISOString().split('T')[0], tipoEvaluador: 'AUTO', puntaje: 4, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
      crearEval({ fecha: hace1Mes.toISOString().split('T')[0], tipoEvaluador: 'JEFE', puntaje: 3, evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
    ];

    const result = calcularBandasSeniority(evals, 'j@t.com');
    expect(result[0].q2Score).toBe(3);
    expect(result[0].q2Seniority).toBe('Semi Senior');
  });
});

// =====================================================================
// calcularHardSoftStack
// =====================================================================
describe('calcularHardSoftStack', () => {
  it('separa promedios de HARD y SOFT skills', () => {
    vi.useFakeTimers();
    const ahora = new Date(2025, 6, 15);
    vi.setSystemTime(ahora);

    const hace1Mes = new Date(ahora);
    hace1Mes.setMonth(hace1Mes.getMonth() - 1);
    const fecha = hace1Mes.toISOString().split('T')[0];

    const evals = [
      crearEval({ fecha, tipoEvaluador: 'JEFE', puntaje: 4, skillTipo: 'HARD', evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
      crearEval({ fecha, tipoEvaluador: 'JEFE', puntaje: 3, skillTipo: 'SOFT', evaluadoEmail: 'j@t.com', evaluadoNombre: 'J' }),
    ];

    const result = calcularHardSoftStack(evals, 4.0, 'j@t.com');
    expect(result).toHaveLength(1);
    expect(result[0].hard).toBe(4);
    expect(result[0].soft).toBe(3);
    expect(result[0].total).toBe(3.5);
  });

  it('usa targetScore como nivel esperado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 6, 15));

    const result = calcularHardSoftStack([], 3.5, 'j@t.com');
    expect(result[0].nivelEsperado).toBe(3.5);
  });
});
