'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  doc 
} from 'firebase/firestore';
import { Users, Plus, Copy, Trash2, Check, X, Clock } from 'lucide-react';
import { crearInvitacion, getInvitacionesDelTrainer, Invitacion } from '@/lib/firebase/invitaciones';

export default function InvitacionesPage() {
  const { user } = useAuth();
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [codigoCopiado, setCodigoCopiado] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitaciones = async () => {
      if (!user) return;

      try {
        const data = await getInvitacionesDelTrainer(user.uid);
        setInvitaciones(data);
      } catch (error) {
        console.error('Error fetching invitaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvitaciones();
  }, [user]);

  const generarCodigo = async () => {
    if (!user) return;

    setGenerando(true);
    try {
      const nueva = await crearInvitacion(user.uid, user.displayName || user.email || undefined);
      setInvitaciones([nueva, ...invitaciones]);
    } catch (error) {
      console.error('Error generating codigo:', error);
    } finally {
      setGenerando(false);
    }
  };

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCodigoCopiado(codigo);
      setTimeout(() => setCodigoCopiado(null), 2000);
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  const eliminarInvitacion = async (invitacionId: string) => {
    if (!confirm('¿Eliminar esta invitación?')) return;

    try {
      await deleteDoc(doc(db, 'invitaciones', invitacionId));
      setInvitaciones(invitaciones.filter(i => i.id !== invitacionId));
    } catch (error) {
      console.error('Error deleting invitacion:', error);
    }
  };

  const invitacionesActivas = invitaciones.filter(i => !i.usada);
  const invitacionesUsadas = invitaciones.filter(i => i.usada);

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
          <h1 className="text-2xl font-bold text-ocean-800">Invitaciones</h1>
          <p className="text-ocean-600">Genera códigos para nuevos entrenadores</p>
        </div>
        <button
          onClick={generarCodigo}
          disabled={generando}
          className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50"
        >
          {generando ? (
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Generar Código
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-800 mb-1">¿Cómo funciona?</h3>
        <p className="text-sm text-blue-700">
          Genera un código de 8 caracteres y compártelo con quien quieras que se registre como entrenador.
          El código puede usarse una sola vez.
        </p>
      </div>

      {/* Invitaciones Activas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ocean-100">
          <h2 className="font-semibold text-ocean-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Códigos Activos ({invitacionesActivas.length})
          </h2>
        </div>
        
        {invitacionesActivas.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-ocean-500">
              No hay códigos activos. Genera uno para invitar a nuevos trainers.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ocean-100">
            {invitacionesActivas.map((inv) => (
              <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-ocean-100 px-4 py-2 rounded-lg">
                    <span className="font-mono text-lg font-bold text-ocean-800 tracking-wider">
                      {inv.codigo}
                    </span>
                  </div>
                  <div className="text-sm text-ocean-600">
                    {inv.trainerNombre && <p>Creado por: {inv.trainerNombre}</p>}
                    <p className="flex items-center gap-1 text-green-600">
                      <Check className="w-4 h-4" /> Activo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copiarCodigo(inv.codigo)}
                    className="flex items-center gap-2 px-3 py-2 bg-ocean-100 text-ocean-700 rounded-lg hover:bg-ocean-200"
                  >
                    {codigoCopiado === inv.codigo ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => eliminarInvitacion(inv.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invitaciones Usadas */}
      {invitacionesUsadas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden opacity-75">
          <div className="px-6 py-4 border-b border-ocean-100 bg-ocean-50">
            <h2 className="font-semibold text-ocean-700 flex items-center gap-2">
              <X className="w-5 h-5" />
              Códigos Usados ({invitacionesUsadas.length})
            </h2>
          </div>
          
          <div className="divide-y divide-ocean-100">
            {invitacionesUsadas.map((inv) => (
              <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <span className="font-mono text-lg font-bold text-gray-500 tracking-wider">
                      {inv.codigo}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p className="flex items-center gap-1">
                      <X className="w-4 h-4" /> Usado
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
