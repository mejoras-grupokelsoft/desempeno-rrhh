-- 024_data_cleanup_agosto_2026.sql
-- Limpieza de datos pedida por Killa/Morena (ago 2026). NO SE EJECUTÓ TODAVÍA.
-- Revisar cada sección y correr a mano en el Supabase SQL Editor.
--
-- Orden importante: team_members -> teams -> areas (teams.area_id es ON DELETE
-- RESTRICT, así que si queda algún equipo sin borrar apuntando a una de estas
-- áreas, el DELETE de areas va a fallar con un error de FK - es la base
-- avisándote que falta borrar/reasignar ese equipo antes de continuar).

-- ============================================================
-- 0) DIAGNÓSTICO - correr esto primero y mirar los resultados
-- ============================================================

-- Equipos que quedarían "colgados" si borramos estas áreas sin tocarlos antes
SELECT t.nombre AS equipo, a.nombre AS area
FROM public.teams t
JOIN public.areas a ON a.id = t.area_id
WHERE a.nombre IN (
  'BNA','Desarrollo y Relacionamiento (Vertical Financiera)','Dirección General',
  'Infraestructura','IT','Mejoras: Ecosistema Microsoft, Automatizaciones, Sistema difu, ItSchool',
  'Mercado Libre','RRHH','sdfdsf','Taggeador','Ventas','Marca Personal',
  'Comunicación , Cultura y People','Plan de Carrera y Reclutamiento','Generalista'
);

-- Usuarios activos que quedarían sin área si borramos estas áreas (se van a NULL, no se rompen)
SELECT u.nombre, u.email, a.nombre AS area
FROM public.users u
JOIN public.areas a ON a.id = u.area_id
WHERE a.nombre IN (
  'BNA','Desarrollo y Relacionamiento (Vertical Financiera)','Dirección General',
  'Infraestructura','IT','Mejoras: Ecosistema Microsoft, Automatizaciones, Sistema difu, ItSchool',
  'Mercado Libre','RRHH','sdfdsf','Taggeador','Ventas','Marca Personal',
  'Comunicación , Cultura y People','Plan de Carrera y Reclutamiento','Generalista'
);

-- Confirmar los 4 usuarios a eliminar (revisar que sea la persona correcta antes de borrar)
-- Aldrey Piña Rojas confirmada como persona (estaba mal listada en "áreas a borrar").
-- OJO: "Francisco Apa" es en realidad "Francisco Garcia Apa" en la base (por eso no
-- salía en el SELECT anterior con el nombre corto).
SELECT nombre, email, rol, area_id FROM public.users
WHERE nombre IN ('Juan Wagner', 'Francisco Garcia Apa', 'Gabriel Boero', 'Aldrey Piña Rojas');

-- ============================================================
-- 1) EQUIPOS A BORRAR
-- ============================================================
-- a) Los 4 pedidos explícitamente por nombre (Catálogo y Matcheador tienen áreas
--    propias que NO se borran, así que hay que nombrarlos sí o sí).
-- b) CUALQUIER OTRO equipo que today apunte a una de las áreas de la sección 2,
--    detectado por el diagnóstico de arriba: un equipo "rrhh" en minúscula
--    (área Infraestructura) y dos equipos con el mismo nombre que su área
--    ("Desarrollo y Relacionamiento (Vertical Financiera)" y "Dirección General").
--    No estaban en la lista que pasaron, pero si no se borran, el DELETE de
--    áreas de la sección 2 vuelve a fallar por la FK teams_area_id_fkey.
DELETE FROM public.team_members
WHERE team_id IN (
  SELECT t.id FROM public.teams t
  LEFT JOIN public.areas a ON a.id = t.area_id
  WHERE t.nombre IN ('Catálogo','Matcheador','Mercado Libre','RRHH')
     OR a.nombre IN (
       'BNA','Desarrollo y Relacionamiento (Vertical Financiera)','Dirección General',
       'Infraestructura','IT','Mejoras: Ecosistema Microsoft, Automatizaciones, Sistema difu, ItSchool',
       'Mercado Libre','RRHH','sdfdsf','Taggeador','Ventas','Marca Personal',
       'Comunicación , Cultura y People','Plan de Carrera y Reclutamiento','Generalista'
     )
);

DELETE FROM public.teams t
USING public.areas a
WHERE (t.nombre IN ('Catálogo','Matcheador','Mercado Libre','RRHH'))
   OR (t.area_id = a.id AND a.nombre IN (
       'BNA','Desarrollo y Relacionamiento (Vertical Financiera)','Dirección General',
       'Infraestructura','IT','Mejoras: Ecosistema Microsoft, Automatizaciones, Sistema difu, ItSchool',
       'Mercado Libre','RRHH','sdfdsf','Taggeador','Ventas','Marca Personal',
       'Comunicación , Cultura y People','Plan de Carrera y Reclutamiento','Generalista'
     ));

-- Volvé a correr el diagnóstico de "equipos colgados" (arriba) - debería devolver
-- 0 filas antes de seguir con la sección 2.

-- ============================================================
-- 2) ÁREAS A BORRAR (borrar solo después de que la sección 1 haya dejado
--    0 equipos colgados)
-- ============================================================
DELETE FROM public.areas
WHERE nombre IN (
  'BNA',
  'Desarrollo y Relacionamiento (Vertical Financiera)',
  'Dirección General',
  'Infraestructura',
  'IT',
  'Mejoras: Ecosistema Microsoft, Automatizaciones, Sistema difu, ItSchool',
  'Mercado Libre',
  'RRHH',
  'sdfdsf',
  'Taggeador',
  'Ventas',
  'Marca Personal',
  'Comunicación , Cultura y People',
  'Plan de Carrera y Reclutamiento',
  'Generalista'
);
-- A los usuarios y preguntas que tenían una de estas áreas se les pone area/area_id
-- en NULL automáticamente (no se borran ni se rompen).

-- ============================================================
-- 3) USUARIOS A ELIMINAR: Juan Wagner, Francisco Garcia Apa, Gabriel Boero, Aldrey Piña Rojas
--    (revisar el SELECT de la sección 0 antes de correr esto)
-- ============================================================
-- DELETE FROM public.users
-- WHERE nombre IN ('Juan Wagner', 'Francisco Garcia Apa', 'Gabriel Boero', 'Aldrey Piña Rojas');
-- ^ Descomentar cuando confirmes que son los usuarios correctos. Si tienen
--   evaluaciones cargadas como evaluado/evaluador, esas evaluaciones quedan
--   (evaluations no tiene FK a users, guarda el email como texto suelto),
--   así que no se pierde el histórico de evaluaciones ya hechas.

-- ============================================================
-- 4) PREGUNTAS ARCHIVADAS - confirmado: borrar de verdad, aceptando
--    que se pierde el historial de respuestas asociado (ver nota abajo)
-- ============================================================
-- OJO (dejado como referencia): la tabla responses tiene
--   pregunta_id UUID REFERENCES questions(id) ON DELETE CASCADE
-- así que esto borra en cascada las respuestas ya cargadas de evaluaciones
-- pasadas que respondieron estas preguntas archivadas.
DELETE FROM public.questions WHERE estado = 'archivado';
