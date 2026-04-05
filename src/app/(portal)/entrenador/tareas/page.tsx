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
  serverTimestamp 
} from 'firebase/firestore';
import { Dumbbell, Plus, Search, Edit, Trash2, X, Save, LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';

interface Tarea {
  id: string;
  nombre: string;
  objetivo: string[];
  material: string;
  metros: number;
  descripcion?: string;
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
  'CROSS',
  'FUER',
];

const MATERIAL_ALIASES: Record<string, string> = {
  'pull': 'Pullboy', 'Pull': 'Pullboy', 'pullboy': 'Pullboy', 'pull boy': 'Pullboy', 'Pull boy': 'Pullboy',
};
const normalizeMaterial = (m: string): string => MATERIAL_ALIASES[m.trim()] ?? m;

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

export default function EntrenadorTareasPage() {
  const { user } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroObjetivo, setFiltroObjetivo] = useState('');
  const [filtroMaterial, setFiltroMaterial] = useState('');
  const [filtroMetros, setFiltroMetros] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTarea, setEditingTarea] = useState<Tarea | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [formData, setFormData] = useState({
    nombre: '',
    objetivo: [] as string[],
    material: '',
    metros: '',
    descripcion: '',
  });

  useEffect(() => {
    const fetchTareas = async () => {
      if (!user) return;

      try {
        // Fetch todas las tareas (compartidas entre trainers)
        const tareasRef = collection(db, 'tareas');
        const snap = await getDocs(tareasRef);
        
        const tareasData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Tarea[];
        
        setTareas(tareasData);
      } catch (error) {
        console.error('Error fetching tareas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTareas();
  }, [user]);

  const openCreate = () => {
    setEditingTarea(null);
    setFormData({
      nombre: '',
      objetivo: [],
      material: '',
      metros: '',
      descripcion: '',
    });
    setShowModal(true);
  };

  const openEdit = (tarea: Tarea) => {
    setEditingTarea(tarea);
    setFormData({
      nombre: tarea.nombre,
      objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo],
      material: tarea.material,
      metros: tarea.metros.toString(),
      descripcion: tarea.descripcion || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!user || !formData.nombre.trim()) return;

    try {
      if (editingTarea) {
        // Update
        await updateDoc(doc(db, 'tareas', editingTarea.id), {
          nombre: formData.nombre.trim(),
          objetivo: formData.objetivo,
          material: formData.material,
          metros: parseInt(formData.metros) || 0,
          descripcion: formData.descripcion.trim(),
        });

        setTareas(tareas.map(t => 
          t.id === editingTarea.id 
            ? { ...t, ...formData, metros: parseInt(formData.metros) || 0 }
            : t
        ));
      } else {
        // Create - tareas compartidas entre todos los trainers
        const tareasRef = collection(db, 'tareas');
        const newTarea = await addDoc(tareasRef, {
          nombre: formData.nombre.trim(),
          objetivo: formData.objetivo,
          material: formData.material,
          metros: parseInt(formData.metros) || 0,
          descripcion: formData.descripcion.trim(),
          createdAt: serverTimestamp(),
        });

        setTareas([...tareas, { 
          id: newTarea.id, 
          ...formData, 
          metros: parseInt(formData.metros) || 0 
        }]);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving tarea:', error);
    }
  };

  const deleteTarea = async (tareaId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      await deleteDoc(doc(db, 'tareas', tareaId));
      setTareas(tareas.filter(t => t.id !== tareaId));
    } catch (error) {
      console.error('Error deleting tarea:', error);
    }
  };

  const filteredTareas = tareas.filter(t => {
    const objetivosArray = Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo].filter(Boolean);
    const matchSearch = 
      t.nombre.toLowerCase().includes(search.toLowerCase()) ||
      objetivosArray.some(o => o.toLowerCase().includes(search.toLowerCase()));
    const matchObjetivo = !filtroObjetivo || objetivosArray.includes(filtroObjetivo);
    const matchMaterial = !filtroMaterial || t.material === filtroMaterial;
    const matchMetros = !filtroMetros || t.metros >= parseInt(filtroMetros);
    
    return matchSearch && matchObjetivo && matchMaterial && matchMetros;
  });

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
          <h1 className="text-2xl font-bold text-ocean-800">Banco de Tareas</h1>
          <p className="text-ocean-600">Crea y gestiona ejercicios reutilizables</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
        >
          <Plus className="w-4 h-4" />
          Nueva Tarea
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ocean-400" />
        <input
          type="text"
          placeholder="Buscar tareas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-ocean-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean-500"
        />
      </div>

      {/* Filtros y View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
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

        <select
          value={filtroMaterial}
          onChange={(e) => setFiltroMaterial(e.target.value)}
          className="px-4 py-2 bg-white border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 text-sm"
        >
          <option value="">Todo el material</option>
          {materialOpciones.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

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
            className="px-3 py-2 text-sm text-ocean-600 hover:text-ocean-800 hover:bg-ocean-50 rounded-lg"
          >
            Limpiar filtros
          </button>
        )}

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-ocean-600 text-white'
                : 'bg-white text-ocean-600 hover:bg-ocean-50 border border-ocean-200'
            }`}
            title="Vista de tarjetas"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'table'
                ? 'bg-ocean-600 text-white'
                : 'bg-white text-ocean-600 hover:bg-ocean-50 border border-ocean-200'
            }`}
            title="Vista de tabla"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-ocean-800">{tareas.length}</p>
          <p className="text-sm text-ocean-500">Total tareas</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-ocean-800">
            {tareas.filter(t => {
              const arr = Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo];
              return arr.includes('TEC');
            }).length}
          </p>
          <p className="text-sm text-ocean-500">TEC</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-ocean-800">
            {tareas.filter(t => {
              const arr = Array.isArray(t.objetivo) ? t.objetivo : [t.objetivo];
              return arr.includes('VEL');
            }).length}
          </p>
          <p className="text-sm text-ocean-500">VEL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-ocean-800">
            {tareas.reduce((acc, t) => acc + t.metros, 0)}
          </p>
          <p className="text-sm text-ocean-500">Metros totales</p>
        </div>
      </div>

      {/* Tareas Grid */}
      {filteredTareas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Dumbbell className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
          <h3 className="text-lg font-medium text-ocean-700 mb-2">
            No hay tareas creadas
          </h3>
          <p className="text-ocean-500 mb-4">
            Crea ejercicios para reutilizarlos en tus workouts
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
          >
            <Plus className="w-4 h-4" />
            Crear Tarea
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ocean-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-ocean-700">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-ocean-700">Objetivos</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-ocean-700">Metros</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-ocean-700">Material</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-ocean-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean-100">
                {filteredTareas.map((tarea) => (
                  <tr key={tarea.id} className="hover:bg-ocean-50">
                    <td className="px-4 py-3 text-sm text-ocean-800 font-medium whitespace-pre-wrap">
                      {tarea.nombre}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(tarea.objetivo) ? (
                          tarea.objetivo.map((obj, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {obj}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {tarea.objetivo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ocean-600">{tarea.metros}m</td>
                    <td className="px-4 py-3 text-sm text-ocean-600">{tarea.material || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Link
                          href={`/entrenador/tareas/${tarea.id}/editar`}
                          className="p-1.5 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => deleteTarea(tarea.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTareas.map((tarea) => (
            <div
              key={tarea.id}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-ocean-800 whitespace-pre-wrap">{tarea.nombre}</h3>
                <div className="flex gap-1">
                  <Link
                    href={`/entrenador/tareas/${tarea.id}/editar`}
                    className="p-1.5 text-ocean-400 hover:text-ocean-600 hover:bg-ocean-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => deleteTarea(tarea.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(tarea.objetivo) ? (
                    tarea.objetivo.map((obj, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {obj}
                      </span>
                    ))
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                      {tarea.objetivo}
                    </span>
                  )}
                  {tarea.material && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                      {tarea.material}
                    </span>
                  )}
                </div>
                <p className="text-ocean-600">🏊 {tarea.metros}m</p>
                {tarea.descripcion && (
                  <p className="text-ocean-500 text-xs">{tarea.descripcion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">
                {editingTarea ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-ocean-400 hover:text-ocean-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Nombre * (Ctrl+Enter para salto de línea)
                </label>
                <textarea
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      const textarea = e.target as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const value = textarea.value;
                      const newValue = value.substring(0, start) + '\n' + value.substring(end);
                      setFormData({ ...formData, nombre: newValue });
                      // Posicionar cursor después del salto de línea
                      setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = start + 1;
                      }, 0);
                    }
                  }}
                  placeholder="Ej: 4x50 crol&#10;50 suave&#10;4x25 pies"
                  rows={3}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 resize-none font-mono text-sm"
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
                        formData.objetivo.includes(opt)
                          ? 'border-ocean-500 bg-ocean-50'
                          : 'border-ocean-200 hover:border-ocean-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.objetivo.includes(opt)}
                        onChange={(e) => {
                          const nuevos = e.target.checked
                            ? [...formData.objetivo, opt]
                            : formData.objetivo.filter(o => o !== opt);
                          setFormData({ ...formData, objetivo: nuevos });
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
                    value={formData.metros}
                    onChange={(e) => setFormData({ ...formData, metros: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">
                    Material
                  </label>
                  <select
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  >
                    <option value="">Seleccionar</option>
                    {materialOpciones.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                  placeholder="Notas adicionales..."
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <Save className="w-4 h-4" />
                {editingTarea ? 'Guardar Cambios' : 'Crear Tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
