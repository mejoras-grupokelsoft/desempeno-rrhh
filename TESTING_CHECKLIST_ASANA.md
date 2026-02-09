# 📋 Lista de Testing - Dashboard Evaluación de Desempeño

## ✅ CAMBIOS IMPLEMENTADOS (Listo para testear)

### 1. Sistema de Puntajes 1-4
**Tarea:** Validar que sistema usa escala 1-4 en vez de 1-5  
**Testing:**
- [ ] Verificar que pentágonos muestran valores entre 1.0 y 4.0 (no 5.0)
- [ ] Confirmar que promedios calculados están en rango 1-4
- [ ] Revisar tabla de resultados (no debe haber valores >4)
- [ ] Probar con datos de prueba nuevos usando solo 1-4

**Criterio de éxito:** No aparece ningún puntaje superior a 4.00 en ninguna vista

---

### 2. Ponderación 70% Líder + 30% Autoevaluación
**Tarea:** Validar que promedio final da más peso a evaluación del líder  
**Testing:**
- [ ] Tomar un caso de prueba específico:
  - Autoevaluación: 2.0
  - Evaluación Líder: 4.0
  - Resultado esperado: **3.4** (no 3.0)
- [ ] Verificar cálculo: (4.0 × 0.70) + (2.0 × 0.30) = 2.8 + 0.6 = 3.4
- [ ] Repetir con 3-5 casos diferentes
- [ ] Comparar promedio mostrado vs cálculo manual

**Criterio de éxito:** Promedio final siempre más cercano a evaluación del líder que a 50/50

---

### 3. Eliminación del indicador "Estado" en vista Líder
**Tarea:** Confirmar que campo "Cumple/No Cumple" no aparece  
**Testing:**
- [ ] Login como Líder (cualquier líder)
- [ ] Ir a "Mi Desempeño"
- [ ] Verificar tarjetas de métricas:
  - ✅ Promedio General
  - ✅ Seniority Alcanzado
  - ✅ Seniority Esperado
  - ❌ Estado (NO debe aparecer)
- [ ] Grid debe tener 3 columnas, no 4

**Criterio de éxito:** No aparece ningún texto "Cumple", "No Cumple" o "Superó" en vista Líder

---

