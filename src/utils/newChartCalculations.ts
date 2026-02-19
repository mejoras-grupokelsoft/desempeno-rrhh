// Funciones para los nuevos gráficos de RRHH

/**
 * Opción 1: Gráfico de "Salto de Nivel" (Barras Agrupadas con Línea de Referencia)
 * Muestra Q1 vs Q2 por persona con línea de nivel esperado
 */
export function calcularSaltoDeNivel<T extends {
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  tipoEvaluador: string;
  puntaje: number;
  skillTipo?: string;
}>(
  evaluations: T[],
  targetSkills: Array<{ skill: string; valorEsperado: number }>,
  userEmail?: string,
  origen?: 'ANALISTA' | 'LIDER'
) {
  let evals = evaluations;

  if (userEmail) {
    evals = evals.filter(e => e.evaluadoEmail === userEmail);
  }

  if (origen) {
    evals = evals.filter(e => (e as any).origen === origen);
  }

  const ahora = new Date();
  const hace3Meses = new Date(ahora);
  hace3Meses.setMonth(hace3Meses.getMonth() - 3);
  const hace6Meses = new Date(ahora);
  hace6Meses.setMonth(hace6Meses.getMonth() - 6);

  // Q2: Últimos 3 meses
  const evalsQ2 = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });

  // Q1: 3-6 meses atrás
  const evalsQ1 = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace6Meses && date < hace3Meses;
  });

  // Calcular promedio unificado: min((Auto + Jefe) / 2, Jefe)
  const calcularPromedio = (evalSet: T[]) => {
    const autoSum = evalSet.filter(e => e.tipoEvaluador === 'AUTO').reduce((sum, e) => sum + e.puntaje, 0);
    const autoCount = evalSet.filter(e => e.tipoEvaluador === 'AUTO').length;
    const jefeSum = evalSet.filter(e => e.tipoEvaluador === 'JEFE').reduce((sum, e) => sum + e.puntaje, 0);
    const jefeCount = evalSet.filter(e => e.tipoEvaluador === 'JEFE').length;

    const autoAvg = autoCount > 0 ? autoSum / autoCount : 0;
    const jefeAvg = jefeCount > 0 ? jefeSum / jefeCount : 0;

    return autoAvg > 0 && jefeAvg > 0 ? Math.min((autoAvg + jefeAvg) / 2, jefeAvg) : (autoAvg || jefeAvg);
  };

  // Si no hay userEmail, agrupar por persona
  if (!userEmail) {
    const personasMap = new Map<string, { nombre: string; q1: number; q2: number }>();

    evals.forEach(e => {
      if (!personasMap.has(e.evaluadoEmail)) {
        personasMap.set(e.evaluadoEmail, {
          nombre: e.evaluadoNombre,
          q1: 0,
          q2: 0
        });
      }
    });

    personasMap.forEach((data, email) => {
      const personaQ1 = evalsQ1.filter(e => e.evaluadoEmail === email);
      const personaQ2 = evalsQ2.filter(e => e.evaluadoEmail === email);

      data.q1 = calcularPromedio(personaQ1);
      data.q2 = calcularPromedio(personaQ2);
    });

    const nivelEsperado = targetSkills.length > 0
      ? targetSkills.reduce((sum, t) => sum + t.valorEsperado, 0) / targetSkills.length
      : 3;

    return Array.from(personasMap.entries()).map(([_email, data]) => ({
      persona: data.nombre,
      q1: data.q1,
      q2: data.q2,
      nivelEsperado,
      cambio: data.q2 - data.q1
    }));
  }

  // Para una persona específica
  const q1 = calcularPromedio(evalsQ1);
  const q2 = calcularPromedio(evalsQ2);
  const nivelEsperado = targetSkills.length > 0
    ? targetSkills.reduce((sum, t) => sum + t.valorEsperado, 0) / targetSkills.length
    : 3;

  return [{
    persona: evals[0]?.evaluadoNombre || userEmail || 'Usuario',
    q1,
    q2,
    nivelEsperado,
    cambio: q2 - q1
  }];
}

/**
 * Opción 2: Barras Apiladas "Hard + Soft"
 * Muestra composición de Hard y Soft Skills por persona
 */
