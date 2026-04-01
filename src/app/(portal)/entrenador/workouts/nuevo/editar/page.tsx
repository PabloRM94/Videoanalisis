'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db, storage } from '@/config/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Save, Loader2, ChevronUp, ChevronDown, Send, X, Edit, FileText, Eye, FileDown } from 'lucide-react';
import { generateWorkoutPDF } from '@/lib/generateWorkoutPDF';

/**
 * /entrenador/workouts/nuevo/editar
 * Misma lógica que [id]/editar/page.tsx pero con workoutId="nuevo" fijo.
 * Separada porque Next.js prioriza rutas estáticas sobre dinámicas y
 * /nuevo nunca llegaría a [id].
 */

interface Tarea {
  id: string;
  nombre: string;
  objetivo: string[];
  material: string;
  metros: number;
  descripcion?: string;
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
}

const objetivosOpciones = [
  'CLNT', 'TEC', 'AEL', 'AEM', 'AEI', 'VEL', 'REST', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC', 'INI', 'FUER'
];

const materialOpciones = [
  'Tabla', 'Aletas', 'Pullboy', 'Churumbela', 'Bola', 'Cuerda', 'Pletinas', 'Nadador', 'Otro', 'Sin material'
];

export default function NuevoWorkoutEditarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showEditTareaModal, setShowEditTareaModal] = useState(false);
  const [editingTareaInWorkout, setEditingTareaInWorkout] = useState<Tarea | null>(null);
  const [tareaFormData, setTareaFormData] = useState({
    nombre: '',
    objetivo: [] as string[],
    material: '',
    metros: '',
    descripcion: '',
  });

  const [taskSearch, setTaskSearch] = useState('');
  const [taskFiltroObjetivo, setTaskFiltroObjetivo] = useState('');
  const [taskFiltroMaterial, setTaskFiltroMaterial] = useState('');

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    tareaIds: [] as string[],
    comentarios: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tareasSnap = await getDocs(collection(db, 'tareas'));
        setTareas(tareasSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tarea[]);

        const gruposSnap = await getDocs(collection(db, 'grupos'));
        setGrupos(gruposSnap.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre,
          clienteIds: d.data().clienteIds || [],
        })));

        const clientesSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'cliente')));
        setClientes(clientesSnap.docs.map(d => ({
          id: d.id,
          nombre: d.data().nombre || '',
          apellido: d.data().apellido || '',
        })));
      } catch (err) {
        console.error(err);
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateObjective = (tareaIds: string[]): string => {
    const sel = tareas.filter(t => tareaIds.includes(t.id));
    const all = sel.flatMap(t => Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo]).filter(Boolean);
    if (!all.length) return 'General';
    const counts: Record<string, number> = {};
    all.forEach(o => { counts[o] = (counts[o] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };

  const calculateMetros = (tareaIds: string[]): number =>
    tareas.filter(t => tareaIds.includes(t.id)).reduce((acc, t) => acc + t.metros, 0);

  const calculateMaterial = (tareaIds: string[]): string => {
    const mats = tareas.filter(t => tareaIds.includes(t.id) && t.material).map(t => t.material);
    return [...new Set(mats)].join(', ') || 'Sin material';
  };

  const getFilteredAndSortedTareas = () => {
    const grupo1 = ['CLNT', 'TEC', 'INI'];
    const grupo2 = ['VEL', 'FUER', 'ANA', 'PAL', 'PLAC', 'CAL', 'CLAC'];
    const grupo3 = ['AEL', 'AEM', 'AEI'];

    const currentMain = formData.tareaIds.length > 0 ? calculateObjective(formData.tareaIds) : null;
    let recommendedObjectives: string[] = [];
    if (!currentMain) recommendedObjectives = grupo1;
    else if (grupo1.includes(currentMain)) recommendedObjectives = grupo2;
    else if (grupo2.includes(currentMain)) recommendedObjectives = grupo3;
    else recommendedObjectives = grupo3;

    const filtered = tareas.filter(t => {
      const objs = Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo].filter(Boolean);
      const matchSearch = !taskSearch ||
        t.nombre.toLowerCase().includes(taskSearch.toLowerCase()) ||
        objs.some(o => o.toLowerCase().includes(taskSearch.toLowerCase()));
      const matchObj = !taskFiltroObjetivo || objs.includes(taskFiltroObjetivo);
      const matchMat = !taskFiltroMaterial || t.material === taskFiltroMaterial;
      return matchSearch && matchObj && matchMat;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aObjs = Array.isArray(a.objetivo) ? a.objetivo : [a.objetivo].filter(Boolean);
      const bObjs = Array.isArray(b.objetivo) ? b.objetivo : [b.objetivo].filter(Boolean);
      const aR = aObjs.some(o => recommendedObjectives.includes(o));
      const bR = bObjs.some(o => recommendedObjectives.includes(o));
      if (aR && !bR) return -1;
      if (!aR && bR) return 1;
      return 0;
    });

    return { sorted, recommendedObjectives };
  };

  const toggleTarea = (tareaId: string) => {
    const newIds = formData.tareaIds.includes(tareaId)
      ? formData.tareaIds.filter(id => id !== tareaId)
      : [...formData.tareaIds, tareaId];
    setFormData({ ...formData, tareaIds: newIds });
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
    setTareas(tareas.map(t =>
      t.id === editingTareaInWorkout.id
        ? { ...t, nombre: tareaFormData.nombre, objetivo: tareaFormData.objetivo, material: tareaFormData.material, metros: parseInt(tareaFormData.metros) || 0, descripcion: tareaFormData.descripcion }
        : t
    ));
    setShowEditTareaModal(false);
    setEditingTareaInWorkout(null);
  };

  const handlePreviewPdf = async () => {
    if (!formData.titulo.trim() || formData.tareaIds.length === 0) {
      alert('Agrega un título y al menos una tarea para previsualizar');
      return;
    }
    setGeneratingPdf(true);
    try {
      const selTareas = tareas.filter(t => formData.tareaIds.includes(t.id));
      const metros = calculateMetros(formData.tareaIds);
      const objetivo = calculateObjective(formData.tareaIds);
      const material = calculateMaterial(formData.tareaIds);

      // Revocar URL anterior si existe
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);

      const blobUrl = await generateWorkoutPDF(
        { titulo: formData.titulo, comentarios: formData.comentarios },
        selTareas,
        objetivo,
        material,
        metros,
      );
      setPdfPreviewUrl(blobUrl);
      setShowPdfPreview(true);
    } catch (err) {
      console.error(err);
      alert('Error al generar la previsualización');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) return;
    setSaving(true);
    try {
      const selTareas = tareas.filter(t => formData.tareaIds.includes(t.id));
      const metros = calculateMetros(formData.tareaIds);
      const objetivo = calculateObjective(formData.tareaIds);
      const material = calculateMaterial(formData.tareaIds);

      const blobUrl = await generateWorkoutPDF(
        { titulo: formData.titulo, comentarios: formData.comentarios },
        selTareas,
        objetivo,
        material,
        metros,
      );

      const newWorkout = await addDoc(collection(db, 'workouts'), {
        titulo: formData.titulo.trim(),
        objetivo,
        material,
        metros,
        tareaIds: formData.tareaIds,
        comentarios: formData.comentarios.trim(),
        fecha: new Date().toISOString(),
      });

      // Convertir blob URL → base64 para subir a Storage
      const blobResp = await fetch(blobUrl);
      const pdfBlob = await blobResp.blob();
      const arrayBuf = await pdfBlob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      let binary = '';
      uint8.forEach(b => { binary += String.fromCharCode(b); });
      const pdfBase64 = btoa(binary);

      const pdfRef = ref(storage, `workouts/${newWorkout.id}_workout.pdf`);
      await uploadString(pdfRef, pdfBase64, 'base64', { contentType: 'application/pdf' });
      const pdfUrl = await getDownloadURL(pdfRef);

      await updateDoc(doc(db, 'workouts', newWorkout.id), { pdfUrl });

      // Descargar localmente
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${formData.titulo.replace(/\s+/g, '_')}_workout.pdf`;
      link.click();

      URL.revokeObjectURL(blobUrl);
      router.push('/entrenador/workouts');
    } catch (err) {
      console.error(err);
      setError('Error al guardar el workout');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600" />
      </div>
    );
  }

  const { sorted: filteredTareas, recommendedObjectives } = getFilteredAndSortedTareas();
  const selectedTareas = formData.tareaIds.map(id => tareas.find(t => t.id === id)).filter(Boolean) as Tarea[];

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
            <h1 className="text-2xl font-bold text-ocean-800">Nuevo Workout</h1>
            <p className="text-ocean-600">Crea un nuevo entrenamiento</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePreviewPdf}
            disabled={generatingPdf || formData.tareaIds.length === 0 || !formData.titulo.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Previsualizar PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {/* Título */}
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

        {/* Tareas seleccionadas */}
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
            {recommendedObjectives.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                Recomendadas: {recommendedObjectives.join(', ')}
              </span>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Buscar tarea..."
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

          <div className="max-h-72 overflow-y-auto border border-ocean-200 rounded-lg">
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

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={saving || !formData.titulo.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar Workout'}
        </button>
      </div>

      {/* Modal editar tarea */}
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
