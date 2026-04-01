'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import TareaForm, { TareaFormData, Tarea } from '@/components/TareaForm';

export default function EditarTareaPage() {
  const params = useParams();
  const router = useRouter();
  const tareaId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch tarea
  useEffect(() => {
    const fetchTarea = async () => {
      if (!tareaId) {
        setError('ID de tarea no proporcionado');
        setLoading(false);
        return;
      }

      try {
        const tareaDoc = await getDoc(doc(db, 'tareas', tareaId));
        
        if (!tareaDoc.exists()) {
          setError('Tarea no encontrada');
          setLoading(false);
          return;
        }

        const tareaData = { id: tareaDoc.id, ...tareaDoc.data() } as Tarea;
        setTarea(tareaData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching tarea:', err);
        setError('Error al cargar la tarea');
        setLoading(false);
      }
    };

    fetchTarea();
  }, [tareaId]);

  const handleSave = async (data: TareaFormData) => {
    if (!tarea) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'tareas', tarea.id), {
        nombre: data.nombre.trim(),
        objetivo: data.objetivo,
        material: data.material,
        metros: parseInt(data.metros) || 0,
        descripcion: data.descripcion.trim(),
      });

      // Redirigir al listado
      router.push('/entrenador/tareas');
    } catch (err) {
      console.error('Error saving tarea:', err);
      throw new Error('Error al guardar la tarea');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/entrenador/tareas');
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
          onClick={() => router.push('/entrenador/tareas')}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleCancel}
          className="p-2 text-ocean-600 hover:text-ocean-800 hover:bg-ocean-50 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ocean-800">Editar Tarea</h1>
          <p className="text-ocean-600">Modifica los datos del ejercicio</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <TareaForm
          tarea={tarea}
          onSave={handleSave}
          onCancel={handleCancel}
          loading={saving}
        />
      </div>
    </div>
  );
}