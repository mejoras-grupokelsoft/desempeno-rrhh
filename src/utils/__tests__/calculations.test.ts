// src/utils/__tests__/calculations.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcularPromedio,
  obtenerValorEsperado,
  transformarARadarData,
  calcularSeniorityAlcanzado,
  calcularPromedioGeneral,
  determinarEstado,
  calcularEvolucionSemestral,
} from '../calculations';
import {
  crearEval,
  resetEvalCounter,
  evalAutoAltoJefeBajo,
  evalAutoBajoJefeAlto,
  evalIguales,
  evalSoloAuto,
  evalSoloJefe,
  evalMultiSkill,
  evalMultiTrimestre,
  mockSkillsMatrix,
} from '../../test/mockData';

beforeEach(() => {
  resetEvalCounter();
});

// =====================================================================
// calcularPromedio
// =====================================================================
describe('calcularPromedio', () => {
  it('calcula promedio de AUTO para una skill', () => {
    const evals = [
      crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 3 }),
      crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 4 }),
      crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'JS', puntaje: 2 }), // ignorado
    ];
    expect(calcularPromedio(evals, 'AUTO', 'JS')).toBe(3.5);
  });

  it('calcula promedio de JEFE para una skill', () => {
    const evals = [
      crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'React', puntaje: 4 }),
      crearEval({ tipoEvaluador: 'JEFE', skillNombre: 'React', puntaje: 2 }),
    ];
    expect(calcularPromedio(evals, 'JEFE', 'React')).toBe(3);
  });

  it('retorna 0 cuando no hay evaluaciones del tipo', () => {
    const evals = [
      crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 3 }),
    ];
    expect(calcularPromedio(evals, 'JEFE', 'JS')).toBe(0);
  });

  it('retorna 0 cuando no hay evaluaciones de la skill', () => {
    const evals = [
      crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 3 }),
    ];
    expect(calcularPromedio(evals, 'AUTO', 'React')).toBe(0);
  });

  it('retorna 0 con array vacío', () => {
    expect(calcularPromedio([], 'AUTO', 'JS')).toBe(0);
  });

  it('maneja evaluación única correctamente', () => {
    const evals = [crearEval({ tipoEvaluador: 'AUTO', skillNombre: 'JS', puntaje: 4 })];
    expect(calcularPromedio(evals, 'AUTO', 'JS')).toBe(4);
  });
});

// =====================================================================
// obtenerValorEsperado
// =====================================================================
describe('obtenerValorEsperado', () => {
  it('encuentra valor esperado en la matriz', () => {
    expect(obtenerValorEsperado(mockSkillsMatrix, 'JavaScript', 'Junior', 'Analista', 'IT')).toBe(2);
  });

  it('encuentra valor para Semi Senior', () => {
    expect(obtenerValorEsperado(mockSkillsMatrix, 'JavaScript', 'Semi Senior', 'Analista', 'IT')).toBe(3);
  });

  it('retorna 0 si no encuentra la skill', () => {
    expect(obtenerValorEsperado(mockSkillsMatrix, 'Python', 'Junior', 'Analista', 'IT')).toBe(0);
  });

  it('retorna 0 si no encuentra el seniority', () => {
    expect(obtenerValorEsperado(mockSkillsMatrix, 'JavaScript', 'Trainee', 'Analista', 'IT')).toBe(0);
  });

  it('retorna 0 si no encuentra el área', () => {
    expect(obtenerValorEsperado(mockSkillsMatrix, 'JavaScript', 'Junior', 'Analista', 'Ventas')).toBe(0);
  });

  it('retorna 0 con matriz vacía', () => {
    expect(obtenerValorEsperado([], 'JavaScript', 'Junior', 'Analista', 'IT')).toBe(0);
  });
});

