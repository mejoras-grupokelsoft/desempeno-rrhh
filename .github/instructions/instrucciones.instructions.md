---
applyTo: '**'
---

# Dashboard de Evaluación de Desempeño RRHH - Instrucciones para AI

## Contexto del Proyecto
Este es un dashboard serverless de evaluación de desempeño de RRHH usando:
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS (deployed en Netlify)
- **Backend**: Google Sheets como base de datos + Google Apps Script como REST API (ya implementado)
- **Autenticación**: Soft auth por email (sin contraseñas)
- **Visualización**: Gráficos de radar (Recharts) para evaluar habilidades

## Reglas de Seguridad CRÍTICAS

### ❌ NUNCA:
1. Hardcodear URLs de Google Apps Script o API keys
2. Commitear archivos `.env`
3. Exponer credenciales de Google en el frontend
4. Hacer `console.log()` de datos sensibles en producción
5. Incluir emails reales en tests o ejemplos

### ✅ SIEMPRE:
1. Usar variables de entorno: `import.meta.env.VITE_GOOGLE_SCRIPT_URL`
2. Mantener `.env` en `.gitignore`
3. Validar permisos de usuario en cada vista sensible
4. Sanitizar inputs del usuario
5. Limpiar localStorage al hacer logout

## Estructura de Datos (TypeScript)

```typescript
export type UserRole = 'RRHH' | 'Director' | 'Lider' | 'Analista';
export type EvaluatorType = 'AUTO' | 'JEFE';
export type SkillType = 'HARD' | 'SOFT';

export interface User {
  email: string;
  nombre: string;
  rol: UserRole;
  area: string;
  foto?: string;
}

export interface Evaluation {
  id: string;
  fecha: string;
  evaluadoEmail: string;
  evaluadoNombre: string;
  tipoEvaluador: EvaluatorType;
  skillTipo: SkillType;
  skillNombre: string;
  puntaje: 1 | 2 | 3 | 4 | 5;
  area: string;
}

export interface ApiResponse {
  users: User[];
  evaluations: Evaluation[];
  skills_matrix: { seniority: string; skill: string; valorEsperado: number; }[];
}
```

## Sistema de Permisos por Rol

```typescript
const PERMISSIONS = {
  'RRHH': { canSeeAll: true, canExport: true, canEdit: true },
  'Director': { canSeeAll: true, canExport: true, canEdit: false },
  'Lider': { canSeeArea: true, canExport: false, canEdit: false },
  'Analista': { canSeeSelf: true, canExport: false, canEdit: false }
};
```

### Implementación de Filtros:
```typescript
// Filtrar evaluaciones según rol del usuario
const visibleEvaluations = evaluations.filter(eval => {
  if (user.rol === 'RRHH' || user.rol === 'Director') return true;
  if (user.rol === 'Lider') return eval.area === user.area;
  if (user.rol === 'Analista') return eval.evaluadoEmail === user.email;
  return false;
});
```

## Lógica de Visualización de Pentágonos

### Estructura de Pentágonos (Recharts Radar)
Para cada evaluado se muestran **4 pentágonos superpuestos**:

1. **Pentágono Esperado (Target)**: 
   - Color: Gris claro (línea punteada)
   - Fuente: `skills_matrix` filtrado por seniority + área del evaluado
   - Representa lo que RRHH espera para ese nivel

2. **Pentágono Autoevaluación (AUTO)**:
   - Color: Azul
   - Fuente: `evaluations` donde `tipoEvaluador === "AUTO"`
   - Lo que el empleado cree de sí mismo

3. **Pentágono Evaluación Jefe (JEFE)**:
   - Color: Naranja
   - Fuente: `evaluations` donde `tipoEvaluador === "JEFE"`
   - Lo que el líder/director evaluó

4. **Pentágono Promedio (AVG)**:
   - Color: Verde brillante (línea gruesa)
   - Cálculo: `(Auto + Jefe) / 2` por cada skill
   - **Este es el resultado final que se guarda**

