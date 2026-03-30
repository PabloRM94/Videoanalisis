import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// Generar código aleatorio de 8 caracteres
const generarCodigo = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusiones
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
};

export interface Invitacion {
  id: string;
  codigo: string;
  trainerId: string;
  trainerNombre?: string;
  usada: boolean;
  usedBy: string | null;
  createdAt: any;
}

// Crear una nueva invitación
export const crearInvitacion = async (trainerId: string, trainerNombre?: string): Promise<Invitacion> => {
  const codigo = generarCodigo();
  
  const invitacionesRef = collection(db, 'invitaciones');
  const docRef = await addDoc(invitacionesRef, {
    codigo,
    trainerId,
    trainerNombre: trainerNombre || '',
    usada: false,
    usedBy: null,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    codigo,
    trainerId,
    trainerNombre,
    usada: false,
    usedBy: null,
    createdAt: null, // El servidor maneja el timestamp
  };
};

// Validar código de invitación
export const validarInvitacion = async (codigo: string): Promise<{ valida: boolean; invitacion?: Invitacion; error?: string }> => {
  if (!codigo || codigo.length !== 8) {
    return { valida: false, error: 'Código inválido' };
  }

  const invitacionesRef = collection(db, 'invitaciones');
  const q = query(invitacionesRef, where('codigo', '==', codigo.toUpperCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { valida: false, error: 'Código no encontrado' };
  }

  const invitacionDoc = snapshot.docs[0];
  const invitacionData = invitacionDoc.data();

  if (invitacionData.usada) {
    return { valida: false, error: 'Código ya utilizado' };
  }

  return {
    valida: true,
    invitacion: {
      id: invitacionDoc.id,
      codigo: invitacionData.codigo,
      trainerId: invitacionData.trainerId,
      trainerNombre: invitacionData.trainerNombre,
      usada: invitacionData.usada,
      usedBy: invitacionData.usedBy,
      createdAt: invitacionData.createdAt,
    },
  };
};

// Marcar invitación como usada
export const usarInvitacion = async (invitacionId: string, userId: string): Promise<void> => {
  const invitacionRef = doc(db, 'invitaciones', invitacionId);
  await updateDoc(invitacionRef, {
    usada: true,
    usedBy: userId,
  });
};

// Obtener invitaciones de un trainer
export const getInvitacionesDelTrainer = async (trainerId: string): Promise<Invitacion[]> => {
  const invitacionesRef = collection(db, 'invitaciones');
  const q = query(invitacionesRef, where('trainerId', '==', trainerId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Invitacion[];
};
