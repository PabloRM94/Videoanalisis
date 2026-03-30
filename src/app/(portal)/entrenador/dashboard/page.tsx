'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Users, Dumbbell, Calendar, TrendingUp, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';

interface Grupo {
  id: string;
  nombre: string;
  clienteCount: number;
}

interface Tarea {
  id: string;
  nombre: string;
}

interface Workout {
  id: string;
  titulo: string;
  fecha: string;
}

export default function EntrenadorDashboard() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [tareasCount, setTareasCount] = useState(0);
  const [workoutsCount, setWorkoutsCount] = useState(0);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch grupos
        const gruposRef = collection(db, 'grupos');
        const q = query(
          gruposRef,
          where('trainerId', '==', user.uid),
          orderBy('nombre', 'asc')
        );
        const gruposSnap = await getDocs(q);
        
        const gruposData: Grupo[] = [];
        for (const grupoDoc of gruposSnap.docs) {
          const grupoData = grupoDoc.data();
          
          // Count clients in this group
          const clientesRef = collection(db, 'users');
          const clientesQ = query(
            clientesRef,
            where('grupoId', '==', grupoDoc.id)
          );
          const clientesSnap = await getDocs(clientesQ);
          
          gruposData.push({
            id: grupoDoc.id,
            nombre: grupoData.nombre,
            clienteCount: clientesSnap.size,
          });
        }
        setGrupos(gruposData);

        // Fetch tareas count
        const tareasRef = collection(db, 'tareas');
        const tareasQ = query(
          tareasRef,
          where('trainerId', '==', user.uid)
        );
        const tareasSnap = await getDocs(tareasQ);
        setTareasCount(tareasSnap.size);

        // Fetch workouts count and recent
        const workoutsRef = collection(db, 'workouts');
        const workoutsQ = query(
          workoutsRef,
          where('trainerId', '==', user.uid),
          orderBy('fecha', 'desc')
        );
        const workoutsSnap = await getDocs(workoutsQ);
        setWorkoutsCount(workoutsSnap.size);

        const recent = workoutsSnap.docs.slice(0, 5).map(doc => ({
          id: doc.id,
          titulo: doc.data().titulo,
          fecha: doc.data().fecha,
        }));
        setRecentWorkouts(recent);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  const totalClientes = grupos.reduce((acc, g) => acc + g.clienteCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ocean-800">
          Panel de Entrenador
        </h1>
        <p className="text-ocean-600">Bienvenido, {user?.nombre}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/entrenador/clientes"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">{totalClientes}</p>
              <p className="text-sm text-ocean-500">Clientes</p>
            </div>
          </div>
        </Link>

        <Link
          href="/entrenador/tareas"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Dumbbell className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">{tareasCount}</p>
              <p className="text-sm text-ocean-500">Tareas</p>
            </div>
          </div>
        </Link>

        <Link
          href="/entrenador/workouts"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">{workoutsCount}</p>
              <p className="text-sm text-ocean-500">Workouts</p>
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gold-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-gold-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">{grupos.length}</p>
              <p className="text-sm text-ocean-500">Grupos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clientes y Grupos */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ocean-800">Gestión de Clientes</h2>
            <Link
              href="/entrenador/clientes"
              className="text-ocean-600 hover:text-ocean-800 text-sm flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {grupos.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
              <p className="text-ocean-500 mb-4">No tienes grupos creados</p>
              <Link
                href="/entrenador/clientes"
                className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <Plus className="w-4 h-4" />
                Crear Grupo
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {grupos.map((grupo) => (
                <div
                  key={grupo.id}
                  className="flex items-center justify-between p-3 bg-ocean-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-ocean-800">{grupo.nombre}</p>
                    <p className="text-sm text-ocean-500">{grupo.clienteCount} clientes</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-ocean-400" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workouts Recientes */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ocean-800">Workouts Recientes</h2>
            <Link
              href="/entrenador/workouts"
              className="text-ocean-600 hover:text-ocean-800 text-sm flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {recentWorkouts.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
              <p className="text-ocean-500 mb-4">No hay workouts creados</p>
              <Link
                href="/entrenador/workouts"
                className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <Plus className="w-4 h-4" />
                Crear Workout
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between p-3 bg-ocean-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-ocean-800">{workout.titulo}</p>
                    <p className="text-sm text-ocean-500">
                      {new Date(workout.fecha).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-ocean-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
