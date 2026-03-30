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
  serverTimestamp 
} from 'firebase/firestore';
import { Calendar, Plus, Search, Edit, Trash2, X, Send, FileText, Copy } from 'lucide-react';

interface Tarea {
  id: string;
  nombre: string;
  objetivo: string;
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
}

interface Asignacion {
  id: string;
  workoutId: string;
  grupoId: string;
  fechaAsignada: string;
  estado: string;
}

export default function EntrenadorWorkoutsPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  
  // Estado para edición
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    titulo: '',
    objetivo: '',
    material: '',
    tareaIds: [] as string[],
  });

  const [assignData, setAssignData] = useState({
    grupoId: '',
    fecha: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch tareas (compartidas entre todos los trainers)
        const tareasRef = collection(db, 'tareas');
        const tareasSnap = await getDocs(tareasRef);
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
        }));
        setGrupos(gruposData);

        // Fetch workouts (compartidos entre todos los trainers)
        const workoutsRef = collection(db, 'workouts');
        const workoutsSnap = await getDocs(workoutsRef);
        const workoutsData = workoutsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Workout[];
        setWorkouts(workoutsData);

        // Fetch asignaciones
        const asignacionesRef = collection(db, 'asignaciones');
        const asignacionesSnap = await getDocs(asignacionesRef);
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
    const objetivos = tareas
      .filter(t => tareaIds.includes(t.id) && t.objetivo)
      .map(t => t.objetivo);
    
    if (objetivos.length === 0) return 'General';
    
    const counts: Record<string, number> = {};
    objetivos.forEach(o => counts[o] = (counts[o] || 0) + 1);
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
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

  const closeModal = () => {
    setShowCreateModal(false);
    setShowSaveModal(false);
    setEditingWorkout(null);
    setFormData({ titulo: '', objetivo: '', material: '', tareaIds: [] });
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
      fecha: new Date().toISOString().split('T')[0],
    });
    setShowAssignModal(true);
  };

  const assignWorkout = async () => {
    if (!selectedWorkout || !assignData.grupoId || !assignData.fecha) return;

    try {
      // Create assignment
      const asignacionesRef = collection(db, 'asignaciones');
      const newAsignacion = await addDoc(asignacionesRef, {
        workoutId: selectedWorkout.id,
        grupoId: assignData.grupoId,
        fechaAsignada: assignData.fecha,
        estado: 'pendiente',
        createdAt: serverTimestamp(),
      });

      setAsignaciones([...asignaciones, {
        id: newAsignacion.id,
        workoutId: selectedWorkout.id,
        grupoId: assignData.grupoId,
        fechaAsignada: assignData.fecha,
        estado: 'pendiente',
      }]);

      // Generate WhatsApp link
      const grupo = grupos.find(g => g.id === assignData.grupoId);
      const whatsappMessage = encodeURIComponent(
        `¡Hola!Tienes un nuevo workout asignado: *${selectedWorkout.titulo}*\n\n` +
        `📅 Fecha: ${new Date(assignData.fecha).toLocaleDateString('es-ES')}\n` +
        `🎯 Objetivo: ${selectedWorkout.objetivo}\n` +
        `🏊 Metros: ${selectedWorkout.metros}m\n\n` +
        `Revisa los detalles en la app y programa tu entrenamiento.`
      );
      
      const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank');

      setShowAssignModal(false);
      setSelectedWorkout(null);
    } catch (error) {
      console.error('Error assigning workout:', error);
    }
  };

  const getAsignacionesCount = (workoutId: string) => {
    return asignaciones.filter(a => a.workoutId === workoutId).length;
  };

  const filteredWorkouts = workouts.filter(w => 
    w.titulo.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600"></div>
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
        <button
          onClick={() => {
            setFormData({ titulo: '', objetivo: '', material: '', tareaIds: [] });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo Workout
        </button>
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
          >
            <Plus className="w-4 h-4" />
            Crear Workout
          </button>
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
                    <div className="flex flex-wrap gap-3 text-sm text-ocean-600 mt-1">
                      <span>🎯 {workout.objetivo}</span>
                      <span>🏊 {workout.metros}m</span>
                      <span>📦 {workout.material}</span>
                      <span>📋 {workoutTareas.length} ejercicios</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingWorkout(workout);
                        setFormData({
                          titulo: workout.titulo,
                          objetivo: workout.objetivo,
                          material: workout.material,
                          tareaIds: workout.tareaIds,
                        });
                        setShowCreateModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-ocean-100 text-ocean-700 rounded-lg hover:bg-ocean-200 text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
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
                {workoutTareas.length > 0 && (
                  <div className="border-t border-ocean-100 pt-4">
                    <h4 className="text-sm font-medium text-ocean-700 mb-2">Ejercicios:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {workoutTareas.map((tarea, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-ocean-50 rounded-lg px-3 py-2">
                          <span className="w-6 h-6 flex items-center justify-center bg-ocean-200 text-ocean-700 rounded-full text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-ocean-800">{tarea.nombre}</span>
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

            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Seleccionar Tareas * ({formData.tareaIds.length} seleccionadas)
                </label>
                {tareas.length === 0 ? (
                  <div className="text-center py-8 bg-ocean-50 rounded-lg">
                    <p className="text-ocean-500">No hay tareas creadas</p>
                    <p className="text-sm text-ocean-400">Crea tareas primero en el Banco de Tareas</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {tareas.map((tarea) => (
                      <button
                        key={tarea.id}
                        type="button"
                        onClick={() => {
                          const newTareaIds = formData.tareaIds.includes(tarea.id)
                            ? formData.tareaIds.filter(id => id !== tarea.id)
                            : [...formData.tareaIds, tarea.id];
                          // Auto-calcular objetivo y material basado en las tareas seleccionadas
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
                            : 'border-ocean-200 hover:border-ocean-300'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-ocean-800">{tarea.nombre}</p>
                          <p className="text-xs text-ocean-500">{tarea.objetivo} • {tarea.metros}m</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          formData.tareaIds.includes(tarea.id)
                            ? 'border-ocean-500 bg-ocean-500'
                            : 'border-ocean-300'
                        }`}>
                          {formData.tareaIds.includes(tarea.id) && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                      </button>
                    ))}
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
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Asignar Workout</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Workout
                </label>
                <p className="text-ocean-800 font-medium">{selectedWorkout.titulo}</p>
                <p className="text-sm text-ocean-500">{selectedWorkout.metros}m • {selectedWorkout.objetivo}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Grupo *
                </label>
                <select
                  value={assignData.grupoId}
                  onChange={(e) => setAssignData({ ...assignData, grupoId: e.target.value })}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="">Seleccionar grupo</option>
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={assignData.fecha}
                  onChange={(e) => setAssignData({ ...assignData, fecha: e.target.value })}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>

              <button
                onClick={assignWorkout}
                disabled={!assignData.grupoId || !assignData.fecha}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Asignar y Enviar por WhatsApp
              </button>
            </div>
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
    </div>
  );
}
