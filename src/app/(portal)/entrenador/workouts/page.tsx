'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDoc,
  serverTimestamp,
  limit,
  orderBy 
} from 'firebase/firestore';
import { Calendar, Plus, Search, Edit, Trash2, X, Send, FileText, Copy, LayoutGrid, List, GripVertical, ChevronUp, ChevronDown, XCircle, ChevronDown as ChevronIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Tarea {
  id: string;
  nombre: string;
  objetivo: string[];
  material: string;
  metros: number;
  descripcion?: string;
}

interface Workout {
  id: string;
  titulo: string;
  fecha: string;
  objetivo: string;
  material: string;
  metros: number;
  tareaIds: string[];
}

interface Grupo {
  id: string;
  nombre: string;
  clienteIds?: string[];
}

interface Asignacion {
  id: string;
  workoutId: string;
  clienteId?: string;
  grupoId: string;
  fechaAsignada: string;
  estado: string;
}

const objetivosOpciones = [
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

const materialOpciones = [
  'Tabla',
  'Aletas',
  'Pullboy',
  'Churumbela',
  'Bola',
  'Cuerda',
  'Pletinas',
  'Nadador',
  'Otro',
  'Sin material',
];

export default function EntrenadorWorkoutsPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroObjetivo, setFiltroObjetivo] = useState('');
  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [filtroMetros, setFiltroMetros] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  
  // Estado para edición
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // View modes
  const [workoutsViewMode, setWorkoutsViewMode] = useState<'grid' | 'table'>('grid');
  const [tareasViewMode, setTareasViewMode] = useState<'grid' | 'table'>('table');
  
  // Workout expandido (para mostrar/ocultar ejercicios)
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  
  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    objetivo: '',
    material: '',
    tareaIds: [] as string[],
  });

  const [clientes, setClientes] = useState<{id: string; nombre: string; apellido: string; telefono?: string}[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  
  const [assignData, setAssignData] = useState({
    grupoId: '',
    clienteId: '',
    fecha: '',
    includePdf: false,
  });

  // Estado para buscador de tareas en el modal
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFiltroObjetivo, setTaskFiltroObjetivo] = useState('');
  const [taskFiltroMaterial, setTaskFiltroMaterial] = useState('');
  const [taskFiltroMetros, setTaskFiltroMetros] = useState('');

  // Estado para edición de tareas dentro del workout
  const [editingTareaInWorkout, setEditingTareaInWorkout] = useState<Tarea | null>(null);
  const [showEditTareaModal, setShowEditTareaModal] = useState(false);
  const [tareaFormData, setTareaFormData] = useState({
    nombre: '',
    objetivo: [] as string[],
    material: '',
    metros: '',
    descripcion: '',
  });

  // Funciones para reordenar tareas
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true,
    selectedTareas: true,
    tareasBanco: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const moveTareaUp = (index: number) => {
    if (index === 0) return;
    const newTareaIds = [...formData.tareaIds];
    [newTareaIds[index - 1], newTareaIds[index]] = [newTareaIds[index], newTareaIds[index - 1]];
    const newObjetivo = calculateObjective(newTareaIds);
    const newMaterial = calculateMaterial(newTareaIds);
    setFormData({ ...formData, tareaIds: newTareaIds, objetivo: newObjetivo, material: newMaterial });
  };

  const moveTareaDown = (index: number) => {
    if (index === formData.tareaIds.length - 1) return;
    const newTareaIds = [...formData.tareaIds];
    [newTareaIds[index], newTareaIds[index + 1]] = [newTareaIds[index + 1], newTareaIds[index]];
    const newObjetivo = calculateObjective(newTareaIds);
    const newMaterial = calculateMaterial(newTareaIds);
    setFormData({ ...formData, tareaIds: newTareaIds, objetivo: newObjetivo, material: newMaterial });
  };

  const removeTareaFromWorkout = (tareaId: string) => {
    const newTareaIds = formData.tareaIds.filter(id => id !== tareaId);
    const newObjetivo = calculateObjective(newTareaIds);
    const newMaterial = calculateMaterial(newTareaIds);
    setFormData({ ...formData, tareaIds: newTareaIds, objetivo: newObjetivo, material: newMaterial });
  };

  // Obtener tareas seleccionadas ordenadas
  const getSelectedTareas = () => {
    return formData.tareaIds.map(id => tareas.find(t => t.id === id)).filter(Boolean) as Tarea[];
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // Fetch tareas (con límite para mejor rendimiento)
        const tareasRef = collection(db, 'tareas');
        const tareasQ = query(tareasRef, limit(100));
        const tareasSnap = await getDocs(tareasQ);
        const tareasData = tareasSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Tarea[];
        setTareas(tareasData);

        // Fetch grupos (compartidos entre todos los trainers)
        const gruposRef = collection(db, 'grupos');
        const gruposSnap = await getDocs(gruposRef);
        const gruposData = gruposSnap.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre,
          clienteIds: doc.data().clienteIds || [],
        }));
        setGrupos(gruposData);

        // Fetch clientes desde 'users' con role='cliente' (compartidos entre trainers)
        const clientesRef = collection(db, 'users');
        const clientesQ = query(clientesRef, where('role', '==', 'cliente'));
        const clientesSnap = await getDocs(clientesQ);
        const clientesData = clientesSnap.docs.map(docSnap => ({
          id: docSnap.id,
          nombre: docSnap.data().nombre || '',
          apellido: docSnap.data().apellido || '',
          telefono: docSnap.data().telefono || '',
        }));
        setClientes(clientesData);

        // Fetch workouts con límite y ordenados por fecha (más recientes primero)
        const workoutsRef = collection(db, 'workouts');
        const workoutsQ = query(workoutsRef, orderBy('fecha', 'desc'), limit(50));
        const workoutsSnap = await getDocs(workoutsQ);
        const workoutsData = workoutsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Workout[];
        setWorkouts(workoutsData);

        // Fetch asignaciones (con límite)
        const asignacionesRef = collection(db, 'asignaciones');
        const asignacionesQ = query(asignacionesRef, limit(100));
        const asignacionesSnap = await getDocs(asignacionesQ);
        const asignacionesData = asignacionesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Asignacion[];
        setAsignaciones(asignacionesData);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const getTareasDetails = (tareaIds: string[]) => {
    return tareas.filter(t => tareaIds.includes(t.id));
  };

  const calculateMetros = (tareaIds: string[]) => {
    return tareas.filter(t => tareaIds.includes(t.id)).reduce((acc, t) => acc + t.metros, 0);
  };

  // Material: únicos de las tareas, concatenados con coma
  const calculateMaterial = (tareaIds: string[]): string => {
    const materiales = tareas
      .filter(t => tareaIds.includes(t.id) && t.material)
      .map(t => t.material);
    return [...new Set(materiales)].join(', ') || 'Sin material';
  };

  // Objetivo: el que más se repite (moda)
  const calculateObjective = (tareaIds: string[]): string => {
    const objetivosArrays = tareas
      .filter(t => tareaIds.includes(t.id) && t.objetivo)
      .map(t => Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo]);
    
    if (objetivosArrays.length === 0) return 'General';
    
    // Aplanar el array de arrays
    const objetivos = objetivosArrays.flat();
    
    if (objetivos.length === 0) return 'General';
    
    const counts: Record<string, number> = {};
    objetivos.forEach(o => counts[o] = (counts[o] || 0) + 1);
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };

  // Sistema de recomendaciones de tareas
  const getFilteredAndSortedTareas = () => {
    // Definir grupos de prioridad
    const grupo1 = ['CLNT', 'TEC', 'INI']; // Calentamiento/Técnicos → Ir a Grupo 2
    const grupo2 = ['VEL', 'FUER', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC']; // Velocidad/Fuerza → Ir a Grupo 3
    const grupo3 = ['AEL', 'AEM', 'AEI']; // Estilos → Quedarse en Grupo 3

    // Obtener el objetivo predominante de las tareas seleccionadas
    const selectedTareas = getTareasDetails(formData.tareaIds);
    const currentMainObjective = selectedTareas.length > 0 
      ? calculateObjective(formData.tareaIds) 
      : null;

    // Contar uso de tareas en la sesión actual (penalizar las más usadas)
    const taskUsageCount: Record<string, number> = {};
    formData.tareaIds.forEach(id => {
      taskUsageCount[id] = (taskUsageCount[id] || 0) + 1;
    });

    // Determinar objetivos a recomendar según la nueva lógica
    let recommendedObjectives: string[] = [];
    let recommendedGroupName = '';
    
    if (currentMainObjective) {
      if (grupo1.includes(currentMainObjective)) {
        // CLNT, TEC, INI → Grupo 2 (para pasar a la parte principal)
        recommendedObjectives = [...grupo2];
        recommendedGroupName = 'Parte Principal';
      } else if (grupo2.includes(currentMainObjective)) {
        // Grupo 2 → Grupo 3 (para pasar a estilos)
        recommendedObjectives = [...grupo3];
        recommendedGroupName = 'Estilos';
      } else if (grupo3.includes(currentMainObjective)) {
        // Grupo 3 → Quedarse en Grupo 3
        recommendedObjectives = [...grupo3];
        recommendedGroupName = 'Estilos';
      } else {
        // Objetivo no reconocido → Grupo 1 por defecto
        recommendedObjectives = [...grupo1];
        recommendedGroupName = 'Calentamiento';
      }
    } else {
      // No hay tareas seleccionadas → Grupo 1 por defecto
      recommendedObjectives = [...grupo1];
      recommendedGroupName = 'Calentamiento';
    }

    // Filtrar tareas
    const filtered = tareas.filter(t => {
      const objetivosArray = Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo].filter(Boolean);
      const matchSearch = 
        !taskSearch || 
        t.nombre.toLowerCase().includes(taskSearch.toLowerCase()) ||
        objetivosArray.some(o => o.toLowerCase().includes(taskSearch.toLowerCase()));
      const matchObjetivo = !taskFiltroObjetivo || objetivosArray.includes(taskFiltroObjetivo);
      const matchMaterial = !taskFiltroMaterial || t.material === taskFiltroMaterial;
      const matchMetros = !taskFiltroMetros || t.metros >= parseInt(taskFiltroMetros);

      return matchSearch && matchObjetivo && matchMaterial && matchMetros;
    });

    // Ordenar: recomendadas primero, luego el resto (penalizar las más usadas)
    const sorted = [...filtered].sort((a, b) => {
      const aObj = Array.isArray(a.objetivo) ? a.objetivo : [a.objetivo].filter(Boolean);
      const bObj = Array.isArray(b.objetivo) ? b.objetivo : [b.objetivo].filter(Boolean);
      
      // Ver si son recomendadas
      const aIsRecommended = aObj.some(o => recommendedObjectives.includes(o));
      const bIsRecommended = bObj.some(o => recommendedObjectives.includes(o));
      
      // Ver uso en sesión (penalizar si ya se usó)
      const aUsage = taskUsageCount[a.id] || 0;
      const bUsage = taskUsageCount[b.id] || 0;
      
      // Orden: recomendadas > no recomendadas, y dentro de cada grupo, las menos usadas primero
      if (aIsRecommended && !bIsRecommended) return -1;
      if (!aIsRecommended && bIsRecommended) return 1;
      
      // Si ambas son del mismo grupo (recomendadas o no), penalizar las más usadas
      return aUsage - bUsage;
    });

    return { sorted, recommendedObjectives, recommendedGroupName };
  };

  const createWorkout = async () => {
    if (!user || !formData.titulo.trim() || formData.tareaIds.length === 0) return;

    // Si hay un workout en edición, mostrar modal de confirmación
    if (editingWorkout) {
      setShowSaveModal(true);
      return;
    }

    // Crear nuevo workout
    try {
      const metros = calculateMetros(formData.tareaIds);
      const objetivo = calculateObjective(formData.tareaIds);
      const material = calculateMaterial(formData.tareaIds);
      
      // Workouts compartidos entre todos los trainers
      const workoutsRef = collection(db, 'workouts');
      const newWorkout = await addDoc(workoutsRef, {
        titulo: formData.titulo.trim(),
        objetivo: objetivo || 'General',
        material: material || 'Sin material',
        metros,
        tareaIds: formData.tareaIds,
        fecha: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      setWorkouts([...workouts, {
        id: newWorkout.id,
        titulo: formData.titulo.trim(),
        objetivo: objetivo || 'General',
        material: material || 'Sin material',
        metros,
        tareaIds: formData.tareaIds,
        fecha: new Date().toISOString(),
      }]);

      setShowCreateModal(false);
      setFormData({ titulo: '', objetivo: '', material: '', tareaIds: [] });
    } catch (error) {
      console.error('Error creating workout:', error);
    }
  };

  // Guardar solo el workout (sin modificar las tareas en el banco)
  const saveWorkoutOnly = async () => {
    if (!editingWorkout) return;

    try {
      const metros = calculateMetros(formData.tareaIds);
      const objetivo = calculateObjective(formData.tareaIds);
      const material = calculateMaterial(formData.tareaIds);

      await updateDoc(doc(db, 'workouts', editingWorkout.id), {
        titulo: formData.titulo.trim(),
        objetivo: objetivo || 'General',
        material: material || 'Sin material',
        metros,
        tareaIds: formData.tareaIds,
      });

      setWorkouts(workouts.map(w => 
        w.id === editingWorkout.id 
          ? { 
              ...w, 
              titulo: formData.titulo.trim(),
              objetivo: objetivo || 'General',
              material: material || 'Sin material',
              metros,
              tareaIds: formData.tareaIds 
            }
          : w
      ));

      closeModal();
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  };

  // Guardar workout Y actualizar las tareas en el banco
  const saveWorkoutAndBanco = async () => {
    if (!editingWorkout) return;

    try {
      // Obtener las tareas originales del workout
      const originalTareas = getTareasDetails(editingWorkout.tareaIds);
      const newTareas = getTareasDetails(formData.tareaIds);

      // Actualizar las tareas en Firestore
      for (const newTarea of newTareas) {
        const original = originalTareas.find(t => t.id === newTarea.id);
        if (original) {
          // La tarea ya existía, actualizar si cambió
          await updateDoc(doc(db, 'tareas', newTarea.id), {
            nombre: newTarea.nombre,
            objetivo: newTarea.objetivo,
            material: newTarea.material,
            metros: newTarea.metros,
            descripcion: newTarea.descripcion,
          });
        }
      }

      // Actualizar el workout
      const metros = calculateMetros(formData.tareaIds);
      const objetivo = calculateObjective(formData.tareaIds);
      const material = calculateMaterial(formData.tareaIds);

      await updateDoc(doc(db, 'workouts', editingWorkout.id), {
        titulo: formData.titulo.trim(),
        objetivo: objetivo || 'General',
        material: material || 'Sin material',
        metros,
        tareaIds: formData.tareaIds,
      });

      // Recargar tareas
      const tareasRef = collection(db, 'tareas');
      const tareasSnap = await getDocs(tareasRef);
      const tareasData = tareasSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Tarea[];
      setTareas(tareasData);

      // Actualizar lista de workouts
      setWorkouts(workouts.map(w => 
        w.id === editingWorkout.id 
          ? { 
              ...w, 
              titulo: formData.titulo.trim(),
              objetivo: objetivo || 'General',
              material: material || 'Sin material',
              metros,
              tareaIds: formData.tareaIds 
            }
          : w
      ));

      closeModal();
    } catch (error) {
      console.error('Error saving workout and banco:', error);
    }
  };

  // Guardar tarea editada solo en el workout (no en el banco)
  const saveTareaWorkoutOnly = async () => {
    if (!editingTareaInWorkout) return;

    // Actualizar la tarea en la lista local de tareas
    const updatedTareas = tareas.map(t => 
      t.id === editingTareaInWorkout.id 
        ? { ...t, ...tareaFormData, metros: parseInt(tareaFormData.metros) || 0 }
        : t
    );
    setTareas(updatedTareas);

    // Actualizar el formData con las nuevas tareas (para recalcular objetivo y material)
    const newTareaIds = formData.tareaIds;
    const newObjetivo = calculateObjective(newTareaIds);
    const newMaterial = calculateMaterial(newTareaIds);

    setFormData({
      ...formData,
      objetivo: newObjetivo,
      material: newMaterial,
    });

    setShowEditTareaModal(false);
    setEditingTareaInWorkout(null);
  };

  // Guardar tarea editada en el workout Y en el banco de tareas
  const saveTareaAndBanco = async () => {
    if (!editingTareaInWorkout) return;

    try {
      // Actualizar en Firestore
      await updateDoc(doc(db, 'tareas', editingTareaInWorkout.id), {
        nombre: tareaFormData.nombre.trim(),
        objetivo: tareaFormData.objetivo,
        material: tareaFormData.material,
        metros: parseInt(tareaFormData.metros) || 0,
        descripcion: tareaFormData.descripcion.trim(),
      });

      // Actualizar la tarea en la lista local de tareas
      const updatedTareas = tareas.map(t => 
        t.id === editingTareaInWorkout.id 
          ? { ...t, ...tareaFormData, metros: parseInt(tareaFormData.metros) || 0 }
          : t
      );
      setTareas(updatedTareas);

      // Actualizar el formData
      const newTareaIds = formData.tareaIds;
      const newObjetivo = calculateObjective(newTareaIds);
      const newMaterial = calculateMaterial(newTareaIds);

      setFormData({
        ...formData,
        objetivo: newObjetivo,
        material: newMaterial,
      });

      setShowEditTareaModal(false);
      setEditingTareaInWorkout(null);
    } catch (error) {
      console.error('Error saving tarea to banco:', error);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setShowSaveModal(false);
    setEditingWorkout(null);
    setFormData({ titulo: '', objetivo: '', material: '', tareaIds: [] });
    // Limpiar filtros de tareas
    setTaskSearch('');
    setTaskFiltroObjetivo('');
    setTaskFiltroMaterial('');
    setTaskFiltroMetros('');
    // Limpiar edición de tarea
    setEditingTareaInWorkout(null);
    setShowEditTareaModal(false);
  };

  const deleteWorkout = async (workoutId: string) => {
    if (!confirm('¿Eliminar este workout?')) return;

    try {
      await deleteDoc(doc(db, 'workouts', workoutId));
      setWorkouts(workouts.filter(w => w.id !== workoutId));
    } catch (error) {
      console.error('Error deleting workout:', error);
    }
  };

  const openAssign = (workout: Workout) => {
    setSelectedWorkout(workout);
    setAssignData({
      grupoId: '',
      clienteId: '',
      fecha: new Date().toISOString().split('T')[0],
      includePdf: false,
    });
    setShowAssignModal(true);
  };

  const getClientesDelGrupo = (grupoId: string) => {
    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo || !grupo.clienteIds) return [];
    return clientes.filter(c => (grupo.clienteIds as string[]).includes(c.id));
  };

  // Limpia y normaliza número de teléfono para wa.me
  const formatPhone = (tel: string): string => {
    const clean = tel.replace(/[\s\-().]/g, '');
    if (!clean) return '';
    if (clean.startsWith('+')) return clean;
    if (clean.startsWith('00')) return '+' + clean.slice(2);
    if (/^[6789]\d{8}$/.test(clean)) return '+34' + clean;
    return clean;
  };

  // Construye el mensaje de WhatsApp para un cliente
  const buildWhatsAppMessage = (nombreCliente: string, w: Workout): string => {
    const fechaFormateada = new Date(assignData.fecha).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    let msg =
      `¡Hola ${nombreCliente}! 🏊 Tienes un nuevo entrenamiento asignado:\n\n` +
      `*${w.titulo}*\n\n` +
      `📅 Fecha: ${fechaFormateada}\n` +
      `🎯 Objetivo: ${w.objetivo}\n` +
      `📏 Metros: ${w.metros}m\n` +
      `🎒 Material: ${w.material}`;

    if (assignData.includePdf && (w as any).pdfUrl) {
      msg += `\n\n📄 *Descarga tu entrenamiento en PDF:*\n${(w as any).pdfUrl}`;
    }

    msg += `\n\n_VideoAnalisis Natación — Pablo Rodríguez Madurga_`;
    return msg;
  };

  const assignWorkout = async () => {
    if (!selectedWorkout || (!assignData.grupoId && !assignData.clienteId) || !assignData.fecha) return;

    setAssignLoading(true);
    try {
      const asignacionesRef = collection(db, 'asignaciones');

      // ── Cliente individual ─────────────────────────────────────────────────
      if (assignData.clienteId) {
        const newAsig = await addDoc(asignacionesRef, {
          workoutId: selectedWorkout.id,
          clienteId: assignData.clienteId,
          grupoId: null,
          fechaAsignada: assignData.fecha,
          estado: 'pendiente',
          createdAt: serverTimestamp(),
        });
        setAsignaciones(prev => [...prev, {
          id: newAsig.id,
          workoutId: selectedWorkout.id,
          clienteId: assignData.clienteId,
          grupoId: '',
          fechaAsignada: assignData.fecha,
          estado: 'pendiente',
        }]);

        const cliente = clientes.find(c => c.id === assignData.clienteId);
        const nombre = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Nadador/a';
        const msg = buildWhatsAppMessage(nombre, selectedWorkout);
        const tel = formatPhone(cliente?.telefono || '');
        const waUrl = tel
          ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
      }

      // ── Grupo completo ─────────────────────────────────────────────────────
      else if (assignData.grupoId) {
        const clientesDelGrupo = getClientesDelGrupo(assignData.grupoId);

        for (const cliente of clientesDelGrupo) {
          const newAsig = await addDoc(asignacionesRef, {
            workoutId: selectedWorkout.id,
            clienteId: cliente.id,
            grupoId: assignData.grupoId,
            fechaAsignada: assignData.fecha,
            estado: 'pendiente',
            createdAt: serverTimestamp(),
          });
          setAsignaciones(prev => [...prev, {
            id: newAsig.id,
            workoutId: selectedWorkout.id,
            clienteId: cliente.id,
            grupoId: assignData.grupoId,
            fechaAsignada: assignData.fecha,
            estado: 'pendiente',
          }]);
        }

        const clientesConTel = clientesDelGrupo.filter(c => c.telefono?.trim());
        const clientesSinTel  = clientesDelGrupo.filter(c => !c.telefono?.trim());
        const grupo = grupos.find(g => g.id === assignData.grupoId);

        if (clientesConTel.length === 0) {
          const msg = buildWhatsAppMessage(grupo?.nombre || 'grupo', selectedWorkout);
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
          clientesConTel.forEach((cliente, idx) => {
            const nombre = `${cliente.nombre} ${cliente.apellido}`;
            const msg = buildWhatsAppMessage(nombre, selectedWorkout);
            const tel = formatPhone(cliente.telefono!);
            setTimeout(() => {
              window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
            }, idx * 600);
          });

          if (clientesSinTel.length > 0) {
            const nombres = clientesSinTel.map(c => `${c.nombre} ${c.apellido}`).join(', ');
            alert(`⚠️ Sin teléfono (no recibirán WhatsApp):\n${nombres}`);
          }
        }
      }

      setShowAssignModal(false);
      setSelectedWorkout(null);
      setAssignData({ grupoId: '', clienteId: '', fecha: new Date().toISOString().split('T')[0], includePdf: false });
    } catch (error) {
      console.error('Error assigning workout:', error);
    } finally {
      setAssignLoading(false);
    }
  };

  const getAsignacionesCount = (workoutId: string) => {
    return asignaciones.filter(a => a.workoutId === workoutId).length;
  };

  const filteredWorkouts = workouts.filter(w => {
    const matchSearch = w.titulo.toLowerCase().includes(search.toLowerCase());
    const matchObjetivo = !filtroObjetivo || w.objetivo === filtroObjetivo;
    const matchMaterial = !filtroMaterial || w.material.toLowerCase().includes(filtroMaterial.toLowerCase());
    const matchMetros = !filtroMetros || w.metros >= parseInt(filtroMetros);
    
    return matchSearch && matchObjetivo && matchMaterial && matchMetros;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="animate-pulse">
            <div className="h-8 bg-ocean-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-ocean-100 rounded w-48"></div>
          </div>
          <div className="h-10 bg-ocean-200 rounded w-36"></div>
        </div>

        {/* Search skeleton */}
        <div className="h-12 bg-ocean-100 rounded-xl animate-pulse"></div>

        {/* Filters skeleton */}
        <div className="flex flex-wrap gap-3">
          <div className="h-10 bg-ocean-100 rounded-lg w-40"></div>
          <div className="h-10 bg-ocean-100 rounded-lg w-32"></div>
          <div className="h-10 bg-ocean-100 rounded-lg w-32"></div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-ocean-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-ocean-100 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-ocean-100 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ocean-800">Workouts</h1>
          <p className="text-ocean-600">Crea y asigna entrenamientos</p>
        </div>
        <Link
          href="/entrenador/workouts/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo Workout
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ocean-400" />
        <input
          type="text"
          placeholder="Buscar workouts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-ocean-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean-500"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroObjetivo}
          onChange={(e) => setFiltroObjetivo(e.target.value)}
          className="px-4 py-2 bg-white border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 text-sm"
        >
          <option value="">Todos los objetivos</option>
          {objetivosOpciones.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Material..."
          value={filtroMaterial}
          onChange={(e) => setFiltroMaterial(e.target.value)}
          className="px-4 py-2 bg-white border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 text-sm w-32"
        />

        <input
          type="number"
          placeholder="Metros (min)"
          value={filtroMetros}
          onChange={(e) => setFiltroMetros(e.target.value)}
          className="px-4 py-2 bg-white border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 text-sm w-32"
        />

        {(filtroObjetivo || filtroMaterial || filtroMetros) && (
          <button
            onClick={() => {
              setFiltroObjetivo('');
              setFiltroMaterial('');
              setFiltroMetros('');
            }}
            className="px-4 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
          >
            Limpiar filtros
          </button>
        )}

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setWorkoutsViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              workoutsViewMode === 'grid'
                ? 'bg-ocean-600 text-white'
                : 'bg-white text-ocean-600 hover:bg-ocean-50 border border-ocean-200'
            }`}
            title="Vista de tarjetas"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setWorkoutsViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${
              workoutsViewMode === 'table'
                ? 'bg-ocean-600 text-white'
                : 'bg-white text-ocean-600 hover:bg-ocean-50 border border-ocean-200'
            }`}
            title="Vista de tabla"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Workouts List */}
      {filteredWorkouts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
          <h3 className="text-lg font-medium text-ocean-700 mb-2">
            No hay workouts creados
          </h3>
          <p className="text-ocean-500 mb-4">
            Crea tu primer workout para asignarlo a tus clientes
          </p>
          <Link
            href="/entrenador/workouts/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
          >
            <Plus className="w-4 h-4" />
            Crear Workout
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWorkouts.map((workout) => {
            const workoutTareas = getTareasDetails(workout.tareaIds);
            
            return (
              <div key={workout.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-ocean-800">{workout.titulo}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-ocean-600 mt-1">
                      <span>🎯 {workout.objetivo}</span>
                      <span>🏊 {workout.metros}m</span>
                      <span>📦 {workout.material}</span>
                      {workoutTareas.length > 0 && (
                        <button
                          onClick={() => setExpandedWorkouts(prev => ({ ...prev, [workout.id]: !prev[workout.id] }))}
                          className="flex items-center gap-1 text-ocean-700 hover:text-ocean-900 font-medium"
                        >
                          <ChevronIcon className={`w-4 h-4 transition-transform ${expandedWorkouts[workout.id] ? 'rotate-180' : ''}`} />
                          📋 {workoutTareas.length} ejercicios {expandedWorkouts[workout.id] ? '(ocultar)' : '(mostrar)'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/entrenador/workouts/${workout.id}/editar`}
                      className="flex items-center gap-2 px-3 py-2 bg-ocean-100 text-ocean-700 rounded-lg hover:bg-ocean-200 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </Link>
                    <button
                      onClick={() => openAssign(workout)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    >
                      <Send className="w-4 h-4" />
                      Asignar
                    </button>
                    <button
                      onClick={() => deleteWorkout(workout.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Tareas */}
                {workoutTareas.length > 0 && expandedWorkouts[workout.id] && (
                  <div className="border-t border-ocean-100 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {workoutTareas.map((tarea, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-ocean-50 rounded-lg px-3 py-2">
                          <span className="w-6 h-6 flex items-center justify-center bg-ocean-200 text-ocean-700 rounded-full text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</span>
                          <span className="text-ocean-500 ml-auto">{tarea.metros}m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">
                {editingWorkout ? 'Editar Workout' : 'Nuevo Workout'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Sección: Info básica (siempre abierta) */}
              <div className="border border-ocean-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('info')}
                  className="w-full flex items-center justify-between p-4 bg-ocean-50 hover:bg-ocean-100 transition-colors"
                >
                  <span className="font-medium text-ocean-800">Información del Workout</span>
                  <ChevronIcon className={`w-5 h-5 text-ocean-600 transition-transform ${openSections.info ? 'rotate-180' : ''}`} />
                </button>
                {openSections.info && (
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ocean-700 mb-2">
                        Título *
                      </label>
                      <input
                        type="text"
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        placeholder="Ej: Entrenamiento Tuesday"
                        className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ocean-700 mb-2">
                          Objetivo
                        </label>
                        <input
                          type="text"
                          value={formData.objetivo}
                          onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                          placeholder="Ej: Resistencia"
                          className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ocean-700 mb-2">
                          Material
                        </label>
                        <input
                          type="text"
                          value={formData.material}
                          onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                          placeholder="Ej: Tabla, Aletas"
                          className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección: Tareas seleccionadas */}
              {formData.tareaIds.length > 0 && (
                <div className="border border-ocean-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('selectedTareas')}
                    className="w-full flex items-center justify-between p-4 bg-ocean-50 hover:bg-ocean-100 transition-colors"
                  >
                    <span className="font-medium text-ocean-800">
                      Tareas ordenadas ({formData.tareaIds.length})
                    </span>
                    <ChevronIcon className={`w-5 h-5 text-ocean-600 transition-transform ${openSections.selectedTareas ? 'rotate-180' : ''}`} />
                  </button>
                  {openSections.selectedTareas && (
                    <div className="p-4 bg-ocean-50">
                      <p className="text-xs font-medium text-ocean-600 mb-2">
                        Arrastra o usa las flechas para reordenar:
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {getSelectedTareas().map((tarea, index) => (
                          <div 
                            key={tarea.id} 
                            className="flex items-center gap-2 bg-white rounded-lg p-2 border border-ocean-200"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', index.toString());
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                              if (fromIndex !== index) {
                                const newTareaIds = [...formData.tareaIds];
                                const [removed] = newTareaIds.splice(fromIndex, 1);
                                newTareaIds.splice(index, 0, removed);
                                const newObjetivo = calculateObjective(newTareaIds);
                                const newMaterial = calculateMaterial(newTareaIds);
                                setFormData({ ...formData, tareaIds: newTareaIds, objetivo: newObjetivo, material: newMaterial });
                              }
                            }}
                          >
                            <GripVertical className="w-4 h-4 text-ocean-400 cursor-grab flex-shrink-0" />
                            <span className="w-6 h-6 bg-ocean-600 text-white rounded-full text-xs flex items-center justify-center flex-shrink-0">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</p>
                              <p className="text-xs text-ocean-500">
                                {Array.isArray(tarea.objetivo) ? tarea.objetivo.join(', ') : tarea.objetivo} • {tarea.metros}m
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => moveTareaUp(index)}
                                disabled={index === 0}
                                className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Subir"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTareaDown(index)}
                                disabled={index === formData.tareaIds.length - 1}
                                className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Bajar"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTareaInWorkout(tarea);
                                  setTareaFormData({
                                    nombre: tarea.nombre,
                                    objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean),
                                    material: tarea.material,
                                    metros: tarea.metros.toString(),
                                    descripcion: tarea.descripcion || '',
                                  });
                                  setShowEditTareaModal(true);
                                }}
                                className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTareaFromWorkout(tarea.id)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                                title="Eliminar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sección: Banco de tareas */}
              <div className="border border-ocean-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('tareasBanco')}
                  className="w-full flex items-center justify-between p-4 bg-ocean-50 hover:bg-ocean-100 transition-colors"
                >
                  <span className="font-medium text-ocean-800">
                    Agregar Tareas ({tareas.length} disponibles)
                  </span>
                  <ChevronIcon className={`w-5 h-5 text-ocean-600 transition-transform ${openSections.tareasBanco ? 'rotate-180' : ''}`} />
                </button>
                {openSections.tareasBanco && (
                  <div className="p-4">
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Buscar tareas..."
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        className="flex-1 min-w-[150px] px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      />
                      <select
                        value={taskFiltroObjetivo}
                        onChange={(e) => setTaskFiltroObjetivo(e.target.value)}
                        className="px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      >
                        <option value="">Objetivo</option>
                        {objetivosOpciones.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <select
                        value={taskFiltroMaterial}
                        onChange={(e) => setTaskFiltroMaterial(e.target.value)}
                        className="px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      >
                        <option value="">Material</option>
                        {materialOpciones.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Metros min"
                        value={taskFiltroMetros}
                        onChange={(e) => setTaskFiltroMetros(e.target.value)}
                        className="w-20 px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      />
                      {(taskSearch || taskFiltroObjetivo || taskFiltroMaterial || taskFiltroMetros) && (
                        <button
                          onClick={() => {
                            setTaskSearch('');
                            setTaskFiltroObjetivo('');
                            setTaskFiltroMaterial('');
                            setTaskFiltroMetros('');
                          }}
                          className="px-2 py-1 text-xs text-red-500 hover:text-red-700"
                        >
                          Limpiar
                        </button>
                      )}
                      <button
                        onClick={() => setTareasViewMode('grid')}
                        className={`p-1.5 rounded ${tareasViewMode === 'grid' ? 'bg-ocean-600 text-white' : 'text-ocean-600 hover:bg-ocean-50'}`}
                        title="Vista de tarjetas"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTareasViewMode('table')}
                        className={`p-1.5 rounded ${tareasViewMode === 'table' ? 'bg-ocean-600 text-white' : 'text-ocean-600 hover:bg-ocean-50'}`}
                        title="Vista de tabla"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Indicador de grupo recomendado */}
                    {(() => {
                      const { recommendedGroupName } = getFilteredAndSortedTareas();
                      return (
                        <p className="text-xs text-amber-600 font-medium mb-2">
                          ⭐ Recomendado: {recommendedGroupName}
                        </p>
                      );
                    })()}

                    {tareas.length === 0 ? (
                      <div className="text-center py-8 bg-ocean-50 rounded-lg">
                        <p className="text-ocean-500">No hay tareas creadas</p>
                        <p className="text-sm text-ocean-400">Crea tareas primero en el Banco de Tareas</p>
                      </div>
                    ) : tareasViewMode === 'table' ? (
                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-sm">
                          <thead className="bg-ocean-50 sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left"></th>
                              <th className="px-2 py-1 text-left">Nombre</th>
                              <th className="px-2 py-1 text-left">Objetivos</th>
                              <th className="px-2 py-1 text-left">Metros</th>
                              <th className="px-2 py-1 text-left">Material</th>
                              <th className="px-2 py-1 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ocean-100">
                            {getFilteredAndSortedTareas().sorted.map((tarea) => {
                              const objetivosArray = Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean);
                              const isRecommended = objetivosArray.some(o => getFilteredAndSortedTareas().recommendedObjectives.includes(o));
                              return (
                                <tr 
                                  key={tarea.id} 
                                  className={`cursor-pointer ${formData.tareaIds.includes(tarea.id) ? 'bg-ocean-50' : 'hover:bg-ocean-25'}`}
                                >
                                  <td className="px-2 py-1" onClick={() => {
                                    const newTareaIds = formData.tareaIds.includes(tarea.id)
                                      ? formData.tareaIds.filter(id => id !== tarea.id)
                                      : [...formData.tareaIds, tarea.id];
                                    const newObjetivo = calculateObjective(newTareaIds);
                                    const newMaterial = calculateMaterial(newTareaIds);
                                    setFormData({ 
                                      ...formData, 
                                      tareaIds: newTareaIds,
                                      objetivo: newObjetivo,
                                      material: newMaterial
                                    });
                                  }}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      formData.tareaIds.includes(tarea.id)
                                        ? 'border-ocean-500 bg-ocean-500'
                                        : 'border-ocean-300'
                                    }`}>
                                      {formData.tareaIds.includes(tarea.id) && (
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1">
                                    <div className="flex items-center gap-2">
                                      {isRecommended && <span className="text-amber-500">⭐</span>}
                                      <span className="text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1">
                                    <div className="flex flex-wrap gap-1">
                                      {objetivosArray.map((obj, idx) => (
                                        <span key={idx} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                          {obj}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 text-ocean-600">{tarea.metros}m</td>
                                  <td className="px-2 py-1 text-ocean-600">{tarea.material || '-'}</td>
                                  <td className="px-2 py-1 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTareaInWorkout(tarea);
                                        setTareaFormData({
                                          nombre: tarea.nombre,
                                          objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean),
                                          material: tarea.material,
                                          metros: tarea.metros.toString(),
                                          descripcion: tarea.descripcion || '',
                                        });
                                        setShowEditTareaModal(true);
                                      }}
                                      className="p-1 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {getFilteredAndSortedTareas().sorted.map((tarea) => {
                          const objetivosArray = Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean);
                          const isRecommended = objetivosArray.some(o => getFilteredAndSortedTareas().recommendedObjectives.includes(o));
                          return (<button
                            key={tarea.id}
                            type="button"
                            onClick={() => {
                              const newTareaIds = formData.tareaIds.includes(tarea.id)
                                ? formData.tareaIds.filter(id => id !== tarea.id)
                                : [...formData.tareaIds, tarea.id];
                              const newObjetivo = calculateObjective(newTareaIds);
                              const newMaterial = calculateMaterial(newTareaIds);
                              setFormData({ 
                                ...formData, 
                                tareaIds: newTareaIds,
                                objetivo: newObjetivo,
                                material: newMaterial
                              });
                            }}
                            className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-colors ${
                              formData.tareaIds.includes(tarea.id)
                                ? 'border-ocean-500 bg-ocean-50'
                                : isRecommended
                                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
                                  : 'border-ocean-200 hover:border-ocean-300'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {isRecommended && <span className="text-amber-500">⭐</span>}
                                <p className="font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</p>
                              </div>
                              <p className="text-xs text-ocean-500">
                                {Array.isArray(tarea.objetivo) ? tarea.objetivo.join(', ') : tarea.objetivo} • {tarea.metros}m
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTareaInWorkout(tarea);
                                  setTareaFormData({
                                    nombre: tarea.nombre,
                                    objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean),
                                    material: tarea.material,
                                    metros: tarea.metros.toString(),
                                    descripcion: tarea.descripcion || '',
                                  });
                                  setShowEditTareaModal(true);
                                }}
                                className="p-1 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                formData.tareaIds.includes(tarea.id)
                                  ? 'border-ocean-500 bg-ocean-500'
                                  : 'border-ocean-300'
                              }`}>
                                {formData.tareaIds.includes(tarea.id) && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                            </div>
                          </button>);
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-ocean-50 p-4 rounded-lg">
                <p className="text-sm text-ocean-700">
                  <strong>Total:</strong> {calculateMetros(formData.tareaIds)} metros
                </p>
              </div>

              <button
                onClick={createWorkout}
                disabled={!formData.titulo.trim() || formData.tareaIds.length === 0}
                className="w-full py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingWorkout ? 'Guardar Cambios' : 'Crear Workout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ocean-800">Asignar Workout</h2>
                <p className="text-sm text-ocean-500 mt-0.5">{selectedWorkout.titulo} · {selectedWorkout.metros}m · {selectedWorkout.objetivo}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 text-ocean-400 hover:text-ocean-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grupo */}
            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Grupo</label>
              <select
                value={assignData.grupoId}
                onChange={(e) => setAssignData({ ...assignData, grupoId: e.target.value, clienteId: '' })}
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              >
                <option value="">Seleccionar grupo...</option>
                {grupos.map((g) => {
                  const n = getClientesDelGrupo(g.id).length;
                  const conTel = getClientesDelGrupo(g.id).filter(c => c.telefono?.trim()).length;
                  return (
                    <option key={g.id} value={g.id}>
                      {g.nombre} ({n} cliente{n !== 1 ? 's' : ''}, {conTel} con teléfono)
                    </option>
                  );
                })}
              </select>
              {assignData.grupoId && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {getClientesDelGrupo(assignData.grupoId).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs bg-ocean-50 rounded px-2 py-1">
                      <span className="text-ocean-700 font-medium">{c.nombre} {c.apellido}</span>
                      {c.telefono?.trim() ? (
                        <span className="text-green-600">📱 {c.telefono}</span>
                      ) : (
                        <span className="text-red-400">Sin teléfono</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-ocean-400 text-xs">
              <div className="flex-1 h-px bg-ocean-100" /><span>o</span><div className="flex-1 h-px bg-ocean-100" />
            </div>

            {/* Cliente específico */}
            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Cliente específico</label>
              <select
                value={assignData.clienteId}
                onChange={(e) => setAssignData({ ...assignData, clienteId: e.target.value, grupoId: '' })}
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido}{c.telefono ? ` — ${c.telefono}` : ' — sin teléfono'}
                  </option>
                ))}
              </select>
              {assignData.clienteId && (() => {
                const sel = clientes.find(c => c.id === assignData.clienteId);
                return sel ? (
                  <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${sel.telefono?.trim() ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {sel.telefono?.trim()
                      ? <>📱 WhatsApp enviado a <strong>{formatPhone(sel.telefono)}</strong></>
                      : <>⚠️ Sin teléfono — se abrirá WhatsApp Web sin destinatario</>}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Fecha del entrenamiento</label>
              <input
                type="date"
                value={assignData.fecha}
                onChange={(e) => setAssignData({ ...assignData, fecha: e.target.value })}
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>

            {/* PDF */}
            <div className={`rounded-lg border p-3 ${assignData.includePdf ? 'border-ocean-300 bg-ocean-50' : 'border-ocean-100 bg-gray-50'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignData.includePdf}
                  onChange={(e) => setAssignData({ ...assignData, includePdf: e.target.checked })}
                  className="w-4 h-4 rounded border-ocean-300 text-ocean-600"
                />
                <div>
                  <p className="text-sm font-medium text-ocean-700">Incluir enlace de descarga del PDF</p>
                  <p className="text-xs text-ocean-500 mt-0.5">
                    {(selectedWorkout as any)?.pdfUrl
                      ? 'Se adjuntará el enlace en el mensaje de WhatsApp'
                      : 'Este workout no tiene PDF — edítalo y guárdalo primero'}
                  </p>
                </div>
              </label>
              {assignData.includePdf && (selectedWorkout as any)?.pdfUrl && (
                <div className="mt-2 text-xs text-ocean-500 bg-white rounded px-2 py-1 border border-ocean-200 truncate">
                  🔗 {(selectedWorkout as any).pdfUrl}
                </div>
              )}
            </div>

            <button
              onClick={assignWorkout}
              disabled={assignLoading || (!assignData.grupoId && !assignData.clienteId) || !assignData.fecha}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {assignLoading ? 'Asignando...' : 'Asignar y enviar por WhatsApp'}
            </button>

            {assignData.grupoId && getClientesDelGrupo(assignData.grupoId).filter(c => c.telefono?.trim()).length > 1 && (
              <p className="text-xs text-center text-ocean-400">
                Se abrirá una ventana por cada cliente con teléfono. Permite ventanas emergentes en tu navegador.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Guardar Cambios</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-ocean-600">
                ¿Cómo quieres guardar los cambios del workout <strong>"{formData.titulo}"</strong>?
              </p>

              <div className="space-y-3">
                <button
                  onClick={saveWorkoutOnly}
                  className="w-full flex items-center gap-3 p-4 border-2 border-ocean-200 rounded-lg hover:border-ocean-500 hover:bg-ocean-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-ocean-100 rounded-full flex items-center justify-center">
                    <Edit className="w-5 h-5 text-ocean-600" />
                  </div>
                  <div>
                    <p className="font-medium text-ocean-800">Solo este workout</p>
                    <p className="text-sm text-ocean-500">Las tareas del banco de tareas no se modifican</p>
                  </div>
                </button>

                <button
                  onClick={saveWorkoutAndBanco}
                  className="w-full flex items-center gap-3 p-4 border-2 border-amber-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Copy className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">Actualizar banco de tareas</p>
                    <p className="text-sm text-amber-600">Las tareas editadas se sobrescribirán en el banco</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowSaveModal(false)}
                className="w-full py-2 text-ocean-500 hover:text-ocean-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tarea Modal */}
      {showEditTareaModal && editingTareaInWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Editar Tarea</h2>
              <button
                onClick={() => {
                  setShowEditTareaModal(false);
                  setEditingTareaInWorkout(null);
                }}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={tareaFormData.nombre}
                  onChange={(e) => setTareaFormData({ ...tareaFormData, nombre: e.target.value })}
                  placeholder="Ej: Nado libre 50m"
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Objetivos
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {objetivosOpciones.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                        tareaFormData.objetivo.includes(opt)
                          ? 'border-ocean-500 bg-ocean-50'
                          : 'border-ocean-200 hover:border-ocean-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={tareaFormData.objetivo.includes(opt)}
                        onChange={(e) => {
                          const nuevos = e.target.checked
                            ? [...tareaFormData.objetivo, opt]
                            : tareaFormData.objetivo.filter(o => o !== opt);
                          setTareaFormData({ ...tareaFormData, objetivo: nuevos });
                        }}
                        className="w-4 h-4 text-ocean-600 rounded focus:ring-ocean-500"
                      />
                      <span className="text-sm text-ocean-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">
                    Metros
                  </label>
                  <input
                    type="number"
                    value={tareaFormData.metros}
                    onChange={(e) => setTareaFormData({ ...tareaFormData, metros: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">
                    Material
                  </label>
                  <select
                    value={tareaFormData.material}
                    onChange={(e) => setTareaFormData({ ...tareaFormData, material: e.target.value })}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="">Seleccionar</option>
                  {materialOpciones.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={tareaFormData.descripcion}
                  onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })}
                  rows={3}
                  placeholder="Notas adicionales..."
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 resize-none"
                />
              </div>
              </div>

              <p className="text-sm text-ocean-600">
                ¿Cómo quieres guardar los cambios de la tarea <strong>"{tareaFormData.nombre}"</strong>?
              </p>

              <div className="space-y-3">
                <button
                  onClick={saveTareaWorkoutOnly}
                  className="w-full flex items-center gap-3 p-4 border-2 border-ocean-200 rounded-lg hover:border-ocean-500 hover:bg-ocean-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-ocean-100 rounded-full flex items-center justify-center">
                    <Edit className="w-5 h-5 text-ocean-600" />
                  </div>
                  <div>
                    <p className="font-medium text-ocean-800">Solo este workout</p>
                    <p className="text-sm text-ocean-500">La tarea se modifica solo en este workout</p>
                  </div>
                </button>

                <button
                  onClick={saveTareaAndBanco}
                  className="w-full flex items-center gap-3 p-4 border-2 border-amber-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Copy className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800">Actualizar banco de tareas</p>
                    <p className="text-sm text-amber-600">La tarea se sobrescribirá en el banco de tareas</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => {
                  setShowEditTareaModal(false);
                  setEditingTareaInWorkout(null);
                }}
                className="w-full py-2 text-ocean-500 hover:text-ocean-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
