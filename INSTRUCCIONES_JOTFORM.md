# Instrucciones para configurar Jotform

## 📋 Cambios en Formularios

### 1. Cambiar escala de evaluación de 1-5 a 1-4

**Acción requerida en Jotform:**
- Abrir formulario de evaluación (Analista y Líder)
- Buscar TODOS los campos de evaluación de skills (desplegables/dropdowns)
- Cambiar las opciones de:
  ```
  Antes: 1, 2, 3, 4, 5
  Después: 1, 2, 3, 4
  ```
- **Importante**: Eliminar completamente la opción "5" de todos los desplegables

**Ubicación:**
- Sección "Hard Skills" - Todos los campos
- Sección "Soft Skills" - Todos los campos

**Testing:**
- Completar formulario y verificar que solo aparecen opciones 1-4
- Intentar enviar con diferentes valores y confirmar que se guarda correctamente en la hoja

---

### 2. Personalizar página de confirmación

**Acción requerida en Jotform:**

1. Ir a: **Configuración del formulario → Emails**
2. Editar **"Página de agradecimiento"** o **"Confirmation Page"**
3. Reemplazar el mensaje actual con:

```
✅ Evaluación Recibida

Gracias por completar tu evaluación de desempeño.

📊 Próximos pasos:
• Tu perfil será analizado por el área de RRHH
• Recibirás una invitación a una reunión de feedback con tu líder
• En esa reunión se definirá tu plan de desarrollo profesional

🔒 Confidencialidad:
Los resultados de tu evaluación serán compartidos contigo una vez completado
el análisis y después de la reunión de feedback con tu líder.

Si tenés alguna duda, contactá a rrhh@grupokelsoft.com
```

**Personalización adicional:**
- Usar colores corporativos (naranja/negro)
- Agregar logo de Grupo Kelsoft si está disponible
- Opcional: Agregar un botón "Volver al inicio" que redirija a la intranet

---

## 📧 Configuración de emails automáticos (Opcional)

### Email de confirmación al evaluado

**Si desean que el evaluado reciba un email con copia de sus respuestas:**

1. Ir a: **Emails → Autoresponder Email**
2. Habilitar el autoresponder
3. **Configurar envío retrasado:**
   - ⚠️ **NO enviar inmediatamente**
   - Configurar envío **DESPUÉS** de la reunión de feedback (ej: 7 días después)
   
4. Plantilla sugerida:
```
Asunto: Resultados de tu Evaluación de Desempeño

Hola {nombre},

Adjunto encontrás los resultados de tu evaluación de desempeño correspondiente al periodo {periodo}.

📊 Resumen de tu evaluación:
• Promedio general: {promedio}
• Seniority alcanzado: {seniority}

Para ver el análisis detallado de tus competencias, ingresá a:
https://evaluacion-desempeno.netlify.app

Recordá que estos resultados ya fueron compartidos contigo en la reunión de feedback con tu líder.

Saludos,
Equipo de RRHH
```

---

## 🔒 Sistema de Control de Acceso (Implementado en el código)

### Estado de habilitación de resultados

**¿Cómo funciona?**

Se agregó un nuevo campo en la hoja de Google Sheets llamado **"Estado Evaluación"** con 3 valores posibles:
- `PENDIENTE` - Evaluación enviada pero no analizada (valor por defecto)
- `ANALIZADA` - RRHH y líder ya revisaron pero falta reunión
- `PUBLICADA` - Reunión de feedback completada, analista puede ver resultados

**Flujo de trabajo:**

1. **Analista completa formulario** → Estado: `PENDIENTE`
   - Vista del analista muestra: "Tu evaluación está siendo analizada"
   
2. **RRHH/Líder revisan** → Cambiar estado a: `ANALIZADA`
   - Vista del analista muestra: "Tu evaluación está lista. Pronto recibirás invitación para reunión de feedback"
   
3. **Después de reunión de feedback** → Cambiar estado a: `PUBLICADA`
   - Ahora el analista SÍ puede ver todos sus resultados (pentágonos, métricas, feedback)

**Dónde cambiar el estado:**
- Ir a Google Sheets → Hoja "Evaluaciones Final"
- Agregar columna "Estado Evaluación" (si no existe)
- Cambiar valor según el flujo de trabajo

**Automatización futura (opcional):**
- Crear un Apps Script que cambie automáticamente el estado cuando RRHH marca "Analizada"
- Integrar con Google Calendar para detectar reuniones de feedback y auto-publicar

---

## 📝 Validaciones a implementar en Jotform

### 1. Validación de rango de puntajes
```javascript
// En configuración avanzada de cada campo numérico:
- Mínimo: 1
- Máximo: 4
- Mostrar error si fuera de rango: "El puntaje debe estar entre 1 y 4"
```

### 2. Validación de campos obligatorios
- Marcar TODOS los campos de skills como obligatorios
- Especialmente: Comentarios del líder (al menos 10 caracteres)

### 3. Validación de email del evaluador
- Debe ser email corporativo: `*@grupokelsoft.com`
- Regex: `^[a-zA-Z0-9._%+-]+@grupokelsoft\.com$`

---

## 🧪 Testing antes de lanzar

### Checklist de pruebas:

- [ ] Completar formulario como **Analista** y verificar:
  - Solo aparecen opciones 1-4 en todos los desplegables
  - Página de confirmación muestra el mensaje nuevo
  - Datos llegan correctamente a Google Sheets
  - Estado inicial es "PENDIENTE"

- [ ] Completar formulario como **Líder** y verificar:
  - Campos de autoevaluación y evaluación al equipo funcionan
  - Comentarios obligatorios se validan
  - Hard Skills y Soft Skills se filtran correctamente por área

- [ ] Probar con emails de prueba:
  - Email inválido (@gmail.com) debe rechazarse
  - Email corporativo debe aceptarse

- [ ] Vista del Analista:
  - Con estado PENDIENTE: Ver mensaje "En análisis"
  - Con estado ANALIZADA: Ver mensaje "Pronto recibirás feedback"
  - Con estado PUBLICADA: Ver todos los resultados completos

---

## 📞 Contacto

Para dudas sobre la configuración técnica de Jotform:
- Contactar a: Morena Caparrós
- Email: morena.caparros@grupokelsoft.com

Para definiciones de proceso y comunicación:
- Contactar a: Pamela Gomez / Killa Roldán
- Email: rrhh@grupokelsoft.com