export function calcularHardSoftStack<T extends {
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  tipoEvaluador: string;
  puntaje: number;
  skillTipo: string;
}>(
  evaluations: T[],
  targetScore: number = 4.0,
  userEmail?: string,
  origen?: 'ANALISTA' | 'LIDER'
) {
  let evals = evaluations;

  if (userEmail) {
    evals = evals.filter(e => e.evaluadoEmail === userEmail);
  }

  if (origen) {
    evals = evals.filter(e => (e as any).origen === origen);
  }

  // Solo últimos 3 meses
  const ahora = new Date();
  const hace3Meses = new Date(ahora);
  hace3Meses.setMonth(hace3Meses.getMonth() - 3);

  evals = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });

  // Calcular promedio Hard y Soft por persona
  const calcularPromedios = (evalSet: T[]) => {
    const hardEvals = evalSet.filter(e => e.skillTipo === 'HARD');
    const softEvals = evalSet.filter(e => e.skillTipo === 'SOFT');

    const calcPromedio = (subset: T[]) => {
      const autoSum = subset.filter(e => e.tipoEvaluador === 'AUTO').reduce((sum, e) => sum + e.puntaje, 0);
      const autoCount = subset.filter(e => e.tipoEvaluador === 'AUTO').length;
      const jefeSum = subset.filter(e => e.tipoEvaluador === 'JEFE').reduce((sum, e) => sum + e.puntaje, 0);
      const jefeCount = subset.filter(e => e.tipoEvaluador === 'JEFE').length;

      const autoAvg = autoCount > 0 ? autoSum / autoCount : 0;
      const jefeAvg = jefeCount > 0 ? jefeSum / jefeCount : 0;

      return autoAvg > 0 && jefeAvg > 0 ? Math.min((autoAvg + jefeAvg) / 2, jefeAvg) : (autoAvg || jefeAvg);
    };

    return {
      hard: calcPromedio(hardEvals),
      soft: calcPromedio(softEvals)
    };
  };

  // Si no hay userEmail, agrupar por persona
  if (!userEmail) {
    const personasMap = new Map<string, { nombre: string; hard: number; soft: number }>();

    evals.forEach(e => {
      if (!personasMap.has(e.evaluadoEmail)) {
        personasMap.set(e.evaluadoEmail, {
          nombre: e.evaluadoNombre,
          hard: 0,
          soft: 0
        });
      }
    });

    personasMap.forEach((data, email) => {
      const personaEvals = evals.filter(e => e.evaluadoEmail === email);
      const promedios = calcularPromedios(personaEvals);
      data.hard = promedios.hard;
      data.soft = promedios.soft;
    });

    return Array.from(personasMap.values()).map(data => ({
      persona: data.nombre,
      hard: data.hard,
      soft: data.soft,
      total: (data.hard + data.soft) / 2,
      nivelEsperado: targetScore
    }));
  }

  // Para una persona específica
  const promedios = calcularPromedios(evals);
  return [{
    persona: evals[0]?.evaluadoNombre || userEmail || 'Usuario',
    hard: promedios.hard,
    soft: promedios.soft,
    total: (promedios.hard + promedios.soft) / 2,
    nivelEsperado: targetScore
  }];
}

/**
 * Opción 3: Gráfico de Bandas de Seniority
 * Muestra evolución de personas entre bandas de seniority
 */
export function calcularBandasSeniority<T extends {
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  tipoEvaluador: string;
  puntaje: number;
}>(
  evaluations: T[],
  userEmail?: string,
  origen?: 'ANALISTA' | 'LIDER'
) {
  let evals = evaluations;

  if (userEmail) {
    evals = evals.filter(e => e.evaluadoEmail === userEmail);
  }

  if (origen) {
    evals = evals.filter(e => (e as any).origen === origen);
  }

  const ahora = new Date();
  const hace3Meses = new Date(ahora);
  hace3Meses.setMonth(hace3Meses.getMonth() - 3);
  const hace6Meses = new Date(ahora);
  hace6Meses.setMonth(hace6Meses.getMonth() - 6);

  // Q2: Últimos 3 meses
  const evalsQ2 = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });

  // Q1: 3-6 meses atrás
  const evalsQ1 = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace6Meses && date < hace3Meses;
  });

  // Calcular promedio unificado: min((Auto + Jefe) / 2, Jefe)
  const calcularPromedio = (evalSet: T[]) => {
    const autoSum = evalSet.filter(e => e.tipoEvaluador === 'AUTO').reduce((sum, e) => sum + e.puntaje, 0);
    const autoCount = evalSet.filter(e => e.tipoEvaluador === 'AUTO').length;
    const jefeSum = evalSet.filter(e => e.tipoEvaluador === 'JEFE').reduce((sum, e) => sum + e.puntaje, 0);
    const jefeCount = evalSet.filter(e => e.tipoEvaluador === 'JEFE').length;

    const autoAvg = autoCount > 0 ? autoSum / autoCount : 0;
    const jefeAvg = jefeCount > 0 ? jefeSum / jefeCount : 0;

    return autoAvg > 0 && jefeAvg > 0 ? Math.min((autoAvg + jefeAvg) / 2, jefeAvg) : (autoAvg || jefeAvg);
  };

  const getSeniority = (score: number): string => {
    if (score >= 3) return 'Senior';
    if (score >= 2) return 'Semi Senior';
    if (score >= 1) return 'Junior';
    return 'Trainee';
  };

  // Si no hay userEmail, agrupar por persona
  if (!userEmail) {
    const personasMap = new Map<string, { nombre: string; q1: number; q2: number }>();

    evals.forEach(e => {
      if (!personasMap.has(e.evaluadoEmail)) {
        personasMap.set(e.evaluadoEmail, {
          nombre: e.evaluadoNombre,
          q1: 0,
          q2: 0
        });
      }
    });

    personasMap.forEach((data, email) => {
      const personaQ1 = evalsQ1.filter(e => e.evaluadoEmail === email);
      const personaQ2 = evalsQ2.filter(e => e.evaluadoEmail === email);

      data.q1 = calcularPromedio(personaQ1);
      data.q2 = calcularPromedio(personaQ2);
    });

    return Array.from(personasMap.values()).map(data => ({
      persona: data.nombre,
      q1Score: data.q1,
      q2Score: data.q2,
      q1Seniority: getSeniority(data.q1),
      q2Seniority: getSeniority(data.q2),
      cambio: data.q2 - data.q1,
      saltoNivel: getSeniority(data.q1) !== getSeniority(data.q2)
    }));
  }

  // Para una persona específica
  const q1 = calcularPromedio(evalsQ1);
  const q2 = calcularPromedio(evalsQ2);

  return [{
    persona: evals[0]?.evaluadoNombre || userEmail || 'Usuario',
    q1Score: q1,
    q2Score: q2,
    q1Seniority: getSeniority(q1),
    q2Seniority: getSeniority(q2),
    cambio: q2 - q1,
    saltoNivel: getSeniority(q1) !== getSeniority(q2)
  }];
}

