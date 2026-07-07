// src/lib/seedData.integration.ts
/**
 * Script para TESTING - Ejecuta seed de datos completo
 * Uso: En la consola del navegador:
 * 1. import { seedAllData } from './lib/seedData.ts';
 * 2. await seedAllData();
 * 
 * O crear un botón en Admin que llame a esta función
 */

import { seedAllData } from './seedData';

export async function testFullSeed(): Promise<void> {
  console.log('\n🚀 INICIANDO SEED COMPLETO PARA TESTING...\n');
  await seedAllData();
  console.log('\n✅ DATOS LISTOS PARA TESTING\n');
  console.log('Usuarios de prueba:');
  console.log('  - RRHH: ana.rrhh@company.com');
  console.log('  - Director IT: carlos.director@company.com');
  console.log('  - Líder IT: maria.lider@company.com');
  console.log('  - Analista IT: juan.analista@company.com');
  console.log('  - Analista Ventas: pablo.analista@company.com\n');
}
