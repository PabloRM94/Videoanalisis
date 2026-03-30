'use client';

import { useState, useEffect } from 'react';
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
  serverTimestamp 
} from 'firebase/firestore';
import { Users, Plus, Search, MoreVertical, Edit, Trash2, X } from 'lucide-react';

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
  const [selectedGrupo, setSelectedGrupo] = useState<string>('');

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
        }));
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
        // Grupos compartidos entre todos los trainers
        createdAt: serverTimestamp(),
      });

      setGrupos([...grupos, { id: newGrupo.id, nombre: newGrupoNombre.trim() }]);
      setSelectedGrupo(newGrupo.id);
      setNewGrupoNombre('');
      setShowCreateGrupo(false);
    } catch (error) {
      console.error('Error creating grupo:', error);
    }
  };

  const updateClienteGrupo = async (clienteId: string, grupoId: string) => {
    try {
      await updateDoc(doc(db, 'users', clienteId), {
        grupoId,
      });

      setClientes(clientes.map(c => 
        c.id === clienteId ? { ...c, grupoId } : c
      ));
    } catch (error) {
      console.error('Error updating cliente:', error);
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
            <button
              key={grupo.id}
              onClick={() => setSelectedGrupo(grupo.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedGrupo === grupo.id
                  ? 'bg-ocean-600 text-white'
                  : 'bg-ocean-50 text-ocean-600 hover:bg-ocean-100'
              }`}
            >
              {grupo.nombre}
            </button>
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
          <p className="text-ocean-500">
            Los clientes se asignarán a este grupo cuando se registren
          </p>
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
                      <button className="p-2 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-100 rounded-lg">
                        <MoreVertical className="w-5 h-5" />
                      </button>
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
    </div>
  );
}
