// src/utils/__tests__/filters.test.ts
import { describe, it, expect } from 'vitest';
import {
  filterEvaluationsByRole,
  getUniqueAreas,
  getUniqueEvaluados,
  canSeeAll,
  canExport,
  getUniqueHardSkillAreas,
} from '../filters';
import { mockUsers, evalMultiArea, crearEval } from '../../test/mockData';
import type { User } from '../../types';

// =====================================================================
// filterEvaluationsByRole — PERMISOS POR ROL (CRÍTICO)
// =====================================================================
describe('filterEvaluationsByRole', () => {
  const userRRHH = mockUsers.find(u => u.rol === 'RRHH')!;
  const userDirector = mockUsers.find(u => u.rol === 'Director')!;
  const userLiderIT = mockUsers.find(u => u.rol === 'Lider' && u.area === 'IT')!;
  const userLiderVentas = mockUsers.find(u => u.rol === 'Lider' && u.area === 'Ventas')!;
  const userAnalistaJuan = mockUsers.find(u => u.email === 'juan@test.com')!;
  const userAnalistaMaria = mockUsers.find(u => u.email === 'maria@test.com')!;

  describe('RRHH', () => {
    it('ve TODAS las evaluaciones', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userRRHH);
      expect(result).toHaveLength(evalMultiArea.length);
    });

    it('ve evaluaciones de todas las áreas', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userRRHH);
      const areas = new Set(result.map(e => e.area));
      expect(areas.has('IT')).toBe(true);
      expect(areas.has('Ventas')).toBe(true);
    });
  });

  describe('Director', () => {
    it('ve TODAS las evaluaciones', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userDirector);
      expect(result).toHaveLength(evalMultiArea.length);
    });
  });

  describe('Líder', () => {
    it('solo ve evaluaciones de su área', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userLiderIT);
      expect(result.every(e => e.area === 'IT')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('NO ve evaluaciones de otras áreas', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userLiderIT);
      expect(result.some(e => e.area === 'Ventas')).toBe(false);
    });

    it('líder de Ventas solo ve Ventas', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userLiderVentas);
      expect(result.every(e => e.area === 'Ventas')).toBe(true);
    });

    it('retorna vacío si no hay evaluaciones de su área', () => {
      const evalsOtraArea = [
        crearEval({ area: 'Marketing', evaluadoEmail: 'x@test.com' }),
      ];
      const result = filterEvaluationsByRole(evalsOtraArea, userLiderIT);
      expect(result).toHaveLength(0);
    });
  });

  describe('Analista', () => {
    it('solo ve sus propias evaluaciones', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userAnalistaJuan);
      expect(result.every(e => e.evaluadoEmail === 'juan@test.com')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('NO ve evaluaciones de otros', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userAnalistaJuan);
      expect(result.some(e => e.evaluadoEmail === 'maria@test.com')).toBe(false);
    });

    it('María solo ve las suyas', () => {
      const result = filterEvaluationsByRole(evalMultiArea, userAnalistaMaria);
      expect(result.every(e => e.evaluadoEmail === 'maria@test.com')).toBe(true);
    });

    it('retorna vacío si no hay evaluaciones propias', () => {
      const evalsOtro = [
        crearEval({ evaluadoEmail: 'otro@test.com', area: 'IT' }),
      ];
      const result = filterEvaluationsByRole(evalsOtro, userAnalistaJuan);
      expect(result).toHaveLength(0);
    });
  });

  describe('Rol no reconocido', () => {
    it('retorna vacío para rol desconocido', () => {
      const fakeUser: User = { email: 'x@test.com', nombre: 'X', rol: 'Otro' as any, area: 'IT' };
      const result = filterEvaluationsByRole(evalMultiArea, fakeUser);
      expect(result).toHaveLength(0);
    });
  });

  it('maneja array vacío de evaluaciones', () => {
    const result = filterEvaluationsByRole([], userRRHH);
    expect(result).toEqual([]);
  });
});