/**
 * Función para calcular el desglose de skills individuales (Hard vs Soft)
 * para el drill-down de una persona específica
 */
export function calcularDesgloseSkills<T extends {
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  tipoEvaluador: string;
  puntaje: number;
  skillNombre: string;
  skillTipo: 'HARD' | 'SOFT';
}>(
  evaluations: T[],
  userEmail: string
) {
  // Filtrar evaluaciones de la persona
  const evals = evaluations.filter(e => e.evaluadoEmail === userEmail);

  const ahora = new Date();
  const hace3Meses = new Date(ahora);
  hace3Meses.setMonth(hace3Meses.getMonth() - 3);
  const hace6Meses = new Date(ahora);
  hace6Meses.setMonth(hace6Meses.getMonth() - 6);

  // Q2: Últimos 3 meses
  const evalsQ2 = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });

  // Q1: 3-6 meses atrás
  const evalsQ1 = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace6Meses && date < hace3Meses;
  });

  // Calcular promedio unificado (Auto + Jefe) / 2 por skill
  const calcularPromedioPorSkill = (evalSet: T[], skillNombre: string) => {
    const skillEvals = evalSet.filter(e => e.skillNombre === skillNombre);
    const autoSum = skillEvals.filter(e => e.tipoEvaluador === 'AUTO').reduce((sum, e) => sum + e.puntaje, 0);
    const autoCount = skillEvals.filter(e => e.tipoEvaluador === 'AUTO').length;
    const jefeSum = skillEvals.filter(e => e.tipoEvaluador === 'JEFE').reduce((sum, e) => sum + e.puntaje, 0);
    const jefeCount = skillEvals.filter(e => e.tipoEvaluador === 'JEFE').length;

    const autoAvg = autoCount > 0 ? autoSum / autoCount : 0;
    const jefeAvg = jefeCount > 0 ? jefeSum / jefeCount : 0;

    return autoAvg > 0 && jefeAvg > 0 ? (autoAvg + jefeAvg) / 2 : (autoAvg || jefeAvg);
  };

  // Obtener lista única de skills
  const skillsUnicas = Array.from(new Set(evals.map(e => e.skillNombre)));

  const hardSkills: Array<{
    skill: string;
    q1: number;
    q2: number;
    cambio: number;
    estado: string;
  }> = [];

  const softSkills: Array<{
    skill: string;
    q1: number;
    q2: number;
    cambio: number;
    estado: string;
  }> = [];

  skillsUnicas.forEach(skillNombre => {
    const skillEval = evals.find(e => e.skillNombre === skillNombre);
    if (!skillEval) return;

    const q1 = calcularPromedioPorSkill(evalsQ1, skillNombre);
    const q2 = calcularPromedioPorSkill(evalsQ2, skillNombre);
    const cambio = q2 - q1;

    let estado = '🟡 Junior';
    if (q2 >= 3) estado = '🟢 Senior';
    else if (q2 >= 2) estado = '🔵 Semi Senior';
    else if (q2 >= 1) estado = '🟡 Junior';
    else estado = '🟠 Trainee';

    const skillData = {
      skill: skillNombre,
      q1,
      q2,
      cambio,
      estado
    };

    if (skillEval.skillTipo === 'HARD') {
      hardSkills.push(skillData);
    } else {
      softSkills.push(skillData);
    }
  });

  // Calcular la mayor brecha (skill con menor puntaje Q2)
  const todasLasSkills = [...hardSkills, ...softSkills];
  const mayorBrecha = todasLasSkills.length > 0
    ? todasLasSkills.reduce((min, skill) => skill.q2 < min.q2 ? skill : min)
    : null;

  return {
    hardSkills: hardSkills.sort((a, b) => b.q2 - a.q2), // Ordenar por puntaje Q2 descendente
    softSkills: softSkills.sort((a, b) => b.q2 - a.q2),
    mayorBrecha: mayorBrecha?.skill || null,
    promediHard: hardSkills.length > 0 
      ? hardSkills.reduce((sum, s) => sum + s.q2, 0) / hardSkills.length 
      : 0,
    promediSoft: softSkills.length > 0 
      ? softSkills.reduce((sum, s) => sum + s.q2, 0) / softSkills.length 
      : 0
  };
}

