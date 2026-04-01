'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, storage } from '@/config/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Save, Loader2, ChevronUp, ChevronDown, Send, X, Edit, FileText, GripVertical, Eye, ChevronDown as ChevronIcon, LayoutGrid, List, XCircle, Copy, FileDown } from 'lucide-react';
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
  'CLNT', 'TEC', 'AEL', 'AEM', 'AEI', 'VEL', 'REST', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC', 'INI', 'FUER'
];

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
  const [isNew] = useState(isNewMode);

  // Estados para modales
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditTareaModal, setShowEditTareaModal] = useState(false);
  const [editingTareaInWorkout, setEditingTareaInWorkout] = useState<Tarea | null>(null);
  const [tareaFormData, setTareaFormData] = useState({
    nombre: '',
    objetivo: [] as string[],
    material: '',
    metros: '',
    descripcion: '',
  });

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

  // Estados para secciones colapsables
  const [openSections, setOpenSections] = useState({
    info: true,
    selectedTareas: true,
    tareasBanco: true,
  });

  // Vista de tareas (grid/table)
  const [tareasViewMode, setTareasViewMode] = useState<'grid' | 'table'>('table');

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
        // Si es modo nuevo, no cargar workout existente
        if (isNewMode) {
          setWorkout(null);
          setFormData({
            titulo: '',
            objetivo: '',
            material: '',
            tareaIds: [],
            comentarios: '',
          });
        } else {
          // Fetch workout existente
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

        // Fetch todas las tareas disponibles
        const tareasRef = collection(db, 'tareas');
        const tareasSnap = await getDocs(tareasRef);
        const tareasData = tareasSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Tarea[];
        setTareas(tareasData);

        // Fetch grupos
        const gruposRef = collection(db, 'grupos');
        const gruposSnap = await getDocs(gruposRef);
        const gruposData = gruposSnap.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre,
          clienteIds: doc.data().clienteIds || [],
        })) as Grupo[];
        setGrupos(gruposData);

        // Fetch clientes (desde 'users' con role='cliente', compartidos entre trainers)
        const clientesRef = collection(db, 'users');
        const clientesQ = query(clientesRef, where('role', '==', 'cliente'));
        const clientesSnap = await getDocs(clientesQ);
        const clientesData = clientesSnap.docs.map(docSnap => ({
          id: docSnap.id,
          nombre: docSnap.data().nombre || '',
          apellido: docSnap.data().apellido || '',
          telefono: docSnap.data().telefono || '',
        })) as Cliente[];
        setClientes(clientesData);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching workout:', err);
        setError('Error al cargar el workout');
        setLoading(false);
      }
    };

    fetchData();
  }, [workoutId, isNewMode]);

  // Sistema de recomendaciones
  const getFilteredAndSortedTareas = () => {
    const grupo1 = ['CLNT', 'TEC', 'INI'];
    const grupo2 = ['VEL', 'FUER', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC'];
    const grupo3 = ['AEL', 'AEM', 'AEI'];

    const selectedTareas = tareas.filter(t => formData.tareaIds.includes(t.id));
    const currentMainObjective = selectedTareas.length > 0 
      ? calculateObjective(formData.tareaIds) 
      : null;

    let recommendedObjectives: string[] = [];
    
    if (currentMainObjective) {
      if (grupo1.includes(currentMainObjective)) {
        recommendedObjectives = [...grupo2];
      } else if (grupo2.includes(currentMainObjective)) {
        recommendedObjectives = [...grupo3];
      } else if (grupo3.includes(currentMainObjective)) {
        recommendedObjectives = [...grupo3];
      } else {
        recommendedObjectives = [...grupo1];
      }
    } else {
      recommendedObjectives = [...grupo1];
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

      return matchSearch && matchObjetivo && matchMaterial;
    });

    // Ordenar: recomendadas primero
    const sorted = [...filtered].sort((a, b) => {
      const aObj = Array.isArray(a.objetivo) ? a.objetivo : [a.objetivo].filter(Boolean);
      const bObj = Array.isArray(b.objetivo) ? b.objetivo : [b.objetivo].filter(Boolean);
      
      const aIsRecommended = aObj.some(o => recommendedObjectives.includes(o));
      const bIsRecommended = bObj.some(o => recommendedObjectives.includes(o));
      
      if (aIsRecommended && !bIsRecommended) return -1;
      if (!aIsRecommended && bIsRecommended) return 1;
      return 0;
    });

    return { sorted, recommendedObjectives };
  };

  // Funciones auxiliares
  const calculateObjective = (tareaIds: string[]): string => {
    const selectedTareas = tareas.filter(t => tareaIds.includes(t.id));
    const objetivosArrays = selectedTareas
      .filter(t => t.objetivo)
      .map(t => Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo]);
    
    if (objetivosArrays.length === 0) return 'General';
    
    const objetivos = objetivosArrays.flat();
    const counts: Record<string, number> = {};
    objetivos.forEach(o => counts[o] = (counts[o] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
  };

  const calculateMetros = (tareaIds: string[]): number => {
    return tareas.filter(t => tareaIds.includes(t.id)).reduce((acc, t) => acc + t.metros, 0);
  };

  // Material: únicos de las tareas, concatenados con coma
  const calculateMaterial = (tareaIds: string[]): string => {
    const materiales = tareas
      .filter(t => tareaIds.includes(t.id) && t.material)
      .map(t => t.material);
    return [...new Set(materiales)].join(', ') || 'Sin material';
  };

  // Toggle secciones
  const toggleSection = (section: 'info' | 'selectedTareas' | 'tareasBanco') => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Obtener tareas seleccionadas ordenadas
  const getSelectedTareas = () => {
    return formData.tareaIds.map(id => tareas.find(t => t.id === id)).filter(Boolean) as Tarea[];
  };

  // Remover tarea del workout
  const removeTareaFromWorkout = (tareaId: string) => {
    const newTareaIds = formData.tareaIds.filter(id => id !== tareaId);
    setFormData({ ...formData, tareaIds: newTareaIds });
  };

  // Previsualizar PDF
  const handlePreviewPdf = async () => {
    if (formData.tareaIds.length === 0 || !formData.titulo.trim()) {
      alert('Agrega un título y tareas para previsualizar el PDF');
      return;
    }

    setGeneratingPdf(true);
    try {
      const selectedTareas = tareas.filter(t => formData.tareaIds.includes(t.id));
      const totalMetros = calculateMetros(formData.tareaIds);
      const objetivoCalculado = calculateObjective(formData.tareaIds);
      const materialCalculado = calculateMaterial(formData.tareaIds);

      // Revocar URL anterior si existe
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);

      const blobUrl = await generateWorkoutPDF(
        { titulo: formData.titulo, comentarios: formData.comentarios },
        selectedTareas,
        objetivoCalculado,
        materialCalculado,
        totalMetros,
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

  // Reordenación
  const moveTareaUp = (index: number) => {
    if (index === 0) return;
    const newTareaIds = [...formData.tareaIds];
    [newTareaIds[index - 1], newTareaIds[index]] = [newTareaIds[index], newTareaIds[index - 1]];
    setFormData({ ...formData, tareaIds: newTareaIds });
  };

  const moveTareaDown = (index: number) => {
    if (index === formData.tareaIds.length - 1) return;
    const newTareaIds = [...formData.tareaIds];
    [newTareaIds[index], newTareaIds[index + 1]] = [newTareaIds[index + 1], newTareaIds[index]];
    setFormData({ ...formData, tareaIds: newTareaIds });
  };

  const toggleTarea = (tareaId: string) => {
    const newTareaIds = formData.tareaIds.includes(tareaId)
      ? formData.tareaIds.filter(id => id !== tareaId)
      : [...formData.tareaIds, tareaId];
    setFormData({ ...formData, tareaIds: newTareaIds });
  };

  // Editar tarea dentro del workout
  const openEditTareaModal = (tarea: Tarea) => {
    setEditingTareaInWorkout(tarea);
    setTareaFormData({
      nombre: tarea.nombre,
      objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo],
      material: tarea.material,
      metros: tarea.metros.toString(),
      descripcion: tarea.descripcion || '',
    });
    setShowEditTareaModal(true);
  };

  const handleSaveTareaInWorkout = () => {
    if (!editingTareaInWorkout) return;
    
    // Actualizar la tarea en la lista local
    const updatedTareas = tareas.map(t => 
      t.id === editingTareaInWorkout.id 
        ? { 
            ...t, 
            nombre: tareaFormData.nombre,
            objetivo: tareaFormData.objetivo,
            material: tareaFormData.material,
            metros: parseInt(tareaFormData.metros) || 0,
            descripcion: tareaFormData.descripcion
          }
        : t
    );
    setTareas(updatedTareas);
    setShowEditTareaModal(false);
    setEditingTareaInWorkout(null);
  };

  // Guardar workout + generar PDF
  const handleSave = async () => {
    if (!formData.titulo.trim()) return;

    setSaving(true);
    try {
      const selectedTareas = tareas.filter(t => formData.tareaIds.includes(t.id));
      const totalMetros = selectedTareas.reduce((acc, t) => acc + t.metros, 0);
      const objetivoCalculado = calculateObjective(formData.tareaIds);
      const materialCalculado = calculateMaterial(formData.tareaIds);

      // Generar PDF como blob URL
      const blobUrl = await generateWorkoutPDF(
        { titulo: formData.titulo, comentarios: formData.comentarios },
        selectedTareas,
        objetivoCalculado,
        materialCalculado,
        totalMetros,
      );

      let workoutIdSaved: string;

      if (isNewMode) {
        const workoutsRef = collection(db, 'workouts');
        const newWorkout = await addDoc(workoutsRef, {
          titulo: formData.titulo.trim(),
          objetivo: objetivoCalculado,
          material: materialCalculado,
          metros: totalMetros,
          tareaIds: formData.tareaIds,
          comentarios: formData.comentarios.trim(),
          fecha: new Date().toISOString(),
        });
        workoutIdSaved = newWorkout.id;
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
      }

      // Subir PDF a Firebase Storage: convertir blob URL → blob → ArrayBuffer → base64
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
      router.push('/entrenador/workouts');
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Error al guardar el workout');
    } finally {
      setSaving(false);
    }
  };

  // Construye el mensaje de WhatsApp para un cliente
  const buildWhatsAppMessage = (nombreCliente: string, pdfUrl?: string): string => {
    if (!workout) return '';
    const fechaFormateada = new Date(assignData.fecha).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    let msg =
      `¡Hola ${nombreCliente}! 🏊 Tienes un nuevo entrenamiento asignado:\n\n` +
      `*${workout.titulo}*\n\n` +
      `📅 Fecha: ${fechaFormateada}\n` +
      `🎯 Objetivo: ${workout.objetivo}\n` +
      `📏 Metros: ${workout.metros}m\n` +
      `🎒 Material: ${workout.material}`;

    if (assignData.includePdf && pdfUrl) {
      msg += `\n\n📄 *Descarga tu entrenamiento en PDF:*\n${pdfUrl}`;
    }

    msg += `\n\n_VideoAnalisis Natación — Pablo Rodríguez Madurga_`;
    return msg;
  };

  // Limpia el número de teléfono: quita espacios, guiones y añade +34 si es español sin prefijo
  const formatPhone = (tel: string): string => {
    const clean = tel.replace(/[\s\-().]/g, '');
    if (!clean) return '';
    if (clean.startsWith('+')) return clean;
    if (clean.startsWith('00')) return '+' + clean.slice(2);
    // Número español de 9 dígitos sin prefijo
    if (/^[6789]\d{8}$/.test(clean)) return '+34' + clean;
    return clean;
  };

  // Asignar workout
  const handleAssign = async () => {
    if (!workout || (!assignData.grupoId && !assignData.clienteId) || !assignData.fecha) return;

    setAssignLoading(true);
    try {
      const asignacionesRef = collection(db, 'asignaciones');
      const pdfUrl = (workout as any).pdfUrl as string | undefined;

      // ── Cliente individual ───────────────────────────────────────────────────
      if (assignData.clienteId) {
        await addDoc(asignacionesRef, {
          workoutId: workout.id,
          clienteId: assignData.clienteId,
          grupoId: null,
          fechaAsignada: assignData.fecha,
          estado: 'pendiente',
        });

        const cliente = clientes.find(c => c.id === assignData.clienteId);
        const nombreCompleto = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Nadador/a';
        const msg = buildWhatsAppMessage(nombreCompleto, pdfUrl);
        const tel = formatPhone(cliente?.telefono || '');

        // Si tiene teléfono, abrir chat directo; si no, abrir composición sin destinatario
        const waUrl = tel
          ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;

        window.open(waUrl, '_blank');
      }

      // ── Grupo completo ───────────────────────────────────────────────────────
      else if (assignData.grupoId) {
        const grupo = grupos.find(g => g.id === assignData.grupoId);
        const clientesDelGrupo = getClientesDelGrupo(assignData.grupoId);

        // Guardar asignación para cada cliente del grupo
        for (const cliente of clientesDelGrupo) {
          await addDoc(asignacionesRef, {
            workoutId: workout.id,
            clienteId: cliente.id,
            grupoId: assignData.grupoId,
            fechaAsignada: assignData.fecha,
            estado: 'pendiente',
          });
        }

        // Abrir WhatsApp para cada cliente que tenga teléfono
        const clientesConTel = clientesDelGrupo.filter(c => c.telefono?.trim());
        const clientesSinTel  = clientesDelGrupo.filter(c => !c.telefono?.trim());

        if (clientesConTel.length === 0) {
          // Ninguno tiene teléfono — mensaje genérico sin destinatario
          const msg = buildWhatsAppMessage(grupo?.nombre || 'grupo', pdfUrl);
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
          // Abrir una pestaña por cada cliente con teléfono
          clientesConTel.forEach((cliente, idx) => {
            const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
            const msg = buildWhatsAppMessage(nombreCompleto, pdfUrl);
            const tel = formatPhone(cliente.telefono!);
            // setTimeout escalonado para que el bloqueador de popups no lo mate
            setTimeout(() => {
              window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
            }, idx * 600);
          });

          if (clientesSinTel.length > 0) {
            const nombres = clientesSinTel.map(c => `${c.nombre} ${c.apellido}`).join(', ');
            alert(`⚠️ Los siguientes clientes no tienen teléfono registrado y no recibirán WhatsApp:\n${nombres}`);
          }
        }
      }

      setShowAssignModal(false);
      setAssignData({ grupoId: '', clienteId: '', fecha: new Date().toISOString().split('T')[0], includePdf: false });
    } catch (err) {
      console.error('Error assigning workout:', err);
      setError('Error al asignar el workout');
    } finally {
      setAssignLoading(false);
    }
  };

  const getClientesDelGrupo = (grupoId: string) => {
    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo || !grupo.clienteIds) return [];
    return clientes.filter(c => grupo.clienteIds.includes(c.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push('/entrenador/workouts')}
          className="flex items-center gap-2 text-ocean-600 hover:text-ocean-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al listado
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const { sorted: filteredTareas, recommendedObjectives } = getFilteredAndSortedTareas();
  const selectedTareas = tareas.filter(t => formData.tareaIds.includes(t.id));

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
            <h1 className="text-2xl font-bold text-ocean-800">{isNewMode ? 'Nuevo Workout' : 'Editar Workout'}</h1>
            <p className="text-ocean-600">{isNewMode ? 'Crea un nuevo entrenamiento' : workout?.titulo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Botón previsualizar PDF */}
          <button
            onClick={handlePreviewPdf}
            disabled={generatingPdf || formData.tareaIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {generatingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Previsualizar PDF
          </button>
          {!isNewMode && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Send className="w-4 h-4" />
              Asignar
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
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

        {/* Tareas seleccionadas con reordenación */}
        <div>
          <label className="block text-sm font-medium text-ocean-700 mb-2">
            Tareas seleccionadas ({formData.tareaIds.length})
          </label>
          {formData.tareaIds.length > 0 ? (
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
                  <span className="w-6 h-6 bg-ocean-600 text-white rounded-full text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</p>
                    <p className="text-xs text-ocean-500">{tarea.metros}m • {Array.isArray(tarea.objetivo) ? tarea.objetivo.join(', ') : tarea.objetivo}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditTareaModal(tarea)}
                      className="p-2 text-ocean-400 hover:text-ocean-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleTarea(tarea.id)}
                      className="p-2 text-red-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ocean-500 mb-4">No hay tareas seleccionadas</p>
          )}
        </div>

        {/* Banco de tareas con recomendaciones */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-ocean-700">
              Agregar Tareas ({tareas.length} disponibles)
            </label>
            {recommendedObjectives.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                Recomendadas: {recommendedObjectives.join(', ')}
              </span>
            )}
          </div>
          
          {/* Filtros */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Buscar tarea..."
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-ocean-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
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
          </div>

          <div className="max-h-64 overflow-y-auto border border-ocean-200 rounded-lg">
            {filteredTareas.map((tarea) => (
              <div
                key={tarea.id}
                onClick={() => toggleTarea(tarea.id)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-ocean-50 border-b border-ocean-100 last:border-b-0 ${
                  formData.tareaIds.includes(tarea.id) ? 'bg-ocean-50' : ''
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  formData.tareaIds.includes(tarea.id)
                    ? 'border-ocean-500 bg-ocean-500'
                    : 'border-ocean-300'
                }`}>
                  {formData.tareaIds.includes(tarea.id) && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</p>
                  <p className="text-xs text-ocean-500">
                    {Array.isArray(tarea.objetivo) ? tarea.objetivo.join(', ') : tarea.objetivo} • {tarea.metros}m
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info automática */}
        <div className="bg-ocean-50 rounded-lg p-4 text-sm text-ocean-600">
          <p><strong>Metros totales:</strong> {calculateMetros(formData.tareaIds)}m</p>
          <p><strong>Objetivo:</strong> {calculateObjective(formData.tareaIds)}</p>
        </div>

        {/* Comentarios / Frase motivacional */}
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

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={saving || !formData.titulo.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar Workout
        </button>
      </div>

      {/* Modal de asignación */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
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
              {/* Preview clientes del grupo */}
              {assignData.grupoId && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {getClientesDelGrupo(assignData.grupoId).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs bg-ocean-50 rounded px-2 py-1">
                      <span className="text-ocean-700 font-medium">{c.nombre} {c.apellido}</span>
                      {c.telefono?.trim() ? (
                        <span className="text-green-600 flex items-center gap-1">
                          📱 {c.telefono}
                        </span>
                      ) : (
                        <span className="text-red-400">Sin teléfono</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divisor */}
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
              {/* Preview teléfono del cliente seleccionado */}
              {assignData.clienteId && (() => {
                const sel = clientes.find(c => c.id === assignData.clienteId);
                return sel ? (
                  <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${sel.telefono?.trim() ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {sel.telefono?.trim() ? (
                      <>📱 WhatsApp enviado a <strong>{formatPhone(sel.telefono)}</strong></>
                    ) : (
                      <>⚠️ Este cliente no tiene teléfono — se abrirá WhatsApp Web sin destinatario</>
                    )}
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
                    {(workout as any)?.pdfUrl
                      ? 'Se adjuntará el enlace de descarga en el mensaje de WhatsApp'
                      : 'El workout no tiene PDF generado aún — guárdalo primero'}
                  </p>
                </div>
              </label>
              {assignData.includePdf && (workout as any)?.pdfUrl && (
                <div className="mt-2 text-xs text-ocean-500 bg-white rounded px-2 py-1 border border-ocean-200 truncate">
                  🔗 {(workout as any).pdfUrl}
                </div>
              )}
            </div>

            {/* Botón asignar */}
            <button
              onClick={handleAssign}
              disabled={assignLoading || (!assignData.grupoId && !assignData.clienteId) || !assignData.fecha}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {assignLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {assignLoading ? 'Asignando...' : 'Asignar y enviar por WhatsApp'}
            </button>

            {/* Info sobre apertura de pestañas */}
            {assignData.grupoId && getClientesDelGrupo(assignData.grupoId).filter(c => c.telefono?.trim()).length > 1 && (
              <p className="text-xs text-center text-ocean-400">
                Se abrirá una ventana de WhatsApp por cada cliente con teléfono registrado.
                Asegúrate de que tu navegador permite ventanas emergentes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal de edición de tarea */}
      {showEditTareaModal && editingTareaInWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ocean-800">Editar Tarea</h2>
              <button onClick={() => setShowEditTareaModal(false)} className="text-ocean-400 hover:text-ocean-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Nombre</label>
              <textarea
                value={tareaFormData.nombre}
                onChange={(e) => setTareaFormData({ ...tareaFormData, nombre: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Objetivos</label>
              <div className="flex flex-wrap gap-2">
                {objetivosOpciones.map(o => (
                  <label key={o} className="flex items-center gap-1 text-sm">
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

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Metros</label>
              <input
                type="number"
                value={tareaFormData.metros}
                onChange={(e) => setTareaFormData({ ...tareaFormData, metros: e.target.value })}
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
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

            <div>
              <label className="block text-sm font-medium text-ocean-700 mb-1">Descripción</label>
              <textarea
                value={tareaFormData.descripcion}
                onChange={(e) => setTareaFormData({ ...tareaFormData, descripcion: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowEditTareaModal(false)}
                className="flex-1 py-2 border border-ocean-200 text-ocean-600 rounded-lg hover:bg-ocean-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTareaInWorkout}
                className="flex-1 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                Guardar Tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal previsualización PDF */}
      {showPdfPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl flex flex-col" style={{height: '90vh'}}>
            <div className="flex items-center justify-between p-4 border-b border-ocean-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-ocean-800">
                Previsualización del PDF — {formData.titulo}
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