### Cálculo de Seniority Alcanzado
```typescript
// Comparar promedio con skills_matrix para determinar seniority real
const seniorityAlcanzado = calcularSeniority(promedioSkills, skills_matrix);

// Lógica:
// Si promedio >= 4.0 → Senior
// Si promedio >= 3.0 → Semi Senior
// Si promedio >= 2.0 → Junior
// Si promedio < 2.0 → Trainee
```

### Guardado de Resultados Finales
Crear una nueva hoja "Resultados Finales" con:
- Fecha
- Area
- Email Evaluado
- Nombre Evaluado
- Email Evaluador (Jefe/Director)
- Seniority Inicial
- Seniority Alcanzado
- Promedio General (todas las skills)
- Estado (Cumple/No Cumple/Superó)

## Convenciones de Código

### Estructura de Componentes (TypeScript + React)
```typescript
// src/components/Login.tsx
import { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import type { User } from '../types';

export default function Login() {
  const { users, setCurrentUser } = useContext(AppContext);
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const handleLogin = (): void => {
    const user = users.find((u: User) => u.email === email);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      setError('Usuario no encontrado');
    }
  };
  
  return (/* UI con Tailwind */);
}
```

### Estilos con Tailwind CSS
- Usar combinaciones semánticas: `bg-white rounded-lg shadow-md p-6`
- Paleta de colores: blue/indigo (`bg-blue-600`, `text-indigo-700`)
- Espaciado consistente: `gap-4`, `space-y-4`

### Manejo de Estado
- Datos globales en Context (`users`, `evaluations`, `skills_matrix`)
- Sesión de usuario en Context + localStorage para persistencia
- Estado local de componente para UI (modales, filtros)

## Testing con Vitest

### Configuración en vite.config.ts:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html']
    }
  }
});
```

### Patrón de Tests:
```typescript
// src/components/__tests__/Dashboard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppContext } from '../../context/AppContext';
import Dashboard from '../Dashboard';

describe('Dashboard - Permisos por Rol', () => {
  it('RRHH ve todas las evaluaciones', () => {
    const mockUser = { email: 'admin@test.com', rol: 'RRHH', area: 'HR', nombre: 'Admin' };
    const mockEvals = [
      { id: '1', evaluadoEmail: 'juan@test.com', area: 'IT' },
      { id: '2', evaluadoEmail: 'maria@test.com', area: 'HR' }
    ];
    
    render(
      <AppContext.Provider value={{ currentUser: mockUser, evaluations: mockEvals }}>
        <Dashboard />
      </AppContext.Provider>
    );
    
    expect(screen.getByText(/juan@test.com/i)).toBeInTheDocument();
    expect(screen.getByText(/maria@test.com/i)).toBeInTheDocument();
  });
});
```

### Metas de Cobertura:
- Componentes: 80%+ en lógica de negocio
- Utils/Helpers: 100% (funciones puras)
- Rutas críticas (auth, permisos): 100%

## Comandos de Desarrollo

```bash
# Setup inicial
npm create vite@latest . -- --template react-ts
npm install recharts react-router-dom
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Desarrollo
npm run dev              # Servidor de desarrollo
npm run build            # Build para producción
npm run preview          # Preview del build

# Testing
npm test                 # Correr tests
npm test -- --watch      # Modo watch
npm run coverage         # Reporte de cobertura
```

## Checklist Pre-Commit
1. ✅ Sin API keys o secrets hardcodeados
2. ✅ `.env` está en `.gitignore`
3. ✅ `npm audit` sin vulnerabilidades críticas
4. ✅ Tests pasan
5. ✅ Sin `console.log()` innecesarios

## Deployment (Netlify)
- Variables de entorno configuradas en Netlify UI
- Redirecciones para React Router: `/* /index.html 200`
- Google Apps Script desplegado con acceso "Anyone"

## Errores Comunes a Evitar
- Olvidar validar permisos en nuevas vistas
- No limpiar localStorage al hacer logout
- Usar `user.area` sin verificar null/undefined
- Hardcodear la URL de Google Script durante desarrollo

---

**IMPORTANTE**: La seguridad es prioridad. Ante dudas, consultá `.cursorrules` y `SECURITY.md`.