/**
 * Función para comparar skills entre dos periodos DINÁMICOS
 * Q2 = últimos 3 meses | Q1 = 3-6 meses atrás
 */
export function compararSkillsPorPeriodo<T extends {
  fecha: string;
  evaluadoEmail: string;
  tipoEvaluador: string;
  puntaje: number;
  skillNombre: string;
  skillTipo: 'HARD' | 'SOFT';
}>(
  evaluations: T[],
  userEmail: string,
  _periodoA: string, // Se ignora, se usa para display
  _periodoB: string  // Se ignora, se usa para display
) {
  // Filtrar evaluaciones de la persona
  const evals = evaluations.filter(e => e.evaluadoEmail === userEmail);

  if (evals.length === 0) {
    return [];
  }

  // Usar la misma lógica que calcularBandasSeniority
  const ahora = new Date();
  const hace3Meses = new Date(ahora);
  hace3Meses.setMonth(hace3Meses.getMonth() - 3);
  const hace6Meses = new Date(ahora);
  hace6Meses.setMonth(hace6Meses.getMonth() - 6);

  // Q2: Últimos 3 meses (ACTUAL)
  const evalsB = evals.filter(e => {
    const date = new Date(e.fecha);
    return date >= hace3Meses;
  });

  // Período A: CUALQUIER dato de más de 3 meses atrás (flexible para evaluaciones semestrales/anuales)
  const evalsA = evals.filter(e => {
    const date = new Date(e.fecha);
    return date < hace3Meses; // Todo lo anterior a los últimos 3 meses
  });

  // Calcular promedio unificado (Auto + Jefe) / 2 por skill
  const calcularPromedioPorSkill = (evalSet: T[], skillNombre: string) => {
    const skillEvals = evalSet.filter(e => e.skillNombre === skillNombre);
    if (skillEvals.length === 0) return 0;

    const autoSum = skillEvals.filter(e => e.tipoEvaluador === 'AUTO').reduce((sum, e) => sum + e.puntaje, 0);
    const autoCount = skillEvals.filter(e => e.tipoEvaluador === 'AUTO').length;
    const jefeSum = skillEvals.filter(e => e.tipoEvaluador === 'JEFE').reduce((sum, e) => sum + e.puntaje, 0);
    const jefeCount = skillEvals.filter(e => e.tipoEvaluador === 'JEFE').length;

    const autoAvg = autoCount > 0 ? autoSum / autoCount : 0;
    const jefeAvg = jefeCount > 0 ? jefeSum / jefeCount : 0;

    return autoAvg > 0 && jefeAvg > 0 ? (autoAvg + jefeAvg) / 2 : (autoAvg || jefeAvg);
  };

  // Obtener lista única de skills
  const skillsUnicas = Array.from(new Set(evals.map(e => e.skillNombre)));

  const resultados = skillsUnicas.map(skillNombre => {
    const skillEval = evals.find(e => e.skillNombre === skillNombre);
    if (!skillEval) return null;

    const scoreA = calcularPromedioPorSkill(evalsA, skillNombre);
    const scoreB = calcularPromedioPorSkill(evalsB, skillNombre);
    const cambio = scoreB - scoreA;

    return {
      skill: skillNombre,
      skillTipo: skillEval.skillTipo,
      scoreA,
      scoreB,
      cambio
    };
  }).filter(r => r !== null) as Array<{
    skill: string;
    skillTipo: 'HARD' | 'SOFT';
    scoreA: number;
    scoreB: number;
    cambio: number;
  }>;

  return resultados.sort((a, b) => Math.abs(b.cambio) - Math.abs(a.cambio)); // Ordenar por mayor cambio
}