// =====================================================================
// canSeeAll y canExport
// =====================================================================
describe('canSeeAll', () => {
  it('RRHH puede ver todo', () => expect(canSeeAll('RRHH')).toBe(true));
  it('Director puede ver todo', () => expect(canSeeAll('Director')).toBe(true));
  it('Lider NO puede ver todo', () => expect(canSeeAll('Lider')).toBe(false));
  it('Analista NO puede ver todo', () => expect(canSeeAll('Analista')).toBe(false));
});

describe('canExport', () => {
  it('RRHH puede exportar', () => expect(canExport('RRHH')).toBe(true));
  it('Director puede exportar', () => expect(canExport('Director')).toBe(true));
  it('Lider NO puede exportar', () => expect(canExport('Lider')).toBe(false));
  it('Analista NO puede exportar', () => expect(canExport('Analista')).toBe(false));
});

// =====================================================================
// getUniqueAreas
// =====================================================================
describe('getUniqueAreas', () => {
  it('extrae áreas únicas', () => {
    const areas = getUniqueAreas(evalMultiArea);
    expect(areas).toContain('IT');
    expect(areas).toContain('Ventas');
    expect(areas).toHaveLength(2);
  });

  it('ordena alfabéticamente', () => {
    const areas = getUniqueAreas(evalMultiArea);
    expect(areas[0]).toBe('IT');
    expect(areas[1]).toBe('Ventas');
  });

  it('retorna vacío sin evaluaciones', () => {
    expect(getUniqueAreas([])).toEqual([]);
  });

  it('no duplica áreas', () => {
    const evals = [
      crearEval({ area: 'IT' }),
      crearEval({ area: 'IT' }),
      crearEval({ area: 'IT' }),
    ];
    expect(getUniqueAreas(evals)).toEqual(['IT']);
  });
});

// =====================================================================
// getUniqueEvaluados
// =====================================================================
describe('getUniqueEvaluados', () => {
  it('extrae evaluados únicos con nombre completo', () => {
    const evaluados = getUniqueEvaluados(evalMultiArea);
    expect(evaluados).toHaveLength(2);
    expect(evaluados.find(e => e.email === 'juan@test.com')).toBeDefined();
    expect(evaluados.find(e => e.email === 'maria@test.com')).toBeDefined();
  });

  it('ordena por nombre', () => {
    const evaluados = getUniqueEvaluados(evalMultiArea);
    for (let i = 1; i < evaluados.length; i++) {
      expect(evaluados[i].nombre.localeCompare(evaluados[i - 1].nombre)).toBeGreaterThanOrEqual(0);
    }
  });

  it('no duplica evaluados', () => {
    const evals = [
      crearEval({ evaluadoEmail: 'j@t.com', evaluadoNombre: 'Juan' }),
      crearEval({ evaluadoEmail: 'j@t.com', evaluadoNombre: 'Juan' }),
    ];
    expect(getUniqueEvaluados(evals)).toHaveLength(1);
  });

  it('retorna vacío sin evaluaciones', () => {
    expect(getUniqueEvaluados([])).toEqual([]);
  });
});

// =====================================================================
// getUniqueHardSkillAreas
// =====================================================================
describe('getUniqueHardSkillAreas', () => {
  it('solo retorna áreas de HARD skills', () => {
    const evals = [
      crearEval({ skillTipo: 'HARD', area: 'IT' }),
      crearEval({ skillTipo: 'SOFT', area: 'Ventas' }),
      crearEval({ skillTipo: 'HARD', area: 'Marketing' }),
    ];
    const areas = getUniqueHardSkillAreas(evals);
    expect(areas).toContain('IT');
    expect(areas).toContain('Marketing');
    expect(areas).not.toContain('Ventas');
  });

  it('retorna vacío si no hay HARD skills', () => {
    const evals = [crearEval({ skillTipo: 'SOFT', area: 'IT' })];
    expect(getUniqueHardSkillAreas(evals)).toEqual([]);
  });
});
