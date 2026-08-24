-- 023_backfill_bug_fixes.sql
-- Corrige datos ya cargados que quedaron mal por dos bugs de la app (ver commit relacionado):
--   1. AdminQuestionsPanel nunca enviaba el campo "tipo" al crear/editar una pregunta,
--      así que toda pregunta quedó con tipo = NULL en la base.
--   2. El formulario de Skills guardaba "Global" como area = '' (texto vacío) en vez de NULL,
--      por lo que esas skills nunca calzaban con el filtro "area IS NULL" usado para
--      mostrar/vincular skills y preguntas globales.
-- Ejecutar en: Supabase SQL Editor. Es seguro re-ejecutar (solo toca filas mal cargadas).

-- 1) Backfill de questions.tipo a partir de la skill vinculada (cuando la tiene)
UPDATE public.questions q
SET tipo = s.tipo
FROM public.skills s
WHERE q.skill_id = s.id
  AND q.tipo IS NULL
  AND s.tipo IS NOT NULL;

-- Preguntas con tipo NULL y SIN skill vinculada no se pueden inferir solas.
-- Revisar y corregir a mano desde el panel de Preguntas:
--   SELECT id, pregunta, area_id, estado FROM public.questions WHERE tipo IS NULL;

-- 2) Backfill de "Global" mal guardado como '' en vez de NULL
UPDATE public.skills SET area = NULL WHERE area = '';
UPDATE public.skills_matrix SET area = NULL WHERE area = '';
