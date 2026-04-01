'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Users, UserPlus, Plus, Search, Edit, Trash2, X, Eye, Send, Loader2 } from 'lucide-react';

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  objetivo: string;
  grupoId: string | null;
}

interface Grupo {
  id: string;
  nombre: string;
  clienteIds?: string[];
}

const objetivosMap: Record<string, string> = {
  oposicion: 'Oposiciones',
  triatlon: 'Triatlón',
  crossfit: 'CrossFit',
};

export default function EntrenadorClientesPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateGrupo, setShowCreateGrupo] = useState(false);
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [newGrupoNombre, setNewGrupoNombre] = useState('');
  const [creatingCliente, setCreatingCliente] = useState(false);
  const [newClienteFormData, setNewClienteFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    objetivo: '',
  });
  const [selectedGrupo, setSelectedGrupo] = useState<string>('');
  
  // Estados para modales
  const [editingGrupo, setEditingGrupo] = useState<Grupo | null>(null);
  const [editingGrupoNombre, setEditingGrupoNombre] = useState('');
  const [deletingGrupo, setDeletingGrupo] = useState<Grupo | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [clienteFormData, setClienteFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    objetivo: '',
  });
  
  // Estado para asignar workout
  const [assigningWorkout, setAssigningWorkout] = useState<Cliente | null>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assigningLoading, setAssigningLoading] = useState(false);
  
  // Estado para mostrar historial
  const [verHistorial, setVerHistorial] = useState<Cliente | null>(null);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [historialData, setHistorialData] = useState<any[]>([]);
  
  // Ref para el dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch grupos (todos los grupos - compartidos entre trainers)
        const gruposRef = collection(db, 'grupos');
        const gruposSnap = await getDocs(gruposRef);
        
        const gruposData = gruposSnap.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre,
          clienteIds: doc.data().clienteIds || [],
        }));

        // Migrate: Si un grupo no tiene clienteIds, lo inicializamos
        for (const grupoDoc of gruposSnap.docs) {
          if (!grupoDoc.data().clienteIds) {
            await updateDoc(doc(db, 'grupos', grupoDoc.id), {
              clienteIds: [],
            });
            console.log(`Migrated grupo ${grupoDoc.id}: added clienteIds = []`);
          }
        }
        
        setGrupos(gruposData);

        // No seleccionar grupo por defecto - mostrar todos
        if (!selectedGrupo) {
          setSelectedGrupo('');
        }

        // Fetch clientes (TODOS los clientes - compartidos entre trainers)
        const clientesRef = collection(db, 'users');
        const clientesQ = query(
          clientesRef,
          where('role', '==', 'cliente')
        );
        const clientesSnap = await getDocs(clientesQ);
        
        const clientesData: Cliente[] = [];
        for (const docSnap of clientesSnap.docs) {
          const data = docSnap.data();
          // Mostrar TODOS los clientes, con o sin grupo
          clientesData.push({
            id: docSnap.id,
            nombre: data.nombre || '',
            email: data.email || '',
            telefono: data.telefono || '',
            objetivo: data.objetivo || '',
            grupoId: data.grupoId || null,
          });
        }
        setClientes(clientesData);

        // Fetch workouts para asignar
        const workoutsRef = collection(db, 'workouts');
        const workoutsSnap = await getDocs(workoutsRef);
        const workoutsData = workoutsSnap.docs.map(doc => ({
          id: doc.id,
          titulo: doc.data().titulo || '',
          fecha: doc.data().fecha || '',
        }));
        setWorkouts(workoutsData);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const createGrupo = async () => {
    if (!user || !newGrupoNombre.trim()) return;

    try {
      const gruposRef = collection(db, 'grupos');
      const newGrupo = await addDoc(gruposRef, {
        nombre: newGrupoNombre.trim(),
        clienteIds: [],
        createdAt: serverTimestamp(),
      });

      setGrupos([...grupos, { id: newGrupo.id, nombre: newGrupoNombre.trim(), clienteIds: [] }]);
      setSelectedGrupo(newGrupo.id);
      setNewGrupoNombre('');
      setShowCreateGrupo(false);
    } catch (error) {
      console.error('Error creating grupo:', error);
    }
  };

  // Crear cliente directamente (sin Firebase Auth — solo documento en Firestore)
  const createCliente = async () => {
    if (!newClienteFormData.nombre.trim()) return;
    setCreatingCliente(true);
    try {
      const newDoc = await addDoc(collection(db, 'users'), {
        nombre: newClienteFormData.nombre.trim(),
        apellido: newClienteFormData.apellido.trim(),
        email: newClienteFormData.email.trim(),
        telefono: newClienteFormData.telefono.trim(),
        objetivo: newClienteFormData.objetivo,
        role: 'cliente',
        grupoId: null,
        createdByTrainer: true,
        createdAt: serverTimestamp(),
      });

      const nuevoCliente: Cliente = {
        id: newDoc.id,
        nombre: newClienteFormData.nombre.trim(),
        email: newClienteFormData.email.trim(),
        telefono: newClienteFormData.telefono.trim(),
        objetivo: newClienteFormData.objetivo,
        grupoId: null,
      };
      setClientes(prev => [...prev, nuevoCliente]);
      setNewClienteFormData({ nombre: '', apellido: '', email: '', telefono: '', objetivo: '' });
      setShowCreateCliente(false);
    } catch (error) {
      console.error('Error creating cliente:', error);
    } finally {
      setCreatingCliente(false);
    }
  };

  const updateClienteGrupo = async (clienteId: string, grupoId: string) => {
    try {
      // Obtener el cliente actual para saber su grupo anterior
      const clienteActual = clientes.find(c => c.id === clienteId);
      const grupoAnteriorId = clienteActual?.grupoId;

      // 1. Actualizar el cliente
      await updateDoc(doc(db, 'users', clienteId), {
        grupoId,
      });

      // 2. Si tenía grupo anterior, quitarle el clienteId
      if (grupoAnteriorId && grupoAnteriorId !== grupoId) {
        const grupoAnterior = grupos.find(g => g.id === grupoAnteriorId);
        if (grupoAnterior && grupoAnterior.clienteIds) {
          const nuevosClienteIds = grupoAnterior.clienteIds.filter(id => id !== clienteId);
          await updateDoc(doc(db, 'grupos', grupoAnteriorId), {
            clienteIds: nuevosClienteIds,
          });
          // Actualizar estado local
          setGrupos(grupos.map(g => 
            g.id === grupoAnteriorId ? { ...g, clienteIds: nuevosClienteIds } : g
          ));
        }
      }

      // 3. Agregar clienteId al nuevo grupo
      if (grupoId) {
        const grupoNuevo = grupos.find(g => g.id === grupoId);
        const nuevosClienteIds = [...(grupoNuevo?.clienteIds || []), clienteId];
        await updateDoc(doc(db, 'grupos', grupoId), {
          clienteIds: nuevosClienteIds,
        });
        // Actualizar estado local
        setGrupos(grupos.map(g => 
          g.id === grupoId ? { ...g, clienteIds: nuevosClienteIds } : g
        ));
      }

      // 4. Actualizar estado local de clientes
      setClientes(clientes.map(c => 
        c.id === clienteId ? { ...c, grupoId } : c
      ));
    } catch (error) {
      console.error('Error updating cliente:', error);
    }
  };

  // Editar grupo
  const startEditGrupo = (grupo: Grupo) => {
    setEditingGrupo(grupo);
    setEditingGrupoNombre(grupo.nombre);
  };

  const saveEditGrupo = async () => {
    if (!editingGrupo || !editingGrupoNombre.trim()) return;
    
    try {
      await updateDoc(doc(db, 'grupos', editingGrupo.id), {
        nombre: editingGrupoNombre.trim(),
      });
      
      setGrupos(grupos.map(g => 
        g.id === editingGrupo.id ? { ...g, nombre: editingGrupoNombre.trim() } : g
      ));
      setEditingGrupo(null);
      setEditingGrupoNombre('');
    } catch (error) {
      console.error('Error updating grupo:', error);
    }
  };

  // Eliminar grupo
  const confirmDeleteGrupo = (grupo: Grupo) => {
    setDeletingGrupo(grupo);
  };

  const deleteGrupo = async () => {
    if (!deletingGrupo) return;
    
    try {
      // Primero, quitar este grupo de todos los clientes
      const clientesEnGrupo = clientes.filter(c => c.grupoId === deletingGrupo.id);
      for (const cliente of clientesEnGrupo) {
        await updateDoc(doc(db, 'users', cliente.id), {
          grupoId: null,
        });
      }
      
      setClientes(clientes.map(c => 
        c.grupoId === deletingGrupo.id ? { ...c, grupoId: null } : c
      ));
      
      // Luego eliminar el grupo
      await deleteDoc(doc(db, 'grupos', deletingGrupo.id));
      setGrupos(grupos.filter(g => g.id !== deletingGrupo.id));
      setDeletingGrupo(null);
      
      // Si el grupo eliminado era el seleccionado, resetear
      if (selectedGrupo === deletingGrupo.id) {
        setSelectedGrupo('');
      }
    } catch (error) {
      console.error('Error deleting grupo:', error);
    }
  };

  // Ver historial del cliente
  const verHistorialCliente = async (cliente: Cliente) => {
    setVerHistorial(cliente);
    setHistorialCargando(true);
    
    try {
      const asignacionesRef = collection(db, 'asignaciones');
      const q = query(asignacionesRef, where('clienteId', '==', cliente.id));
      const asignacionesSnap = await getDocs(q);
      
      const historial = asignacionesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setHistorialData(historial);
    } catch (error) {
      console.error('Error fetching historial:', error);
    } finally {
      setHistorialCargando(false);
    }
  };

  // Asignar workout a cliente
  const assignWorkoutToCliente = async () => {
    if (!assigningWorkout || !selectedWorkoutId || !assignDate) return;
    
    setAssigningLoading(true);
    try {
      await addDoc(collection(db, 'asignaciones'), {
        workoutId: selectedWorkoutId,
        clienteId: assigningWorkout.id,
        grupoId: null,
        fechaAsignada: assignDate,
        estado: 'pendiente',
        createdAt: serverTimestamp(),
      });
      
      alert(`Workout asignado a ${assigningWorkout.nombre}`);
      setAssigningWorkout(null);
      setSelectedWorkoutId('');
      setAssignDate('');
    } catch (error) {
      console.error('Error assigning workout:', error);
    } finally {
      setAssigningLoading(false);
    }
  };

  // Editar cliente
  const startEditCliente = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setClienteFormData({
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      objetivo: cliente.objetivo,
    });
  };

  const saveEditCliente = async () => {
    if (!editingCliente) return;
    
    try {
      await updateDoc(doc(db, 'users', editingCliente.id), clienteFormData);
      
      setClientes(clientes.map(c => 
        c.id === editingCliente.id ? { ...c, ...clienteFormData } : c
      ));
      setEditingCliente(null);
    } catch (error) {
      console.error('Error updating cliente:', error);
    }
  };

  // Eliminar cliente
  const confirmDeleteCliente = (cliente: Cliente) => {
    setDeletingCliente(cliente);
  };

  const deleteCliente = async () => {
    if (!deletingCliente) return;
    
    try {
      await updateDoc(doc(db, 'users', deletingCliente.id), {
        rol: 'eliminado',
        deletedAt: serverTimestamp(),
      });
      
      setClientes(clientes.filter(c => c.id !== deletingCliente.id));
      setDeletingCliente(null);
    } catch (error) {
      console.error('Error deleting cliente:', error);
    }
  };

  // Mostrar clientes según grupo seleccionado (incluye "Sin grupo")
  const clientesFiltrados = selectedGrupo === 'sin_grupo'
    ? clientes.filter(c => !c.grupoId)
    : selectedGrupo
      ? clientes.filter(c => c.grupoId === selectedGrupo)
      : clientes;

  const filteredBySearch = clientesFiltrados.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-2xl font-bold text-ocean-800">Clientes</h1>
          <p className="text-ocean-600">Gestiona tus clientes y grupos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateGrupo(true)}
            className="flex items-center gap-2 px-4 py-2 bg-ocean-100 text-ocean-700 rounded-lg hover:bg-ocean-200"
          >
            <Plus className="w-4 h-4" />
            Nuevo Grupo
          </button>
          <button
            onClick={() => setShowCreateCliente(true)}
            className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Grupo Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {/* Opción Todos */}
          <button
            onClick={() => setSelectedGrupo('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedGrupo === ''
                ? 'bg-ocean-600 text-white'
                : 'bg-ocean-50 text-ocean-600 hover:bg-ocean-100'
            }`}
          >
            Todos
          </button>
          {/* Opción Sin grupo */}
          <button
            onClick={() => setSelectedGrupo('sin_grupo')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedGrupo === 'sin_grupo'
                ? 'bg-ocean-600 text-white'
                : 'bg-ocean-50 text-ocean-600 hover:bg-ocean-100'
            }`}
          >
            Sin grupo
          </button>
          {grupos.map((grupo) => (
            <div key={grupo.id} className="flex items-center">
              <button
                onClick={() => setSelectedGrupo(grupo.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedGrupo === grupo.id
                    ? 'bg-ocean-600 text-white'
                    : 'bg-ocean-50 text-ocean-600 hover:bg-ocean-100'
                }`}
              >
                {grupo.nombre}
              </button>
              <button
                onClick={() => startEditGrupo(grupo)}
                className="p-1 text-ocean-400 hover:text-ocean-600"
                title="Editar grupo"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => confirmDeleteGrupo(grupo)}
                className="p-1 text-red-400 hover:text-red-600"
                title="Eliminar grupo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {grupos.length === 0 && (
            <p className="text-ocean-500 text-sm py-2">
              Crea un grupo para gestionar clientes
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ocean-400" />
        <input
          type="text"
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-ocean-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean-500"
        />
      </div>

      {/* Clientes List */}
      {filteredBySearch.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
          <h3 className="text-lg font-medium text-ocean-700 mb-2">
            No hay clientes en este grupo
          </h3>
          <p className="text-ocean-500 mb-4">
            Aún no hay clientes. Puedes crear uno manualmente o esperar a que se registren.
          </p>
          <button
            onClick={() => setShowCreateCliente(true)}
            className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 mx-auto"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ocean-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Cliente</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Teléfono</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Objetivo</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Grupo</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-ocean-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean-100">
                {filteredBySearch.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-ocean-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-ocean-100 rounded-full flex items-center justify-center">
                          <span className="text-ocean-600 font-medium">
                            {cliente.nombre.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-ocean-800">{cliente.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-ocean-600">{cliente.email}</td>
                    <td className="px-6 py-4 text-sm text-ocean-600">{cliente.telefono}</td>
                    <td className="px-6 py-4 text-sm text-ocean-600">
                      {objetivosMap[cliente.objetivo] || cliente.objetivo}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={cliente.grupoId || ''}
                        onChange={(e) => updateClienteGrupo(cliente.id, e.target.value)}
                        className="text-sm bg-ocean-50 border border-ocean-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      >
                        <option value="">Sin grupo</option>
                        {grupos.map((grupo) => (
                          <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => verHistorialCliente(cliente)}
                          className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded-lg"
                          title="Ver historial"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setAssigningWorkout(cliente)}
                          className="p-2 text-green-400 hover:text-green-600 hover:bg-green-100 rounded-lg"
                          title="Asignar workout"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => startEditCliente(cliente)}
                          className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => confirmDeleteCliente(cliente)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Grupo Modal */}
      {showCreateGrupo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Nuevo Grupo</h2>
              <button
                onClick={() => setShowCreateGrupo(false)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Nombre del grupo
                </label>
                <input
                  type="text"
                  value={newGrupoNombre}
                  onChange={(e) => setNewGrupoNombre(e.target.value)}
                  placeholder="Ej: Opositores 2024"
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <button
                onClick={createGrupo}
                className="w-full py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                Crear Grupo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Cliente Modal */}
      {showCreateCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Nuevo Cliente</h2>
              <button
                onClick={() => { setShowCreateCliente(false); setNewClienteFormData({ nombre: '', apellido: '', email: '', telefono: '', objetivo: '' }); }}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-ocean-500 bg-ocean-50 rounded-lg px-3 py-2 mb-4">
              El cliente se creará directamente sin cuenta de acceso. En el futuro podrás invitarle a activar su cuenta.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={newClienteFormData.nombre}
                    onChange={(e) => setNewClienteFormData({ ...newClienteFormData, nombre: e.target.value })}
                    placeholder="Pablo"
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Apellido</label>
                  <input
                    type="text"
                    value={newClienteFormData.apellido}
                    onChange={(e) => setNewClienteFormData({ ...newClienteFormData, apellido: e.target.value })}
                    placeholder="Rodríguez"
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={newClienteFormData.telefono}
                  onChange={(e) => setNewClienteFormData({ ...newClienteFormData, telefono: e.target.value })}
                  placeholder="+34 600 000 000"
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newClienteFormData.email}
                  onChange={(e) => setNewClienteFormData({ ...newClienteFormData, email: e.target.value })}
                  placeholder="pablo@email.com"
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Objetivo</label>
                <select
                  value={newClienteFormData.objetivo}
                  onChange={(e) => setNewClienteFormData({ ...newClienteFormData, objetivo: e.target.value })}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="oposicion">Oposiciones</option>
                  <option value="triatlon">Triatlón</option>
                  <option value="crossfit">CrossFit</option>
                </select>
              </div>
              <button
                onClick={createCliente}
                disabled={creatingCliente || !newClienteFormData.nombre.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingCliente ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {creatingCliente ? 'Creando...' : 'Crear Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Grupo Modal */}
      {editingGrupo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Editar Grupo</h2>
              <button
                onClick={() => setEditingGrupo(null)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Nombre del grupo
                </label>
                <input
                  type="text"
                  value={editingGrupoNombre}
                  onChange={(e) => setEditingGrupoNombre(e.target.value)}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <button
                onClick={saveEditGrupo}
                className="w-full py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Grupo Modal */}
      {deletingGrupo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Eliminar Grupo</h2>
              <button
                onClick={() => setDeletingGrupo(null)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-ocean-600 mb-4">
              ¿Estás seguro de eliminar el grupo <strong>"{deletingGrupo.nombre}"</strong>? 
              Los clientes de este grupo pasarán a "Sin grupo".
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingGrupo(null)}
                className="flex-1 py-3 bg-ocean-100 text-ocean-700 rounded-lg hover:bg-ocean-200"
              >
                Cancelar
              </button>
              <button
                onClick={deleteGrupo}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cliente Modal */}
      {editingCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Editar Cliente</h2>
              <button
                onClick={() => setEditingCliente(null)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={clienteFormData.nombre}
                  onChange={(e) => setClienteFormData({...clienteFormData, nombre: e.target.value})}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Email</label>
                <input
                  type="email"
                  value={clienteFormData.email}
                  onChange={(e) => setClienteFormData({...clienteFormData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Teléfono</label>
                <input
                  type="tel"
                  value={clienteFormData.telefono}
                  onChange={(e) => setClienteFormData({...clienteFormData, telefono: e.target.value})}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Objetivo</label>
                <select
                  value={clienteFormData.objetivo}
                  onChange={(e) => setClienteFormData({...clienteFormData, objetivo: e.target.value})}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="oposicion">Oposiciones</option>
                  <option value="triatlon">Triatlón</option>
                  <option value="crossfit">CrossFit</option>
                </select>
              </div>
              <button
                onClick={saveEditCliente}
                className="w-full py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Cliente Modal */}
      {deletingCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Eliminar Cliente</h2>
              <button
                onClick={() => setDeletingCliente(null)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-ocean-600 mb-4">
              ¿Estás seguro de eliminar al cliente <strong>"{deletingCliente.nombre}"</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingCliente(null)}
                className="flex-1 py-3 bg-ocean-100 text-ocean-700 rounded-lg hover:bg-ocean-200"
              >
                Cancelar
              </button>
              <button
                onClick={deleteCliente}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asignar Workout Modal */}
      {assigningWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">Asignar Workout</h2>
              <button
                onClick={() => setAssigningWorkout(null)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-ocean-600 mb-4">
              Selecciona un workout para <strong>{assigningWorkout.nombre}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Workout</label>
                <select
                  value={selectedWorkoutId}
                  onChange={(e) => setSelectedWorkoutId(e.target.value)}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                >
                  <option value="">Seleccionar...</option>
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>{w.titulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Fecha</label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
              <button
                onClick={assignWorkoutToCliente}
                disabled={assigningLoading || !selectedWorkoutId || !assignDate}
                className="w-full py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assigningLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ver Historial Modal */}
      {verHistorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">
                Historial de {verHistorial.nombre}
              </h2>
              <button
                onClick={() => setVerHistorial(null)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {historialCargando ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-ocean-600" />
              </div>
            ) : historialData.length === 0 ? (
              <p className="text-ocean-500 text-center py-8">
                Este cliente no tiene workouts asignados
              </p>
            ) : (
              <div className="space-y-3">
                {historialData.map((asignacion) => (
                  <div key={asignacion.id} className="bg-ocean-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-ocean-800">
                          Workout ID: {asignacion.workoutId}
                        </p>
                        <p className="text-sm text-ocean-600">
                          Fecha asignada: {asignacion.fechaAsignada}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        asignacion.estado === 'completado' 
                          ? 'bg-green-100 text-green-700'
                          : asignacion.estado === 'pendiente'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {asignacion.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