// =====================================================================
// transformarARadarData — FÓRMULA min((auto + jefe) / 2, jefe)
// =====================================================================
describe('transformarARadarData', () => {
  it('Auto > Jefe → usa jefe (auto=4, jefe=3 → 3)', () => {
    const result = transformarARadarData(evalAutoAltoJefeBajo, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result).toHaveLength(1);
    expect(result[0].auto).toBe(4);
    expect(result[0].jefe).toBe(3);
    // min((4+3)/2, 3) = min(3.5, 3) = 3
    expect(result[0].promedio).toBe(3);
  });

  it('Auto < Jefe → usa promedio (auto=2, jefe=4 → 3)', () => {
    const result = transformarARadarData(evalAutoBajoJefeAlto, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result[0].auto).toBe(2);
    expect(result[0].jefe).toBe(4);
    // min((2+4)/2, 4) = min(3, 4) = 3
    expect(result[0].promedio).toBe(3);
  });

  it('Auto = Jefe → usa ambos igualmente (auto=3, jefe=3 → 3)', () => {
    const result = transformarARadarData(evalIguales, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    // min((3+3)/2, 3) = min(3, 3) = 3
    expect(result[0].promedio).toBe(3);
  });

  it('Solo Auto → usa auto directamente', () => {
    const result = transformarARadarData(evalSoloAuto, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result[0].auto).toBe(4);
    expect(result[0].jefe).toBe(0);
    expect(result[0].promedio).toBe(4); // fallback: auto
  });

  it('Solo Jefe → usa jefe directamente', () => {
    const result = transformarARadarData(evalSoloJefe, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result[0].auto).toBe(0);
    expect(result[0].jefe).toBe(3);
    expect(result[0].promedio).toBe(3); // fallback: jefe
  });

  it('incluye valor esperado de la skills matrix', () => {
    const result = transformarARadarData(evalAutoAltoJefeBajo, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result[0].esperado).toBe(2); // Junior JS en IT = 2
  });

  it('maneja múltiples skills correctamente', () => {
    const result = transformarARadarData(evalMultiSkill, mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result.length).toBeGreaterThanOrEqual(3);

    const js = result.find(r => r.skill === 'JavaScript')!;
    const react = result.find(r => r.skill === 'React')!;
    const comm = result.find(r => r.skill === 'Comunicación')!;

    expect(js.promedio).toBe(3);   // min(3.5, 3) = 3
    expect(react.promedio).toBe(3); // min(3, 4) = 3
    expect(comm.promedio).toBe(3);  // min(3, 3) = 3
  });

  it('retorna array vacío sin evaluaciones', () => {
    const result = transformarARadarData([], mockSkillsMatrix, 'Junior', 'Analista', 'IT');
    expect(result).toEqual([]);
  });
});

// =====================================================================
// calcularSeniorityAlcanzado
// =====================================================================
describe('calcularSeniorityAlcanzado', () => {
  it('promedio >= 3.0 → Senior', () => {
    expect(calcularSeniorityAlcanzado(3.0)).toBe('Senior');
    expect(calcularSeniorityAlcanzado(4.5)).toBe('Senior');
  });

  it('promedio >= 2.0 y < 3.0 → Semi Senior', () => {
    expect(calcularSeniorityAlcanzado(2.0)).toBe('Semi Senior');
    expect(calcularSeniorityAlcanzado(2.99)).toBe('Semi Senior');
  });

  it('promedio >= 1.0 y < 2.0 → Junior', () => {
    expect(calcularSeniorityAlcanzado(1.0)).toBe('Junior');
    expect(calcularSeniorityAlcanzado(1.99)).toBe('Junior');
  });

  it('promedio < 1.0 → Trainee', () => {
    expect(calcularSeniorityAlcanzado(0.99)).toBe('Trainee');
    expect(calcularSeniorityAlcanzado(0)).toBe('Trainee');
    expect(calcularSeniorityAlcanzado(0.5)).toBe('Trainee');
  });

  it('valores exactos en los límites', () => {
    expect(calcularSeniorityAlcanzado(1.0)).toBe('Junior');
    expect(calcularSeniorityAlcanzado(2.0)).toBe('Semi Senior');
    expect(calcularSeniorityAlcanzado(3.0)).toBe('Senior');
  });
});

// =====================================================================
// calcularPromedioGeneral
// =====================================================================
describe('calcularPromedioGeneral', () => {
  it('calcula promedio de todos los puntos radar', () => {
    const data = [
      { skill: 'JS', esperado: 3, auto: 3, jefe: 4, promedio: 3 },
      { skill: 'React', esperado: 3, auto: 2, jefe: 4, promedio: 3 },
      { skill: 'CSS', esperado: 2, auto: 4, jefe: 4, promedio: 4 },
    ];
    // (3 + 3 + 4) / 3 = 3.333...
    expect(calcularPromedioGeneral(data)).toBeCloseTo(3.333, 2);
  });

  it('retorna 0 con array vacío', () => {
    expect(calcularPromedioGeneral([])).toBe(0);
  });

  it('con un solo dato retorna ese promedio', () => {
    const data = [{ skill: 'JS', esperado: 3, auto: 3, jefe: 3, promedio: 3 }];
    expect(calcularPromedioGeneral(data)).toBe(3);
  });
});

// =====================================================================
// determinarEstado
// =====================================================================
describe('determinarEstado', () => {
  it('mismo seniority → Cumple', () => {
    expect(determinarEstado('Junior', 'Junior')).toBe('Cumple');
    expect(determinarEstado('Senior', 'Senior')).toBe('Cumple');
  });

  it('seniority mayor al esperado → Superó', () => {
    expect(determinarEstado('Semi Senior', 'Junior')).toBe('Superó');
    expect(determinarEstado('Senior', 'Trainee')).toBe('Superó');
  });

  it('seniority menor al esperado → No Cumple', () => {
    expect(determinarEstado('Trainee', 'Junior')).toBe('No Cumple');
    expect(determinarEstado('Junior', 'Senior')).toBe('No Cumple');
  });
});

// =====================================================================
// calcularEvolucionSemestral
// =====================================================================
describe('calcularEvolucionSemestral', () => {
  it('agrupa evaluaciones por semestre', () => {
    const result = calcularEvolucionSemestral(evalMultiTrimestre, mockSkillsMatrix, 'Junior', 'IT');
    expect(result).toHaveLength(3); // S1 2024, S2 2024, S1 2025
  });

  it('ordena semestres cronológicamente', () => {
    const result = calcularEvolucionSemestral(evalMultiTrimestre, mockSkillsMatrix, 'Junior', 'IT');
    expect(result[0].semestre).toContain('S1');
    expect(result[1].semestre).toContain('S2');
    expect(result[2].semestre).toContain('S1');
  });

  it('aplica fórmula min(avg, jefe) por semestre', () => {
    const result = calcularEvolucionSemestral(evalMultiTrimestre, mockSkillsMatrix, 'Junior', 'IT');

    // S1 2024: auto=2, jefe=2 → min(2, 2) = 2
    expect(result[0].promedio).toBe(2);
    expect(result[0].auto).toBe(2);
    expect(result[0].jefe).toBe(2);

    // S2 2024: auto=3, jefe=3 → min(3, 3) = 3
    expect(result[1].promedio).toBe(3);

    // S1 2025: auto=4, jefe=3 → min(3.5, 3) = 3
    expect(result[2].promedio).toBe(3);
    expect(result[2].auto).toBe(4);
    expect(result[2].jefe).toBe(3);
  });

  it('incluye valor esperado constante', () => {
    const result = calcularEvolucionSemestral(evalMultiTrimestre, mockSkillsMatrix, 'Junior', 'IT');
    // Todos los semestres tienen el mismo esperado
    const esperado = result[0].esperado;
    expect(esperado).toBeGreaterThan(0);
    result.forEach(r => expect(r.esperado).toBe(esperado));
  });

  it('retorna vacío sin evaluaciones', () => {
    expect(calcularEvolucionSemestral([], mockSkillsMatrix, 'Junior', 'IT')).toEqual([]);
  });

  it('maneja semestre con solo auto', () => {
    const soloAuto = [
      crearEval({ fecha: '2025-01-15', tipoEvaluador: 'AUTO', skillNombre: 'JavaScript', puntaje: 4 }),
    ];
    const result = calcularEvolucionSemestral(soloAuto, mockSkillsMatrix, 'Junior', 'IT');
    expect(result[0].promedio).toBe(4); // fallback a auto
    expect(result[0].jefe).toBe(0);
  });

  it('maneja semestre con solo jefe', () => {
    const soloJefe = [
      crearEval({ fecha: '2025-01-15', tipoEvaluador: 'JEFE', skillNombre: 'JavaScript', puntaje: 3 }),
    ];
    const result = calcularEvolucionSemestral(soloJefe, mockSkillsMatrix, 'Junior', 'IT');
    expect(result[0].promedio).toBe(3); // fallback a jefe
    expect(result[0].auto).toBe(0);
  });
});
