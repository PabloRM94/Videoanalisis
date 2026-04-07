'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, storage } from '@/config/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Save, Loader2, ChevronUp, ChevronDown, Send, X, Edit, Eye, FileDown, Plus } from 'lucide-react';
import { generateWorkoutPDF } from '@/lib/generateWorkoutPDF';

// Tipos
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
  objetivo: string;
  material: string;
  metros: number;
  tareaIds: string[];
  fecha: string;
  comentarios?: string;
  pdfUrl?: string;
}

interface Grupo {
  id: string;
  nombre: string;
  clienteIds: string[];
}

interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono?: string;
}

const objetivosOpciones = [
  'CLNT', 'TEC', 'AEL', 'AEM', 'AEI', 'VEL', 'REST', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC', 'INI', 'CROSS', 'FUER'
];

const MATERIAL_ALIASES: Record<string, string> = {
  'pull': 'Pullboy', 'Pull': 'Pullboy', 'pullboy': 'Pullboy', 'pull boy': 'Pullboy', 'Pull boy': 'Pullboy',
};
const normalizeMaterial = (m: string): string => MATERIAL_ALIASES[m.trim()] ?? m;

const materialOpciones = [
  'Tabla', 'Aletas', 'Pullboy', 'Churumbela', 'Bola', 'Cuerda', 'Pletinas', 'Nadador', 'Otro', 'Sin material'
];

