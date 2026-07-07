// src/lib/seedData.ts
/**
 * Script para popular la BD con datos mock para testing
 * Uso: import { seedDatabase } from './seedData'; await seedDatabase();
 */

import { supabase } from './supabase';

// ============= DATOS MOCK =============

const MOCK_USERS = [
  {
    email: 'ana.rrhh@company.com',
    nombre: 'Ana García',
    rol: 'RRHH',
    area: 'Recursos Humanos',
  },
  {
    email: 'carlos.director@company.com',
    nombre: 'Carlos López',
    rol: 'Director',
    area: 'IT',
  },
  {
    email: 'maria.lider@company.com',
    nombre: 'María Rodríguez',
    rol: 'Lider',
    area: 'IT',
  },
  {
    email: 'juan.analista@company.com',
    nombre: 'Juan Martínez',
    rol: 'Analista',
    area: 'IT',
  },
  {
    email: 'sofia.analista@company.com',
    nombre: 'Sofía Pérez',
    rol: 'Analista',
    area: 'IT',
  },
  {
    email: 'diego.director@company.com',
    nombre: 'Diego Sánchez',
    rol: 'Director',
    area: 'Ventas',
  },
  {
    email: 'laura.lider@company.com',
    nombre: 'Laura González',
    rol: 'Lider',
    area: 'Ventas',
  },
  {
    email: 'pablo.analista@company.com',
    nombre: 'Pablo Fernández',
    rol: 'Analista',
    area: 'Ventas',
  },
];

const MOCK_USER_AREAS = [
  { user_email: 'maria.lider@company.com', area: 'IT', rol_en_area: 'Lider' },
  { user_email: 'juan.analista@company.com', area: 'IT', rol_en_area: 'Miembro' },
  { user_email: 'sofia.analista@company.com', area: 'IT', rol_en_area: 'Miembro' },
  { user_email: 'laura.lider@company.com', area: 'Ventas', rol_en_area: 'Lider' },
  { user_email: 'pablo.analista@company.com', area: 'Ventas', rol_en_area: 'Miembro' },
];

// ============= FUNCIONES DE SEED =============

export async function seedUsers(): Promise<void> {
  console.log('🌱 Seeding usuarios...');

  for (const user of MOCK_USERS) {
    const { data: existing, error: fetchError } = await supabase
      .from('users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (existing) {
      console.log(`  ✓ Usuario ${user.email} ya existe`);
      continue;
    }

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`  ✗ Error buscando usuario ${user.email}:`, fetchError);
      continue;
    }

    const { error: insertError } = await supabase.from('users').insert([user]);

    if (insertError) {
      console.error(`  ✗ Error insertando usuario ${user.email}:`, insertError);
    } else {
      console.log(`  ✓ Insertado: ${user.nombre} (${user.rol})`);
    }
  }
}

export async function seedUserAreas(): Promise<void> {
  console.log('🌱 Seeding user_areas...');

  for (const userArea of MOCK_USER_AREAS) {
    const { data: existing, error: fetchError } = await supabase
      .from('user_areas')
      .select('id')
      .eq('user_email', userArea.user_email)
      .eq('area', userArea.area)
      .single();

    if (existing) {
      console.log(`  ✓ Area ${userArea.area} para ${userArea.user_email} ya existe`);
      continue;
    }

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`  ✗ Error buscando user_area:`, fetchError);
      continue;
    }

    const { error: insertError } = await supabase.from('user_areas').insert([userArea]);

    if (insertError) {
      console.error(`  ✗ Error insertando user_area:`, insertError);
    } else {
      console.log(`  ✓ Asignado: ${userArea.user_email} → ${userArea.area}`);
    }
  }
}

export async function seedHardSkillsQuestions(): Promise<void> {
  console.log('🌱 Seeding HARD skills questions (MOCKUP) por área...');

  const hardSkillsByArea = [
    {
      area: 'IT',
      skills: [
        { nombre: 'mockup - pregunta 1: TypeScript', descripcion: 'Dominio de TypeScript y paradigmas modernos', orden: 1 },
        { nombre: 'mockup - pregunta 2: Arquitectura', descripcion: 'Diseño de sistemas escalables', orden: 2 },
        { nombre: 'mockup - pregunta 3: Testing', descripcion: 'Escritura de tests automatizados', orden: 3 },
      ],
    },
    {
      area: 'Ventas',
      skills: [
        { nombre: 'mockup - pregunta 4: Cierre', descripcion: 'Capacidad para concretar acuerdos', orden: 1 },
        { nombre: 'mockup - pregunta 5: Negociación', descripcion: 'Habilidad de negociación efectiva', orden: 2 },
        { nombre: 'mockup - pregunta 6: Prospección', descripcion: 'Identificación de oportunidades', orden: 3 },
      ],
    },
  ];

  for (const areaGroup of hardSkillsByArea) {
    for (const skill of areaGroup.skills) {
      const { data: existing, error: fetchError } = await supabase
        .from('questions')
        .select('id')
        .eq('nombre', skill.nombre)
        .eq('area', areaGroup.area)
        .eq('tipo', 'HARD')
        .single();

      if (existing) {
        console.log(`  ✓ Pregunta "${skill.nombre}" para ${areaGroup.area} ya existe`);
        continue;
      }

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`  ✗ Error buscando pregunta:`, fetchError);
        continue;
      }

      const { error: insertError } = await supabase.from('questions').insert([
        {
          nombre: skill.nombre,
          descripcion: skill.descripcion,
          tipo: 'HARD',
          area: areaGroup.area,
          estado: 'activo',
          orden: skill.orden,
        },
      ]);

      if (insertError) {
        console.error(`  ✗ Error insertando pregunta:`, insertError);
      } else {
        console.log(`  ✓ Insertado: "${skill.nombre}" para ${areaGroup.area}`);
      }
    }
  }
}

export async function seedAllData(): Promise<void> {
  console.log('\n========================================');
  console.log('🌱 INICIANDO SEED DE BASE DE DATOS');
  console.log('========================================\n');

  try {
    await seedUsers();
    await seedUserAreas();
    await seedHardSkillsQuestions();

    console.log('\n========================================');
    console.log('✅ SEED COMPLETADO EXITOSAMENTE');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ ERROR DURANTE SEED:', error);
    throw error;
  }
}

// ============= FUNCIÓN PARA EJECUTAR DESDE CONSOLA =============

export async function runSeed(): Promise<void> {
  try {
    await seedAllData();
  } catch (error) {
    console.error('Error en seed:', error);
  }
}
