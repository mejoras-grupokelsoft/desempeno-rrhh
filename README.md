# Dashboard de Evaluación de Desempeño — RRHH

Dashboard serverless para la gestión y visualización de evaluaciones de desempeño por competencias (Hard Skills y Soft Skills), con vistas diferenciadas por rol y evolución semestral.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Gráficos | Recharts (radar, líneas, barras) |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Google OAuth + soft auth por email |
| Deploy | Netlify |

## Funcionalidades principales

- **Vistas por rol**: RRHH, Director, Líder y Analista con permisos diferenciados
- **Evaluación por competencias**: Hard Skills y Soft Skills con puntaje 1–5
- **Pentágonos de radar**: Autoevaluación + Evaluación Jefe + Promedio + Esperado superpuestos
- **Evolución semestral**: Gráfico de barras histórico + líneas Hard/Soft comparando los dos últimos semestres
- **Análisis de brechas**: Skills que mejoraron, se mantuvieron o bajaron entre períodos
- **Seniority dinámico**: Cálculo automático de nivel alcanzado vs esperado
- **Exportación PDF**: Reporte individual por persona
- **Formulario de evaluación**: Integrado para autoevaluación y evaluación de equipo

## Estructura del proyecto

```
src/
├── components/         # Componentes de UI (Dashboard, vistas por rol, gráficos)
├── context/            # AppContext (usuarios, evaluaciones, skills matrix)
├── hooks/              # useEvaluations, useTeamAccess
├── lib/                # supabase.ts, supabaseQueries.ts, adapters.ts
├── types/              # Interfaces TypeScript (Evaluation, User, SkillMatrix...)
└── utils/              # calculations.ts, dateUtils.ts, filters.ts, pdfGenerator.ts
```

## Modelo de datos (Supabase)

```
evaluations          → registro de evaluación por persona y período
  └── responses      → respuestas por pregunta
        └── questions → preguntas mapeadas a skills
              └── skills → catálogo de habilidades (HARD / SOFT)

users                → empleados con rol y área
skills_matrix        → puntaje esperado por skill, seniority y área
areas                → áreas de la empresa
```

## Roles y permisos

| Rol | Puede ver |
|---|---|
| RRHH | Todo — todas las áreas y personas |
| Director | Todo — solo lectura |
| Líder | Su área + su propio desempeño |
| Analista | Solo su propio desempeño |

## Variables de entorno

Crear un archivo `.env` en la raíz (nunca commitear):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

## Comandos

```bash
npm install       # Instalar dependencias
npm run dev       # Servidor de desarrollo (localhost:5173)
npm run build     # Build de producción
npm run preview   # Preview del build
```

## Deploy

El proyecto se despliega automáticamente en Netlify desde la rama `main`. Las variables de entorno se configuran en el panel de Netlify UI.
