'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Calendar, List, CheckCircle, Clock, ArrowRight, Loader2 } from 'lucide-react';

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
  tareas: Tarea[];
  estado: 'pendiente' | 'realizado' | 'reprogramado';
  fechaRealizado?: string;
  fechaReprogramado?: string;
}

export default function ClienteDashboard() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendario' | 'lista'>('lista');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchWorkouts = async () => {
      if (!user) return;

      try {
        // Get user's group
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const grupoId = userData?.grupoId;

        if (!grupoId) {
          setWorkouts([]);
          setLoading(false);
          return;
        }

        // Fetch assignments for this group
        const asignacionesRef = collection(db, 'asignaciones');
        const q = query(
          asignacionesRef,
          where('grupoId', '==', grupoId),
          orderBy('fechaAsignada', 'asc')
        );

        const asignacionesSnap = await getDocs(q);
        
        const workoutsData: Workout[] = [];

        for (const asignacion of asignacionesSnap.docs) {
          const asignacionData = asignacion.data();
          
          // Fetch workout details
          const workoutDoc = await getDoc(doc(db, 'workouts', asignacionData.workoutId));
          if (workoutDoc.exists()) {
            const workoutData = workoutDoc.data();
            
            // Fetch tareas
            const tareas: Tarea[] = [];
            for (const tareaId of workoutData.tareaIds || []) {
              const tareaDoc = await getDoc(doc(db, 'tareas', tareaId));
              if (tareaDoc.exists()) {
                tareas.push({ id: tareaDoc.id, ...tareaDoc.data() } as Tarea);
              }
            }

            workoutsData.push({
              id: workoutDoc.id,
              titulo: workoutData.titulo,
              fecha: workoutData.fecha,
              objetivo: workoutData.objetivo,
              material: workoutData.material,
              metros: workoutData.metros,
              tareas,
              estado: asignacionData.estado || 'pendiente',
              fechaRealizado: asignacionData.fechaRealizado,
              fechaReprogramado: asignacionData.fechaReprogramado,
            });
          }
        }

        setWorkouts(workoutsData);
      } catch (error) {
        console.error('Error fetching workouts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, [user]);

  const markAsRealizado = async (workout: Workout) => {
    try {
      // Find assignment
      const asignacionesRef = collection(db, 'asignaciones');
      const q = query(
        asignacionesRef,
        where('workoutId', '==', workout.id)
      );
      const snap = await getDocs(q);
      
      for (const docSnap of snap.docs) {
        await updateDoc(doc(db, 'asignaciones', docSnap.id), {
          estado: 'realizado',
          fechaRealizado: new Date().toISOString(),
        });
      }

      // Update local state
      setWorkouts(workouts.map(w => 
        w.id === workout.id 
          ? { ...w, estado: 'realizado', fechaRealizado: new Date().toISOString() }
          : w
      ));
    } catch (error) {
      console.error('Error marking as realizado:', error);
    }
  };

  const reprogramar = async (workout: Workout, newDate: string) => {
    try {
      const asignacionesRef = collection(db, 'asignaciones');
      const q = query(
        asignacionesRef,
        where('workoutId', '==', workout.id)
      );
      const snap = await getDocs(q);
      
      for (const docSnap of snap.docs) {
        await updateDoc(doc(db, 'asignaciones', docSnap.id), {
          estado: 'reprogramado',
          fechaReprogramado: newDate,
          notas: 'Reprogramado por el cliente',
        });
      }

      setWorkouts(workouts.map(w => 
        w.id === workout.id 
          ? { ...w, estado: 'reprogramado', fechaReprogramado: newDate }
          : w
      ));
    } catch (error) {
      console.error('Error reprogramando:', error);
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'realizado': return 'bg-green-100 text-green-700';
      case 'reprogramado': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-ocean-100 text-ocean-700';
    }
  };

  const getStatusLabel = (estado: string) => {
    switch (estado) {
      case 'realizado': return 'Realizado';
      case 'reprogramado': return 'Reprogramado';
      default: return 'Pendiente';
    }
  };

  const workoutsFiltrados = viewMode === 'calendario' 
    ? workouts.filter(w => w.fecha.split('T')[0] === selectedDate)
    : workouts;

  const objetivosMap: Record<string, string> = {
    oposicion: 'Oposiciones',
    triatlon: 'Triatlón',
    crossfit: 'CrossFit',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-ocean-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ocean-800">
            Hola, {user?.nombre || 'Cliente'}
          </h1>
          <p className="text-ocean-600">
            Objetivo: {objetivosMap[user?.objetivo || ''] || 'No definido'}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'lista'
                ? 'bg-ocean-100 text-ocean-700'
                : 'text-ocean-600 hover:bg-ocean-50'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendario')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'calendario'
                ? 'bg-ocean-100 text-ocean-700'
                : 'text-ocean-600 hover:bg-ocean-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendario
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendario' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ocean-700 mb-2">
              Seleccionar fecha:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
            />
          </div>

          {workoutsFiltrados.length === 0 ? (
            <div className="text-center py-8 text-ocean-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay workouts asignados para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workoutsFiltrados.map((workout) => (
                <WorkoutCard 
                  key={workout.id} 
                  workout={workout} 
                  onMarkRealizado={() => markAsRealizado(workout)}
                  onReprogramar={reprogramar}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'lista' && (
        <div className="space-y-4">
          {workouts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
              <h3 className="text-lg font-medium text-ocean-700 mb-2">
                No hay workouts asignados
              </h3>
              <p className="text-ocean-500">
                Contacta con tu entrenador para que te asigne workouts
              </p>
            </div>
          ) : (
            workouts.map((workout) => (
              <WorkoutCard 
                key={workout.id} 
                workout={workout} 
                onMarkRealizado={() => markAsRealizado(workout)}
                onReprogramar={reprogramar}
                getStatusColor={getStatusColor}
                getStatusLabel={getStatusLabel}
              />
            ))
          )}
        </div>
      )}

      {/* Stats */}
      {workouts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ocean-100 rounded-lg">
                <Clock className="w-5 h-5 text-ocean-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ocean-800">
                  {workouts.filter(w => w.estado === 'pendiente').length}
                </p>
                <p className="text-sm text-ocean-500">Pendientes</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ocean-800">
                  {workouts.filter(w => w.estado === 'realizado').length}
                </p>
                <p className="text-sm text-ocean-500">Realizados</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ArrowRight className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ocean-800">
                  {workouts.filter(w => w.estado === 'reprogramado').length}
                </p>
                <p className="text-sm text-ocean-500">Reprogramados</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Workout Card Component
function WorkoutCard({ 
  workout, 
  onMarkRealizado, 
  onReprogramar,
  getStatusColor,
  getStatusLabel
}: {
  workout: Workout;
  onMarkRealizado: () => void;
  onReprogramar: (w: Workout, d: string) => void;
  getStatusColor: (s: string) => string;
  getStatusLabel: (s: string) => string;
}) {
  const [showReprogramar, setShowReprogramar] = useState(false);
  const [newDate, setNewDate] = useState('');

  const handleReprogramar = () => {
    if (newDate) {
      onReprogramar(workout, newDate);
      setShowReprogramar(false);
      setNewDate('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-ocean-800">{workout.titulo}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(workout.estado)}`}>
              {getStatusLabel(workout.estado)}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-ocean-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(workout.fecha).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </span>
            <span>🎯 {workout.objetivo}</span>
            <span>🏊 {workout.metros}m</span>
            <span>📦 {workout.material}</span>
          </div>
        </div>
      </div>

      {/* Tareas */}
      <div className="border-t border-ocean-100 pt-4 mb-4">
        <h4 className="font-medium text-ocean-700 mb-3">Ejercicios:</h4>
        <div className="space-y-2">
          {workout.tareas.map((tarea, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm bg-ocean-50 rounded-lg p-3">
              <span className="w-6 h-6 flex items-center justify-center bg-ocean-200 text-ocean-700 rounded-full text-xs font-bold">
                {idx + 1}
              </span>
              <div className="flex-1">
                <span className="font-medium text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</span>
                <span className="text-ocean-500"> - {tarea.objetivo} - {tarea.metros}m</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {workout.estado === 'pendiente' && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onMarkRealizado}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" />
            Marcar como realizado
          </button>
          <button
            onClick={() => setShowReprogramar(!showReprogramar)}
            className="flex items-center gap-2 px-4 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-sm font-medium"
          >
            <Clock className="w-4 h-4" />
            Reprogramar
          </button>
        </div>
      )}

      {showReprogramar && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            Selecciona la nueva fecha:
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-3 py-2 border border-yellow-200 rounded-lg"
            />
            <button
              onClick={handleReprogramar}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium"
            >
              Confirmar
            </button>
            <button
              onClick={() => setShowReprogramar(false)}
              className="px-4 py-2 text-yellow-700 hover:bg-yellow-100 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
