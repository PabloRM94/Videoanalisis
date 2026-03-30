'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { CheckCircle, Calendar, TrendingUp } from 'lucide-react';

interface Tarea {
  id: string;
  nombre: string;
  objetivo: string;
  material: string;
  metros: number;
}

interface Workout {
  id: string;
  titulo: string;
  fecha: string;
  objetivo: string;
  metros: number;
  tareas: Tarea[];
  fechaRealizado?: string;
}

export default function ClienteHistorialPage() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalMetros: 0, thisMonth: 0 });

  useEffect(() => {
    const fetchHistorial = async () => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const grupoId = userData?.grupoId;

        if (!grupoId) {
          setWorkouts([]);
          setLoading(false);
          return;
        }

        const asignacionesRef = collection(db, 'asignaciones');
        const q = query(
          asignacionesRef,
          where('grupoId', '==', grupoId),
          where('estado', '==', 'realizado'),
          orderBy('fechaRealizado', 'desc')
        );

        const asignacionesSnap = await getDocs(q);
        
        const workoutsData: Workout[] = [];
        let totalMetros = 0;

        for (const asignacion of asignacionesSnap.docs) {
          const asignacionData = asignacion.data();
          const workoutDoc = await getDoc(doc(db, 'workouts', asignacionData.workoutId));
          
          if (workoutDoc.exists()) {
            const workoutData = workoutDoc.data();
            totalMetros += workoutData.metros || 0;

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
              metros: workoutData.metros,
              tareas,
              fechaRealizado: asignacionData.fechaRealizado,
            });
          }
        }

        setWorkouts(workoutsData);
        
        // Calculate stats
        const now = new Date();
        const thisMonth = workoutsData.filter(w => {
          if (!w.fechaRealizado) return false;
          const date = new Date(w.fechaRealizado);
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;

        setStats({
          total: workoutsData.length,
          totalMetros,
          thisMonth,
        });
      } catch (error) {
        console.error('Error fetching historial:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ocean-800">Historial de Entrenamientos</h1>
        <p className="text-ocean-600">Resumen de tu progreso</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-ocean-800">{stats.total}</p>
              <p className="text-sm text-ocean-500">Workouts completados</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ocean-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-ocean-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-ocean-800">{(stats.totalMetros / 1000).toFixed(1)}km</p>
              <p className="text-sm text-ocean-500">Metros Totales</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gold-100 rounded-xl">
              <Calendar className="w-6 h-6 text-gold-600" />
            </div>
            <div>
              <p className="text-3xl font-bold text-ocean-800">{stats.thisMonth}</p>
              <p className="text-sm text-ocean-500">Este mes</p>
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      {workouts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
          <h3 className="text-lg font-medium text-ocean-700 mb-2">
            Sin historial aún
          </h3>
          <p className="text-ocean-500">
            Completa tu primer workout para ver el historial aquí
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ocean-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Fecha</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Workout</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Objetivo</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Metros</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Completado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean-100">
                {workouts.map((workout) => (
                  <tr key={workout.id} className="hover:bg-ocean-50">
                    <td className="px-6 py-4 text-sm text-ocean-600">
                      {new Date(workout.fecha).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-ocean-800">
                      {workout.titulo}
                    </td>
                    <td className="px-6 py-4 text-sm text-ocean-600">
                      {workout.objetivo}
                    </td>
                    <td className="px-6 py-4 text-sm text-ocean-600">
                      {workout.metros}m
                    </td>
                    <td className="px-6 py-4 text-sm text-ocean-600">
                      {workout.fechaRealizado 
                        ? new Date(workout.fechaRealizado).toLocaleDateString('es-ES')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
