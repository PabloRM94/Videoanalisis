/**
 * Script de actualización: Convertir objetivo de string a array
 * 
 * Uso: node scripts/update-tareas-objetivos.cjs
 * 
 * Convierte objetivo: "AEL/AEM/AEI" → objetivo: ["AEL", "AEM", "AEI"]
 */

const fs = require('fs');
const path = require('path');

// Configuración de Firebase
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Cargar service account
const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: No se encontró service-account.json');
  console.log('Ubicación esperada:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Objetivos válidos (de la lista del frontend)
const objetivosValidos = [
  'CLNT',
  'TEC',
  'AEL',
  'AEM',
  'AEI',
  'VEL',
  'REST',
  'ANA',
  'PAL',
  'PLAC',
  'CAL',
  'CLAC',
  'INI',
  'FUER',
];

// Inicializar Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

console.log('🔄 Iniciando actualización de objetivos...\n');

// Función para convertir string objetivo a array
function parseObjetivos(objetivoStr) {
  if (!objetivoStr) return [];
  
  // Si ya es array, retornarlo
  if (Array.isArray(objetivoStr)) {
    return objetivoStr.filter(o => objetivosValidos.includes(o));
  }
  
  // Si es string con "/", split y filtrar
  const parsed = objetivoStr
    .split('/')
    .map(o => o.trim().toUpperCase())
    .filter(o => objetivosValidos.includes(o));
  
  // Eliminar duplicados
  return [...new Set(parsed)];
}

async function updateTareas() {
  // Obtener todas las tareas
  const tareasRef = db.collection('tareas');
  const snapshot = await tareasRef.get();
  
  console.log(`📊 Total de tareas en Firestore: ${snapshot.size}\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  // Procesar cada documento
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const objetivoActual = data.objetivo;
    
    // Si ya es array, verificar si necesita actualización
    if (Array.isArray(objetivoActual)) {
      // Verificar si todos los elementos son válidos
      const tieneInvalidos = objetivoActual.some(o => !objetivosValidos.includes(o));
      if (!tieneInvalidos && objetivoActual.length > 0) {
        skippedCount++;
        continue; // Ya está en formato correcto
      }
    }
    
    // Convertir a array
    const nuevosObjetivos = parseObjetivos(objetivoActual);
    
    try {
      await doc.ref.update({
        objetivo: nuevosObjetivos
      });
      
      if (nuevosObjetivos.length > 0) {
        console.log(`   ✅ ${doc.id}: "${objetivoActual}" → [${nuevosObjetivos.join(', ')}]`);
      } else {
        console.log(`   ⚠️ ${doc.id}: Sin objetivos válidos (era: "${objetivoActual}")`);
      }
      updatedCount++;
    } catch (error) {
      console.error(`   ❌ ${doc.id}: Error -`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMEN DE ACTUALIZACIÓN');
  console.log('='.repeat(60));
  console.log(`   ✅ Actualizadas: ${updatedCount}`);
  console.log(`   ⏭️  Omitidas (ya en formato correcto): ${skippedCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log('='.repeat(60));
  
  if (updatedCount > 0) {
    console.log('\n🎉 ¡Actualización completada!');
  }
}

updateTareas().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});