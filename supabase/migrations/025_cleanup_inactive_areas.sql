-- 025_cleanup_inactive_areas.sql
-- Completa la limpieza de "todo lo que está inactivo": el 024 solo borró las
-- áreas que venían nombradas en la lista original, pero quedaron 2 áreas
-- (sub-áreas de "Proyectos") marcadas como Inactivo en el panel de Áreas que
-- nunca estuvieron en esa lista: Catálogo y Matcheador.
-- Ejecutar en: Supabase SQL Editor.

-- Diagnóstico: equipos que todavía apuntan a estas áreas (deberían ser 0,
-- ya que los equipos "Catálogo" y "Matcheador" se borraron en el 024)
SELECT t.nombre AS equipo, a.nombre AS area
FROM public.teams t
JOIN public.areas a ON a.id = t.area_id
WHERE a.nombre IN ('Catálogo', 'Matcheador');

-- Si el diagnóstico de arriba dio 0 filas, borrar las 2 áreas inactivas
DELETE FROM public.areas
WHERE nombre IN ('Catálogo', 'Matcheador') AND activo = false;
