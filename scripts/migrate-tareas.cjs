/**
 * Script de migración: CSV -> Firestore (colección tareas)
 * 
 * Uso:
 * 1. Descargá el archivo de service account desde Firebase Console
 *    (Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada)
 * 2. Guardalo como scripts/service-account.json
 * 3. Ejecutá: node scripts/migrate-tareas.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Configuración de Firebase
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Cargar service account
const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: No se encontró service-account.json');
  console.log('');
  console.log('PASOS PARA CONFIGURAR:');
  console.log('1. Ve a Firebase Console → Configuración del proyecto → Cuentas de servicio');
  console.log('2. Click "Generar nueva clave privada"');
  console.log('3. Guardá el archivo como scripts/service-account.json');
  console.log('4. Volvé a ejecutar este script');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Ruta al CSV (ajustá si está en otra ubicación)
const csvPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads', 'migracion de datos.csv');

if (!fs.existsSync(csvPath)) {
  console.error('❌ Error: No se encontró el archivo CSV');
  console.log('Ruta esperada:', csvPath);
  process.exit(1);
}

// Inicializar Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

console.log('🚀 Iniciando migración...\n');

// Leer y parsear CSV
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true
});

console.log(`📊 Total de registros en CSV: ${records.length}\n`);

// Transformar datos
const tareas = records.map((row, index) => {
  // Limpiar campos
  const nombre = row.TAREA ? row.TAREA.trim() : '';
  const objetivo = row.Objetivos ? row.Objetivos.trim() : '';
  const metros = parseInt(row.Metros) || 0;
  const material = row.Material ? row.Material.trim() : '';
  const grupo = row.Grupo ? row.Grupo.trim() : '';
  const desarrollo = row.Desarrollo ? row.Desarrollo.trim() : '';
  const mantenimiento = row.Mantenimiento ? row.Mantenimiento.trim() : '';
  const tipoTarea = row['Tipo de Tarea'] ? row['Tipo de Tarea'].trim() : '';
  const categoria = row['Cortas/Largas/Escalera'] ? row['Cortas/Largas/Escalera'].trim() : '';

  return {
    nombre,
    objetivo,
    metros,
    material,
    grupo,
    desarrollo,
    mantenimiento,
    tipoTarea,
    categoria,
    // Metadata
    originalId: parseInt(row.ID) || index + 1,
    migratedAt: new Date().toISOString()
  };
});

// Filtrar tareas válidas (con nombre)
const validTareas = tareas.filter(t => t.nombre.length > 0);
console.log(`✅ Tareas válidas para migrar: ${validTareas.length}\n`);

// Subir a Firestore en batches
const BATCH_SIZE = 500;
let migratedCount = 0;
let errorCount = 0;

async function migrateBatch(tareasBatch) {
  const batch = db.batch();
  
  tareasBatch.forEach(tarea => {
    const docRef = db.collection('tareas').doc();
    batch.set(docRef, tarea);
  });

  await batch.commit();
}

async function runMigration() {
  const totalBatches = Math.ceil(validTareas.length / BATCH_SIZE);
  
  console.log(`📦 Subiendo a Firestore en ${totalBatches} batch(es)...\n`);

  for (let i = 0; i < validTareas.length; i += BATCH_SIZE) {
    const batch = validTareas.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      await migrateBatch(batch);
      migratedCount += batch.length;
      console.log(`   Batch ${batchNum}/${totalBatches} ✓ (${migratedCount}/${validTareas.length} tareas)`);
    } catch (error) {
      errorCount += batch.length;
      console.error(`   Batch ${batchNum}/${totalBatches} ✗ Error:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📋 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(50));
  console.log(`   ✅ Migradas: ${migratedCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📁 Colección: tareas`);
  console.log('='.repeat(50));
  
  if (migratedCount > 0) {
    console.log('\n🎉 ¡Migración completada!');
    console.log('   Verificá los datos en Firebase Console → Firestore → tareas');
  }
}

runMigration().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