export default function EditarWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const workoutId = params?.id as string;
  const isNewMode = workoutId === 'nuevo';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);

  // Estado para nuevo workout guardado (para habilitar Asignar en modo nuevo)
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [savedWorkoutData, setSavedWorkoutData] = useState<Workout | null>(null);

  // Estados para modales
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [isCreatingNewTarea, setIsCreatingNewTarea] = useState(false);
  const [editingTareaInWorkout, setEditingTareaInWorkout] = useState<Tarea | null>(null);
  const [tareaFormData, setTareaFormData] = useState({
    nombre: '',
    objetivo: [] as string[],
    material: '',
    metros: '',
    descripcion: '',
  });
  // Estado para modo de guardado de tarea: 'create' = nueva tarea, 'update' = editar existente
  const [tareaSaveMode, setTareaSaveMode] = useState<'create' | 'update' | null>(null);

  // Estado para asignación
  const [assignData, setAssignData] = useState({
    grupoId: '',
    clienteId: '',
    fecha: new Date().toISOString().split('T')[0],
    includePdf: false,
  });
  const [assignLoading, setAssignLoading] = useState(false);

  // Filtros para banco de tareas
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFiltroObjetivo, setTaskFiltroObjetivo] = useState('');
  const [taskFiltroMaterial, setTaskFiltroMaterial] = useState('');
  const [taskFiltroMetros, setTaskFiltroMetros] = useState('');

  // Estado para previsualización PDF
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    objetivo: '',
    material: '',
    tareaIds: [] as string[],
    comentarios: '',
  });

  // Fetch workout, tareas, grupos y clientes
  useEffect(() => {
    const fetchData = async () => {
      if (!workoutId) {
        setError('ID de workout no proporcionado');
        setLoading(false);
        return;
      }

      try {
        if (isNewMode) {
          setWorkout(null);
          setFormData({ titulo: '', objetivo: '', material: '', tareaIds: [], comentarios: '' });
        } else {
          const workoutDoc = await getDoc(doc(db, 'workouts', workoutId));
          if (!workoutDoc.exists()) {
            setError('Workout no encontrado');
            setLoading(false);
            return;
          }
          const workoutData = { id: workoutDoc.id, ...workoutDoc.data() } as Workout;
          setWorkout(workoutData);
          setFormData({
            titulo: workoutData.titulo,
            objetivo: workoutData.objetivo,
            material: workoutData.material,
            tareaIds: workoutData.tareaIds || [],
            comentarios: workoutData.comentarios || '',
          });
        }

        const tareasSnap = await getDocs(collection(db, 'tareas'));
        setTareas(tareasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tarea[]);

        const gruposSnap = await getDocs(collection(db, 'grupos'));
        setGrupos(gruposSnap.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre,
          clienteIds: d.data().clienteIds || [],
        })) as Grupo[]);

        const clientesSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'cliente')));
        setClientes(clientesSnap.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre || '',
          apellido: d.data().apellido || '',
          telefono: d.data().telefono || '',
        })) as Cliente[]);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching workout:', err);
        setError('Error al cargar el workout');
        setLoading(false);
      }
    };

    fetchData();
  }, [workoutId, isNewMode]);

  // Sistema de recomendaciones + filtros (incluyendo metros)
  const getFilteredAndSortedTareas = () => {
    const grupo1 = ['CLNT', 'TEC', 'INI'];
    const grupo2 = ['VEL', 'FUER', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC'];
    const grupo3 = ['AEL', 'AEM', 'AEI'];

    const currentMainObjective = formData.tareaIds.length > 0
      ? calculateObjective(formData.tareaIds)
      : null;

    let recommendedObjectives: string[] = [];
    if (currentMainObjective) {
      if (grupo1.includes(currentMainObjective)) recommendedObjectives = [...grupo2];
      else if (grupo2.includes(currentMainObjective)) recommendedObjectives = [...grupo3];
      else if (grupo3.includes(currentMainObjective)) recommendedObjectives = [...grupo3];
      else recommendedObjectives = [...grupo1];
    } else {
      recommendedObjectives = [...grupo1];
    }

    const filtered = tareas.filter(t => {
      const objetivosArray = Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo].filter(Boolean);
      const matchSearch =
        !taskSearch ||
        t.nombre.toLowerCase().includes(taskSearch.toLowerCase()) ||
        objetivosArray.some(o => o.toLowerCase().includes(taskSearch.toLowerCase()));
      const matchObjetivo = !taskFiltroObjetivo || objetivosArray.includes(taskFiltroObjetivo);
      const matchMaterial = !taskFiltroMaterial || t.material === taskFiltroMaterial;
      // Issue #2: filtro de metros (mínimo de metros)
      const matchMetros = !taskFiltroMetros || t.metros >= parseInt(taskFiltroMetros);

      return matchSearch && matchObjetivo && matchMaterial && matchMetros;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aObj = Array.isArray(a.objetivo) ? a.objetivo : [a.objetivo].filter(Boolean);
      const bObj = Array.isArray(b.objetivo) ? b.objetivo : [b.objetivo].filter(Boolean);
      const aR = aObj.some(o => recommendedObjectives.includes(o));
      const bR = bObj.some(o => recommendedObjectives.includes(o));
      if (aR && !bR) return -1;
      if (!aR && bR) return 1;
      return 0;
    });

    return { sorted, recommendedObjectives };
  };

  const calculateObjective = (tareaIds: string[]): string => {
    const sel = tareas.filter(t => tareaIds.includes(t.id));
    const all = sel.flatMap(t => Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo]).filter(Boolean);
    if (!all.length) return 'General';
    const counts: Record<string, number> = {};
    all.forEach(o => { counts[o] = (counts[o] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
  };

  const calculateMetros = (tareaIds: string[]): number =>
    tareas.filter(t => tareaIds.includes(t.id)).reduce((acc, t) => acc + t.metros, 0);

  const calculateMaterial = (tareaIds: string[]): string => {
    const mats = tareas.filter(t => tareaIds.includes(t.id) && t.material).map(t => t.material);
    return [...new Set(mats)].join(', ') || 'Sin material';
  };

  const moveTareaUp = (index: number) => {
    if (index === 0) return;
    const ids = [...formData.tareaIds];
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    setFormData({ ...formData, tareaIds: ids });
  };

  const moveTareaDown = (index: number) => {
    if (index === formData.tareaIds.length - 1) return;
    const ids = [...formData.tareaIds];
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    setFormData({ ...formData, tareaIds: ids });
  };

  const toggleTarea = (tareaId: string) => {
    const newIds = formData.tareaIds.includes(tareaId)
      ? formData.tareaIds.filter(id => id !== tareaId)
      : [...formData.tareaIds, tareaId];
    setFormData({ ...formData, tareaIds: newIds });
  };

  // Issue #3: Abrir modal para EDITAR tarea existente
  const openEditTareaModal = (tarea: Tarea) => {
    setIsCreatingNewTarea(false);
    setEditingTareaInWorkout(tarea);
    setTareaFormData({
      nombre: tarea.nombre,
      objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo],
      material: tarea.material,
      metros: tarea.metros.toString(),
      descripcion: tarea.descripcion || '',
    });
    setShowTareaModal(true);
  };

  // Issue #3: Abrir modal para CREAR nueva tarea
  const openNewTareaModal = () => {
    setIsCreatingNewTarea(true);
    setEditingTareaInWorkout(null);
    setTareaFormData({ nombre: '', objetivo: [], material: '', metros: '', descripcion: '' });
    setShowTareaModal(true);
  };

  // Guardar tarea: crear nueva o actualizar existente en el banco
  const handleSaveTarea = async (saveMode?: 'create' | 'update') => {
    const mode = saveMode || tareaSaveMode;
    
    // Caso 1: Crear nueva tarea desde el banco de tareas
    if (isCreatingNewTarea) {
      try {
        const newTareaRef = await addDoc(collection(db, 'tareas'), {
          nombre: tareaFormData.nombre,
          objetivo: tareaFormData.objetivo,
          material: tareaFormData.material,
          metros: parseInt(tareaFormData.metros) || 0,
          descripcion: tareaFormData.descripcion,
        });
        const newTarea: Tarea = {
          id: newTareaRef.id,
          nombre: tareaFormData.nombre,
          objetivo: tareaFormData.objetivo,
          material: tareaFormData.material,
          metros: parseInt(tareaFormData.metros) || 0,
          descripcion: tareaFormData.descripcion,
        };
        setTareas(prev => [...prev, newTarea]);
        setFormData(prev => ({ ...prev, tareaIds: [...prev.tareaIds, newTareaRef.id] }));
      } catch (err) {
        console.error('Error creando tarea:', err);
        alert('Error al crear la tarea');
        return;
      }
    }
    // Caso 2: Editar tarea existente - dos opciones
    else if (editingTareaInWorkout) {
      if (mode === 'create') {
        // Crear COPIA NUEVA en el banco (la original queda intacta)
        try {
          const newTareaRef = await addDoc(collection(db, 'tareas'), {
            nombre: tareaFormData.nombre,
            objetivo: tareaFormData.objetivo,
            material: tareaFormData.material,
            metros: parseInt(tareaFormData.metros) || 0,
            descripcion: tareaFormData.descripcion,
          });
          const newTarea: Tarea = {
            id: newTareaRef.id,
            nombre: tareaFormData.nombre,
            objetivo: tareaFormData.objetivo,
            material: tareaFormData.material,
            metros: parseInt(tareaFormData.metros) || 0,
            descripcion: tareaFormData.descripcion,
          };
          setTareas(prev => [...prev, newTarea]);
          // Añadir la nueva tarea al workout (reemplazar la original)
          setFormData(prev => ({
            ...prev,
            tareaIds: prev.tareaIds.map(id => id === editingTareaInWorkout.id ? newTareaRef.id : id)
          }));
        } catch (err) {
          console.error('Error creando copia de tarea:', err);
          alert('Error al crear la copia de la tarea');
          return;
        }
      } else if (mode === 'update') {
        // Actualizar la tarea ORIGINAL en el banco
        try {
          await updateDoc(doc(db, 'tareas', editingTareaInWorkout.id), {
            nombre: tareaFormData.nombre,
            objetivo: tareaFormData.objetivo,
            material: tareaFormData.material,
            metros: parseInt(tareaFormData.metros) || 0,
            descripcion: tareaFormData.descripcion,
          });
          // Actualizar en memoria local
          setTareas(prev => prev.map(t =>
            t.id === editingTareaInWorkout.id
              ? { ...t, nombre: tareaFormData.nombre, objetivo: tareaFormData.objetivo, material: tareaFormData.material, metros: parseInt(tareaFormData.metros) || 0, descripcion: tareaFormData.descripcion }
              : t
          ));
        } catch (err) {
          console.error('Error actualizando tarea:', err);
          alert('Error al guardar los cambios de la tarea');
          return;
        }
      }
    }
    setShowTareaModal(false);
    setEditingTareaInWorkout(null);
    setTareaSaveMode(null);
  };

  // Cerrar modal de tarea y limpiar estados
  const closeTareaModal = () => {
    setShowTareaModal(false);
    setEditingTareaInWorkout(null);
    setTareaSaveMode(null);
    setTareaFormData({ nombre: '', objetivo: [], material: '', metros: '', descripcion: '' });
  };

  // Previsualizar PDF
  const handlePreviewPdf = async () => {
    if (formData.tareaIds.length === 0 || !formData.titulo.trim()) {
      alert('Agrega un título y tareas para previsualizar el PDF');
      return;
    }
    setGeneratingPdf(true);
    try {
      // Preservar orden de tareaIds (issue #6)
      const selTareas = formData.tareaIds.map(id => tareas.find(t => t.id === id)).filter(Boolean) as Tarea[];
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      const blobUrl = await generateWorkoutPDF(
        { titulo: formData.titulo, comentarios: formData.comentarios },
        selTareas,
        calculateObjective(formData.tareaIds),
        calculateMaterial(formData.tareaIds),
        calculateMetros(formData.tareaIds),
      );
      setPdfPreviewUrl(blobUrl);
      setShowPdfPreview(true);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      alert('Error al generar la previsualización');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Issue #1: Fix spinner — router.push movido al finally DESPUÉS de setSaving(false)
  const handleSave = async () => {
    if (!formData.titulo.trim()) return;
    setSaving(true);
    let redirectAfter = false;
    try {
      // Preservar orden de tareaIds (issue #6)
      const selTareas = formData.tareaIds.map(id => tareas.find(t => t.id === id)).filter(Boolean) as Tarea[];
      const totalMetros = calculateMetros(formData.tareaIds);
      const objetivoCalculado = calculateObjective(formData.tareaIds);
      const materialCalculado = calculateMaterial(formData.tareaIds);

      const blobUrl = await generateWorkoutPDF(
        { titulo: formData.titulo, comentarios: formData.comentarios },
        selTareas,
        objetivoCalculado,
        materialCalculado,
        totalMetros,
      );

      let workoutIdSaved: string;

      if (isNewMode) {
        const newDoc = await addDoc(collection(db, 'workouts'), {
          titulo: formData.titulo.trim(),
          objetivo: objetivoCalculado,
          material: materialCalculado,
          metros: totalMetros,
          tareaIds: formData.tareaIds,
          comentarios: formData.comentarios.trim(),
          fecha: new Date().toISOString(),
        });
        workoutIdSaved = newDoc.id;
      } else {
        if (!workout) return;
        await updateDoc(doc(db, 'workouts', workout.id), {
          titulo: formData.titulo.trim(),
          objetivo: objetivoCalculado,
          material: materialCalculado,
          metros: totalMetros,
          tareaIds: formData.tareaIds,
          comentarios: formData.comentarios.trim(),
        });
        workoutIdSaved = workout.id;
        redirectAfter = true;
      }

      // Subir PDF a Storage
      const blobResp = await fetch(blobUrl);
      const pdfBlob = await blobResp.blob();
      const arrayBuf = await pdfBlob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      let binary = '';
      uint8.forEach(b => { binary += String.fromCharCode(b); });
      const pdfBase64 = btoa(binary);

      const pdfRef = ref(storage, `workouts/${workoutIdSaved}_workout.pdf`);
      await uploadString(pdfRef, pdfBase64, 'base64', { contentType: 'application/pdf' });
      const pdfUrl = await getDownloadURL(pdfRef);
      await updateDoc(doc(db, 'workouts', workoutIdSaved), { pdfUrl });

      // Descargar localmente
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${formData.titulo.replace(/\s+/g, '_')}_workout.pdf`;
      link.click();
      URL.revokeObjectURL(blobUrl);

      // Issue #5: En modo nuevo, habilitar botón Asignar en lugar de redirigir
      if (isNewMode) {
        const builtWorkout: Workout = {
          id: workoutIdSaved,
          titulo: formData.titulo.trim(),
          objetivo: objetivoCalculado,
          material: materialCalculado,
          metros: totalMetros,
          tareaIds: formData.tareaIds,
          fecha: new Date().toISOString(),
          comentarios: formData.comentarios.trim(),
          pdfUrl,
        };
        setSavedWorkoutId(workoutIdSaved);
        setSavedWorkoutData(builtWorkout);
        setWorkout(builtWorkout);
      }
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Error al guardar el workout');
    } finally {
      // Issue #1: setSaving ANTES de router.push para que el spinner desaparezca
      setSaving(false);
      if (redirectAfter) {
        router.push('/entrenador/workouts');
      }
    }
  };

  // Issue #7: WhatsApp iOS fix — construir URLs ANTES de los awaits
  const buildWhatsAppMessage = (nombreCliente: string, workoutRef: Workout, fechaStr: string, pdfUrl?: string): string => {
    const fechaFormateada = new Date(fechaStr).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    let msg =
      `¡Hola ${nombreCliente}! 🏊 Tienes un nuevo entrenamiento asignado:\n\n` +
      `*${workoutRef.titulo}*\n\n` +
      `📅 Fecha: ${fechaFormateada}\n` +
      `🎯 Objetivo: ${workoutRef.objetivo}\n` +
      `📏 Metros: ${workoutRef.metros}m\n` +
      `🎒 Material: ${workoutRef.material}`;
    if (assignData.includePdf && pdfUrl) {
      msg += `\n\n📄 *Descarga tu entrenamiento en PDF:*\n${pdfUrl}`;
    }
    msg += `\n\n_VideoAnalisis Natación — Pablo Rodríguez Madurga_`;
    return msg;
  };

  const formatPhone = (tel: string): string => {
    const clean = tel.replace(/[\s\-().]/g, '');
    if (!clean) return '';
    if (clean.startsWith('+')) return clean;
    if (clean.startsWith('00')) return '+' + clean.slice(2);
    if (/^[6789]\d{8}$/.test(clean)) return '+34' + clean;
    return clean;
  };

  const getClientesDelGrupo = (grupoId: string) => {
    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo || !grupo.clienteIds) return [];
    return clientes.filter(c => grupo.clienteIds.includes(c.id));
  };

  // Issue #7: handleAssign — pre-computar URLs antes de los awaits para iOS Safari
  const handleAssign = async () => {
    const workoutRef = savedWorkoutData || workout;
    if (!workoutRef || (!assignData.grupoId && !assignData.clienteId) || !assignData.fecha) return;

    setAssignLoading(true);
    try {
      const asignacionesRef = collection(db, 'asignaciones');
      const pdfUrl = workoutRef.pdfUrl;

      if (assignData.clienteId) {
        // Pre-computar URL de WhatsApp ANTES del await (fix iOS Safari)
        const cliente = clientes.find(c => c.id === assignData.clienteId);
        const nombreCompleto = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Nadador/a';
        const msg = buildWhatsAppMessage(nombreCompleto, workoutRef, assignData.fecha, pdfUrl);
        const tel = formatPhone(cliente?.telefono || '');
        const waUrl = tel
          ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;

        // Primero abrir WhatsApp (síncrono, antes del await) — fix iOS
        window.open(waUrl, '_blank');

        // Luego guardar en Firestore (async)
        await addDoc(asignacionesRef, {
          workoutId: workoutRef.id,
          clienteId: assignData.clienteId,
          grupoId: null,
          fechaAsignada: assignData.fecha,
          estado: 'pendiente',
        });
      } else if (assignData.grupoId) {
        const grupo = grupos.find(g => g.id === assignData.grupoId);
        const clientesDelGrupo = getClientesDelGrupo(assignData.grupoId);
        const clientesConTel = clientesDelGrupo.filter(c => c.telefono?.trim());
        const clientesSinTel = clientesDelGrupo.filter(c => !c.telefono?.trim());

        // Pre-computar todas las URLs ANTES de los awaits (fix iOS Safari)
        let waUrls: string[] = [];
        if (clientesConTel.length === 0) {
          const msg = buildWhatsAppMessage(grupo?.nombre || 'grupo', workoutRef, assignData.fecha, pdfUrl);
          waUrls = [`https://wa.me/?text=${encodeURIComponent(msg)}`];
        } else {
          waUrls = clientesConTel.map(cliente => {
            const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
            const msg = buildWhatsAppMessage(nombreCompleto, workoutRef, assignData.fecha, pdfUrl);
            const tel = formatPhone(cliente.telefono!);
            return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
          });
        }

        // Guardar asignaciones en Firestore
        for (const cliente of clientesDelGrupo) {
          await addDoc(asignacionesRef, {
            workoutId: workoutRef.id,
            clienteId: cliente.id,
            grupoId: assignData.grupoId,
            fechaAsignada: assignData.fecha,
            estado: 'pendiente',
          });
        }

        // Abrir WhatsApp después de los awaits con setTimeout escalonado
        waUrls.forEach((url, idx) => {
          setTimeout(() => window.open(url, '_blank'), idx * 600);
        });

        if (clientesSinTel.length > 0) {
          const nombres = clientesSinTel.map(c => `${c.nombre} ${c.apellido}`).join(', ');
          alert(`⚠️ Los siguientes clientes no tienen teléfono registrado:\n${nombres}`);
        }
      }

      setShowAssignModal(false);
      setAssignData({ grupoId: '', clienteId: '', fecha: new Date().toISOString().split('T')[0], includePdf: false });

      // Si era modo nuevo y ya guardamos, redirigir después de asignar
      if (isNewMode && savedWorkoutId) {
        router.push('/entrenador/workouts');
      }
    } catch (err) {
      console.error('Error assigning workout:', err);
      setError('Error al asignar el workout');
    } finally {
      setAssignLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600" />
      </div>
    );
  }

  if (error && !saving) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push('/entrenador/workouts')}
          className="flex items-center gap-2 text-ocean-600 hover:text-ocean-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      </div>
    );
  }

  const { sorted: filteredTareas, recommendedObjectives } = getFilteredAndSortedTareas();
  // Issue #6: preservar el ORDEN de formData.tareaIds al renderizar
  const selectedTareas = formData.tareaIds
    .map(id => tareas.find(t => t.id === id))
    .filter(Boolean) as Tarea[];

  // Workout de referencia para el modal de asignación
  const workoutForAssign = savedWorkoutData || workout;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/entrenador/workouts')}
            className="p-2 text-ocean-600 hover:text-ocean-800 hover:bg-ocean-50 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ocean-800">
              {isNewMode ? 'Nuevo Workout' : 'Editar Workout'}
            </h1>
            <p className="text-ocean-600">
              {isNewMode ? 'Crea un nuevo entrenamiento' : workout?.titulo}
            </p>
          </div>
        </div>
        {/* Issue #4: Botones solo icono */}
        <div className="flex gap-2">
          <button
            onClick={handlePreviewPdf}
            disabled={generatingPdf || formData.tareaIds.length === 0}
            title="Previsualizar PDF"
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
          </button>
          {/* Asignar: visible si es modo edición existente O si ya se guardó el nuevo */}
          {(!isNewMode || savedWorkoutId) && (
            <button
              onClick={() => {
                const w = savedWorkoutData || workout;
                setAssignData(prev => ({ ...prev, includePdf: !!w?.pdfUrl }));
                setShowAssignModal(true);
              }}
              title="Asignar workout"
              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {/* Banner: workout guardado, pendiente de asignar */}
      {isNewMode && savedWorkoutId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-green-700 text-sm font-medium">
            ✅ Workout guardado correctamente. Puedes asignarlo ahora o volver al listado.
          </p>
          <button
            onClick={() => router.push('/entrenador/workouts')}
            className="text-sm text-green-600 hover:text-green-800 underline ml-4 flex-shrink-0"
          >
            Ir al listado
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-ocean-700 mb-2">Título *</label>
          <input
            type="text"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            placeholder="Ej: Entrenamiento martes"
            className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
          />
        </div>

        {/* Tareas seleccionadas con reordenación */}
        <div>
          <label className="block text-sm font-medium text-ocean-700 mb-2">
            Tareas seleccionadas ({formData.tareaIds.length})
          </label>
          {selectedTareas.length > 0 ? (
            <div className="space-y-2 mb-4">
              {selectedTareas.map((tarea, idx) => (
                <div key={tarea.id} className="flex items-center gap-3 bg-ocean-50 rounded-lg p-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveTareaUp(idx)}
                      disabled={idx === 0}
                      className="p-1 text-ocean-400 hover:text-ocean-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveTareaDown(idx)}
                      disabled={idx === formData.tareaIds.length - 1}
                      className="p-1 text-ocean-400 hover:text-ocean-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="w-6 h-6 bg-ocean-600 text-white rounded-full text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</p>
                    <p className="text-xs text-ocean-500">
                      {tarea.metros}m • {Array.isArray(tarea.objetivo) ? tarea.objetivo.join(', ') : tarea.objetivo}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditTareaModal(tarea)}
                      className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded-lg"
                      title="Editar tarea"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleTarea(tarea.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Quitar del workout"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ocean-500 mb-4 bg-ocean-50 rounded-lg p-4 text-center">
              Selecciona tareas del banco para agregarlas al workout
            </p>
          )}
        </div>

        {/* Banco de tareas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-ocean-700">
              Banco de Tareas ({filteredTareas.length} disponibles)
            </label>
            <div className="flex items-center gap-2">
              {recommendedObjectives.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                  ✨ {recommendedObjectives.join(', ')}
                </span>
              )}
              {/* Issue #3: Botón nueva tarea */}
              <button
                onClick={openNewTareaModal}
                title="Crear nueva tarea en el banco"
                className="flex items-center gap-1 px-2 py-1 text-xs bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <Plus className="w-3 h-3" />
                Nueva tarea
              </button>
            </div>
          </div>

          {/* Filtros — Issue #2: input metros añadido */}
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Buscar tarea..."
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              className="flex-1 min-w-[140px] px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
            />
            <select
              value={taskFiltroObjetivo}
              onChange={(e) => setTaskFiltroObjetivo(e.target.value)}
              className="px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
            >
              <option value="">Objetivo</option>
              {objetivosOpciones.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={taskFiltroMaterial}
              onChange={(e) => setTaskFiltroMaterial(e.target.value)}
              className="px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
            >
              <option value="">Material</option>
              {materialOpciones.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              type="number"
              placeholder="Metros mín."
              value={taskFiltroMetros}
              onChange={(e) => setTaskFiltroMetros(e.target.value)}
              className="w-28 px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
              min="0"
            />
          </div>

          <div className="max-h-64 overflow-y-auto border border-ocean-200 rounded-lg">
            {filteredTareas.length === 0 ? (
              <p className="text-center text-ocean-500 py-8 text-sm">No hay tareas que coincidan</p>
            ) : (
              filteredTareas.map((tarea) => {
                const isSelected = formData.tareaIds.includes(tarea.id);
                const objs = Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean);
                const isRecommended = objs.some(o => recommendedObjectives.includes(o));
                return (
                  <div
                    key={tarea.id}
                    onClick={() => toggleTarea(tarea.id)}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-ocean-50 border-b border-ocean-100 last:border-b-0 transition-colors ${isSelected ? 'bg-ocean-50' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-ocean-500 bg-ocean-500' : 'border-ocean-300'}`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</p>
                        {isRecommended && !isSelected && (
                          <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded flex-shrink-0">✨</span>
                        )}
                      </div>
                      <p className="text-xs text-ocean-500">
                        {objs.join(', ')} • {tarea.metros}m • {tarea.material}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Info calculada */}
        {formData.tareaIds.length > 0 && (
          <div className="bg-ocean-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-ocean-500 text-xs mb-1">Metros totales</p>
              <p className="font-semibold text-ocean-800">{calculateMetros(formData.tareaIds)}m</p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs mb-1">Objetivo principal</p>
              <p className="font-semibold text-ocean-800">{calculateObjective(formData.tareaIds)}</p>
            </div>
            <div>
              <p className="text-ocean-500 text-xs mb-1">Material</p>
              <p className="font-semibold text-ocean-800 truncate">{calculateMaterial(formData.tareaIds)}</p>
            </div>
          </div>
        )}

        {/* Comentarios */}
        <div>
          <label className="block text-sm font-medium text-ocean-700 mb-2">
            Comentarios / Frase motivacional (opcional)
          </label>
          <textarea
            value={formData.comentarios}
            onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
            placeholder="Ej: ¡A tope! Hoy es día de romperla 💪"
            rows={2}
            className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
          />
        </div>

        {/* Botón guardar — oculto si ya se guardó en modo nuevo */}
        {!(isNewMode && savedWorkoutId) && (
          <button
            onClick={handleSave}
            disabled={saving || !formData.titulo.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Workout'}
          </button>
        )}
      </div>

      {/* Modal de asignación */}
      {showAssignModal && workoutForAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ocean-800">Asignar Workout</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-ocean-400 hover:text-ocean-600">
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
                {grupos.map(g => {
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
              <div className="flex-1 h-px bg-ocean-100" />
              <span>o</span>
              <div className="flex-1 h-px bg-ocean-100" />
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
                {clientes.map(c => (
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
                      ? <>📱 WhatsApp a <strong>{formatPhone(sel.telefono)}</strong></>
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

            {/* Adjuntar PDF */}
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
                    {workoutForAssign?.pdfUrl
                      ? 'Se adjuntará el enlace en el mensaje de WhatsApp'
                      : 'Guarda el workout primero para generar el PDF'}
                  </p>
                </div>
              </label>
              {assignData.includePdf && workoutForAssign?.pdfUrl && (
                <div className="mt-2 text-xs text-ocean-500 bg-white rounded px-2 py-1 border border-ocean-200 truncate">
                  🔗 {workoutForAssign.pdfUrl}
                </div>
              )}
            </div>

            <button
              onClick={handleAssign}
              disabled={assignLoading || (!assignData.grupoId && !assignData.clienteId) || !assignData.fecha}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {assignLoading ? 'Asignando...' : 'Asignar y enviar por WhatsApp'}
            </button>

            {assignData.grupoId && getClientesDelGrupo(assignData.grupoId).filter(c => c.telefono?.trim()).length > 1 && (
              <p className="text-xs text-center text-ocean-400">
                Se abrirá una ventana de WhatsApp por cada cliente con teléfono registrado.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal crear / editar tarea (Issue #3) */}
      {showTareaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ocean-800">
                {isCreatingNewTarea ? 'Nueva Tarea' : 'Editar Tarea'}
              </h2>
              <button onClick={() => setShowTareaModal(false)} className="text-ocean-400 hover:text-ocean-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isCreatingNewTarea && (
              <p className="text-xs text-ocean-500 bg-ocean-50 rounded-lg px-3 py-2">
                La tarea se guardará en el banco de tareas y se añadirá automáticamente al workout.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Nombre *</label>
              <textarea
                value={tareaFormData.nombre}
                onChange={(e) => setTareaFormData({ ...tareaFormData, nombre: e.target.value })}
                rows={2}
                placeholder="Descripción del ejercicio..."
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Objetivos</label>
              <div className="flex flex-wrap gap-2">
                {objetivosOpciones.map(o => (
                  <label key={o} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tareaFormData.objetivo.includes(o)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTareaFormData({ ...tareaFormData, objetivo: [...tareaFormData.objetivo, o] });
                        } else {
                          setTareaFormData({ ...tareaFormData, objetivo: tareaFormData.objetivo.filter(obj => obj !== o) });
                        }
                      }}
                      className="rounded border-ocean-300"
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-1">Metros</label>
                <input
                  type="number"
                  value={tareaFormData.metros}
                  onChange={(e) => setTareaFormData({ ...tareaFormData, metros: e.target.value })}
                  className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-1">Material</label>
                <select
                  value={tareaFormData.material}
                  onChange={(e) => setTareaFormData({ ...tareaFormData, material: e.target.value })}
                  className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="">Seleccionar...</option>
                  {materialOpciones.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Descripción</label>
              <textarea
                value={tareaFormData.descripcion}
                onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })}
                rows={3}
                placeholder="Notas adicionales..."
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>

            {/* Botones de acción según el contexto */}
            {editingTareaInWorkout ? (
              // Modo edición: dos opciones
              <div className="space-y-2">
                <p className="text-xs text-ocean-500 bg-amber-50 rounded-lg px-3 py-2">
                  Estás editando una tarea del banco. ¿Qué quieres hacer?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveTarea('create')}
                    disabled={!tareaFormData.nombre.trim()}
                    className="flex-1 py-2 border border-ocean-300 text-ocean-700 bg-white rounded-lg hover:bg-ocean-50 disabled:opacity-50 font-medium"
                  >
                    📄 Crear copia nueva
                  </button>
                  <button
                    onClick={() => handleSaveTarea('update')}
                    disabled={!tareaFormData.nombre.trim()}
                    className="flex-1 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 font-medium"
                  >
                    💾 Guardar cambios
                  </button>
                </div>
                <button
                  onClick={closeTareaModal}
                  className="w-full py-2 text-ocean-500 hover:text-ocean-700 text-sm"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              // Modo creación: un solo botón
              <div className="flex gap-2">
                <button
                  onClick={closeTareaModal}
                  className="flex-1 py-2 border border-ocean-200 text-ocean-600 rounded-lg hover:bg-ocean-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSaveTarea('create')}
                  disabled={!tareaFormData.nombre.trim()}
                  className="flex-1 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50"
                >
                  {isCreatingNewTarea ? 'Crear y añadir' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal previsualización PDF */}
      {showPdfPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-ocean-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-ocean-800">
                Previsualización — {formData.titulo}
              </h2>
              <div className="flex gap-2">
                <a
                  href={pdfPreviewUrl}
                  download={`${formData.titulo.replace(/\s+/g, '_') || 'workout'}_preview.pdf`}
                  className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 text-sm"
                >
                  <FileDown className="w-4 h-4" />
                  Descargar
                </a>
                <button
                  onClick={() => {
                    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                    setShowPdfPreview(false);
                    setPdfPreviewUrl(null);
                  }}
                  className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-50 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="Previsualización PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