### 4. Colores de Pentágonos Mejorados
**Tarea:** Validar que colores son distinguibles y no confusos  
**Testing:**
- [ ] Abrir cualquier vista con pentágonos (Director/Líder/Analista)
- [ ] Verificar colores:
  - **Autoevaluación:** Azul oscuro (#1e40af)
  - **Evaluación Líder:** Cyan/turquesa (#0891b2)
  - **Promedio Final:** Rojo (#dc2626)
  - **Seniority Esperado:** Gris (línea punteada)
- [ ] Probar con monitor de diferentes calidades
- [ ] Pedir feedback a 2-3 personas sobre claridad

**Criterio de éxito:** Usuarios pueden identificar cada línea sin confusión

---

### 5. Filtro de Rango de Fechas Personalizado
**Tarea:** Probar filtro temporal con periodos predefinidos y rangos custom  
**Testing en Vista Director:**
- [ ] Click en "Periodos Predefinidos" (debe estar seleccionado por defecto)
  - [ ] Seleccionar "Histórico (Todo)" → Debe mostrar TODAS las evaluaciones
  - [ ] Seleccionar "Este Año" → Solo evaluaciones de 2026
  - [ ] Seleccionar "Q Anterior" → Solo Q4 2025 (o trimestre anterior actual)
- [ ] Click en "Rango Personalizado"
  - [ ] Aparecen 2 campos: "Fecha Desde" y "Fecha Hasta"
  - [ ] Ingresar rango: 01/12/2025 - 31/12/2025
  - [ ] Verificar que solo muestra evaluaciones de diciembre 2025
  - [ ] Intentar fecha "Hasta" anterior a "Desde" → Debe bloquearse
  - [ ] Limpiar fechas → Debe mostrar todas las evaluaciones

**Testing en Vista Líder:**
- [ ] Repetir pruebas anteriores en vista "Mi Equipo"
- [ ] Verificar que filtro se mantiene al cambiar de pestaña (Desempeño ↔ Equipo)

**Criterio de éxito:** Filtrado funciona correctamente en ambas vistas y valida fechas

---

### 6. Mensaje Informativo - Primera Evaluación
**Tarea:** Confirmar que usuarios ven mensaje explicativo cuando no hay comparación temporal  
**Testing Vista Líder:**
- [ ] Login con usuario que tiene SOLO 1 evaluación (sin histórico)
- [ ] Ir a "Mi Desempeño"
- [ ] Debe aparecer tarjeta azul con:
  - 📊 Título: "Esta es tu evaluación inicial"
  - Texto explicando que es punto de partida
  - Tip sobre próximas evaluaciones

**Testing Vista Analista:**
- [ ] Login con analista con solo 1 evaluación
- [ ] Verificar que sección "Mi Evolución" NO aparece
- [ ] Debe aparecer tarjeta púrpura con:
  - 🎯 Título: "¡Bienvenido a tu primera evaluación!"
  - Explicación de que verá evolución en próximas evaluaciones

**Testing con Histórico:**
- [ ] Login con usuario con 2+ evaluaciones en diferentes meses
- [ ] Confirmar que mensaje NO aparece
- [ ] Confirmar que gráfico de evolución SÍ aparece

**Criterio de éxito:** Mensaje solo para usuarios sin histórico, oculto para usuarios con datos de comparación

---

## 🚧 PENDIENTE DE CONFIGURACIÓN EXTERNA

### 7. Jotform - Cambiar Escala 1-5 a 1-4
**Responsable:** Killa Roldán / Pamela Gomez  
**Acciones:**
- [ ] Abrir formularios en Jotform (Analista y Líder)
- [ ] Cambiar TODOS los dropdowns de skills de 1-5 a 1-4
- [ ] Eliminar opción "5" completamente
- [ ] Hacer prueba de envío
- [ ] Verificar que datos llegan bien a Google Sheets

**Documentación:** Ver archivo `INSTRUCCIONES_JOTFORM.md`

---

### 8. Jotform - Mensaje de Confirmación
**Responsable:** Killa Roldán / Pamela Gomez  
**Acciones:**
- [ ] Configurar página de agradecimiento con nuevo texto
- [ ] Texto debe explicar que:
  - Perfil será analizado
  - Recibirán invitación a reunión de feedback
  - Resultados se compartirán después de feedback
- [ ] Agregar logo/colores corporativos

**Documentación:** Ver archivo `INSTRUCCIONES_JOTFORM.md`

---

### 9. Google Sheets - Campo de Estado
**Responsable:** Morena Caparrós (Apps Script)  
**Acciones:**
- [ ] Agregar columna "Estado Evaluación" en hoja principal
- [ ] Valores posibles: PENDIENTE, ANALIZADA, PUBLICADA
- [ ] Valor por defecto: PENDIENTE
- [ ] Crear dropdown en hoja para facilitar cambios
- [ ] (Opcional) Script para auto-cambiar estado

**Flujo de Trabajo:**
1. Evaluación enviada → PENDIENTE
2. RRHH revisa → ANALIZADA
3. Después de reunión feedback → PUBLICADA

---

### 10. Funcionalidad de Descarga PDF
**Responsable:** Morena Caparrós (Desarrollo)  
**Bloqueador:** Pendiente definición de Pamela/Killa sobre qué incluir  

**Testing cuando esté implementado:**
- [ ] Botón "Descargar PDF" aparece en vista Director
- [ ] PDF incluye datos definidos por RRHH
- [ ] PDF tiene formato profesional y legible
- [ ] Nombre del archivo es descriptivo (ej: `Evaluacion_JuanPerez_Q4_2025.pdf`)
- [ ] (Opcional) Envío por email funciona correctamente

---

## 🧪 TESTING GENERAL DEL SISTEMA

### Permisos por Rol
**Tarea:** Validar que cada rol solo ve lo que corresponde  
**Testing:**
- [ ] **Director:**
  - [ ] Ve todas las evaluaciones de todas las áreas
  - [ ] Puede filtrar por área/persona/periodo
  - [ ] Tiene acceso a métricas generales y comparativas
  
- [ ] **Líder:**
  - [ ] Ve solo evaluaciones de su área
  - [ ] Ve su propia evaluación
  - [ ] Ve evaluaciones de su equipo (analistas a cargo)
  - [ ] NO ve otras áreas
  
- [ ] **Analista:**
  - [ ] Solo ve su propia evaluación
  - [ ] NO ve evaluaciones de otros
  - [ ] NO ve métricas generales de la empresa

**Criterio de éxito:** Ningún rol accede a información fuera de su alcance

---

### Navegación y UX
**Tarea:** Verificar que interfaz es intuitiva y sin errores  
**Testing:**
- [ ] Todos los botones funcionan (no hay clicks sin acción)
- [ ] Tabs/pestañas cambian correctamente (Director: Individual ↔ General)
- [ ] Filtros se aplican inmediatamente al cambiar valores
- [ ] Dropdown de búsqueda de evaluados funciona con acentos
- [ ] Paginación funciona en tabla de resultados (10 por página)
- [ ] Botón "Limpiar filtros" resetea todo correctamente
- [ ] Logout cierra sesión y limpia localStorage

---

### Responsividad (Mobile/Tablet)
**Tarea:** Probar en diferentes dispositivos  
**Testing:**
- [ ] Mobile (320px - 480px)
  - [ ] Menú hamburguesa funciona
  - [ ] Tarjetas de métricas apilan verticalmente
  - [ ] Gráficos se ajustan sin overflow horizontal
  
- [ ] Tablet (768px - 1024px)
  - [ ] Grid de 2 columnas en tarjetas
  - [ ] Pentágonos se ven completos
  
- [ ] Desktop (1920px+)
  - [ ] Layout de 3-4 columnas aprovecha espacio
  - [ ] No hay elementos desproporcionados

---

### Performance
**Tarea:** Medir tiempos de carga  
**Testing:**
- [ ] Login a resultado final: <3 segundos
- [ ] Cambio de filtros: <500ms
- [ ] Cambio de tabs/vistas: <300ms
- [ ] Carga de pentágonos: <1 segundo
- [ ] Con 100+ evaluaciones: Sistema sigue fluido

---

## 📊 CASOS DE PRUEBA ESPECÍFICOS

### Caso 1: Analista con evaluación completa
**Datos:**
- Email: analista.test@grupokelsoft.com
- Área: IT
- Tiene: Autoevaluación + Evaluación del Líder
- Periodo: Diciembre 2025

**Validar:**
- [ ] Promedio final calcula correctamente (70% líder + 30% auto)
- [ ] Pentágonos muestran las 4 líneas (esperado, auto, líder, promedio)
- [ ] Fortalezas y áreas de mejora se identifican correctamente
- [ ] Comentarios del líder aparecen en sección de feedback

---

### Caso 2: Líder con equipo de 5 personas
**Datos:**
- Email: lider.test@grupokelsoft.com
- Área: Administración
- Tiene: 5 analistas a cargo

**Validar:**
- [ ] Vista "Mi Equipo" muestra las 5 personas
- [ ] Puede hacer drill-down (click en persona → ver detalle)
- [ ] Tabla de resultados muestra correctamente promedio/seniority de cada uno
- [ ] Filtro de búsqueda encuentra personas por nombre parcial

---

### Caso 3: Director filtrando por periodo Q4 2025
**Datos:**
- Filtro: Q Anterior (Q4 2025)
- Áreas: Todas

**Validar:**
- [ ] Solo muestra evaluaciones de Oct-Nov-Dic 2025
- [ ] Métricas generales se recalculan para ese periodo
- [ ] Gráfico de tendencia seniority compara con Q3 2025
- [ ] Exportación (futuro) incluye solo ese periodo

---

## 🐛 REPORTE DE BUGS

**Formato para reportar errores:**

```
Título: [ÁREA] Breve descripción

Pasos para reproducir:
1. Ir a vista X
2. Hacer click en Y
3. Observar Z

Resultado esperado:
Debería mostrar/hacer...

Resultado actual:
Muestra/hace...

Prioridad: Alta / Media / Baja

Screenshot: (adjuntar si aplica)
```

**Canales de reporte:**
- Asana: Crear tarea en proyecto "Evaluación Desempeño"
- Email urgente: morena.caparros@grupokelsoft.com

---

## ✅ CRITERIOS DE ACEPTACIÓN FINAL

**Para considerar el sistema listo para producción:**

- [ ] Todos los tests de funcionalidad ✅
- [ ] Todos los tests de permisos ✅
- [ ] Sin errores críticos reportados
- [ ] Performance aceptable (<3s carga inicial)
- [ ] Responsive en mobile/tablet/desktop
- [ ] Jotform configurado con escala 1-4
- [ ] Mensaje de confirmación personalizado
- [ ] Google Sheets con campo de estado
- [ ] Documentación entregada a RRHH
- [ ] Capacitación realizada con líderes

**Fecha objetivo producción:** [A DEFINIR POR RRHH]

---

## 📞 CONTACTOS

**Desarrollo/Technical:**
- Morena Caparrós - morena.caparros@grupokelsoft.com

**RRHH/Proceso:**
- Pamela Gomez - pamela.gomez@grupokelsoft.com
- Killa Roldán - killa.roldan@grupokelsoft.com

**Dirección:**
- Nicolás [Apellido] - nicolas@grupokelsoft.com
