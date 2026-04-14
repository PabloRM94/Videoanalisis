import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface TiempoMMP {
  fecha: Date | Timestamp;
  tiempo: number;
  tipo: 'mmp';
}

export interface TiempoSerie {
  repeticion: number;
  tiempo: number;
  fecha: Date | Timestamp;
}

export interface SesionSeries {
  fecha: Date | Timestamp;
  distancia: number;
  tiempos: TiempoSerie[];
  mejorTiempo: number;
  expiresAt?: Date | Timestamp;
}

export const guardarTiempoMMP = async (
  clienteId: string,
  distancia: number,
  tiempo: number,
  fecha?: Date
): Promise<void> => {
  try {
    const tiemposRef = doc(db, 'clienteTiempos', clienteId, 'tiemposMMP', distancia.toString());
    const existente = await getDoc(tiemposRef);
    
    let historial: TiempoMMP[] = [];
    let mejorTiempo = tiempo;
    
    if (existente.exists()) {
      const data = existente.data();
      historial = (data.historial || []).map((t: any) => ({
        ...t,
        fecha: t.fecha instanceof Timestamp ? t.fecha.toDate() : t.fecha
      }));
      mejorTiempo = data.mejorTiempo || tiempo;
      
      if (tiempo < mejorTiempo) {
        mejorTiempo = tiempo;
      }
    }
    
    const fechaIngresada = fecha || new Date();
    
    historial.push({
      fecha: fechaIngresada,
      tiempo,
      tipo: 'mmp'
    });
    
    historial.sort((a, b) => a.tiempo - b.tiempo);
    
    await setDoc(tiemposRef, {
      historial: historial.map(t => ({
        ...t,
        fecha: t.fecha instanceof Date ? Timestamp.fromDate(t.fecha) : t.fecha
      })),
      mejorTiempo,
      distancia,
      ultimaActualizacion: serverTimestamp()
    });
  } catch (error) {
    console.error('Error guardando tiempo MMP:', error);
    throw error;
  }
};

export const getTiemposMMP = async (clienteId: string, distancia: number): Promise<TiempoMMP[]> => {
  try {
    const tiemposRef = doc(db, 'clienteTiempos', clienteId, 'tiemposMMP', distancia.toString());
    const docSnap = await getDoc(tiemposRef);
    
    if (!docSnap.exists()) {
      return [];
    }
    
    const data = docSnap.data();
    return (data.historial || []).map((t: any) => ({
      ...t,
      fecha: t.fecha instanceof Timestamp ? t.fecha.toDate() : t.fecha
    }));
  } catch (error) {
    console.error('Error obteniendo tiempos MMP:', error);
    return [];
  }
};

export const getAllTiemposMMP = async (clienteId: string): Promise<Map<number, TiempoMMP[]>> => {
  try {
    const tiemposRef = collection(db, 'clienteTiempos', clienteId, 'tiemposMMP');
    const snapshot = await getDocs(tiemposRef);
    
    const result = new Map<number, TiempoMMP[]>();
    
    for (const docSnap of snapshot.docs) {
      const distancia = parseInt(docSnap.id);
      const data = docSnap.data();
      
      const historial = (data.historial || []).map((t: any) => ({
        ...t,
        fecha: t.fecha instanceof Timestamp ? t.fecha.toDate() : t.fecha
      }));
      
      result.set(distancia, historial);
    }
    
    return result;
  } catch (error) {
    console.error('Error obteniendo todos los tiempos MMP:', error);
    return new Map();
  }
};

export const guardarSesionSeries = async (
  clienteId: string,
  distancia: number,
  tiempos: TiempoSerie[]
): Promise<string> => {
  try {
    const sesionRef = collection(db, 'clienteSeries', clienteId, 'sesiones');
    
    const mejorTiempo = Math.min(...tiempos.map(t => t.tiempo));
    const ahora = new Date();
    const expiresAt = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
    
    const docRef = await addDoc(sesionRef, {
      distancia,
      tiempos: tiempos.map(t => ({
        ...t,
        fecha: t.fecha instanceof Date ? Timestamp.fromDate(t.fecha) : t.fecha
      })),
      mejorTiempo,
      fecha: Timestamp.fromDate(ahora),
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error guardando sesión series:', error);
    throw error;
  }
};

export const getSesionesSeries = async (clienteId: string): Promise<SesionSeries[]> => {
  try {
    const sesionRef = collection(db, 'clienteSeries', clienteId, 'sesiones');
    const q = query(sesionRef, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    
    const ahora = new Date();
    const sesiones: SesionSeries[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const expira = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : data.expiresAt;
      
      if (expira && expira < ahora) {
        await deleteDoc(docSnap.ref);
        continue;
      }
      
      sesiones.push({
        fecha: data.fecha instanceof Timestamp ? data.fecha.toDate() : data.fecha,
        distancia: data.distancia,
        tiempos: (data.tiempos || []).map((t: any) => ({
          ...t,
          fecha: t.fecha instanceof Timestamp ? t.fecha.toDate() : t.fecha
        })),
        mejorTiempo: data.mejorTiempo
      });
    }
    
    return sesiones;
  } catch (error) {
    console.error('Error obteniendo sesiones series:', error);
    return [];
  }
};

export const getSesionesSeriesConId = async (clienteId: string): Promise<{id: string; data: SesionSeries}[]> => {
  try {
    const sesionRef = collection(db, 'clienteSeries', clienteId, 'sesiones');
    const q = query(sesionRef, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    
    const ahora = new Date();
    const sesiones: {id: string; data: SesionSeries}[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const expira = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : data.expiresAt;
      
      if (expira && expira < ahora) {
        await deleteDoc(docSnap.ref);
        continue;
      }
      
      sesiones.push({
        id: docSnap.id,
        data: {
          fecha: data.fecha instanceof Timestamp ? data.fecha.toDate() : data.fecha,
          distancia: data.distancia,
          tiempos: (data.tiempos || []).map((t: any) => ({
            ...t,
            fecha: t.fecha instanceof Timestamp ? t.fecha.toDate() : t.fecha
          })),
          mejorTiempo: data.mejorTiempo,
          expiresAt: expira
        }
      });
    }
    
    return sesiones;
  } catch (error) {
    console.error('Error obteniendo sesiones series:', error);
    return [];
  }
};

export const getSesionesSeriesCliente = async (clienteId: string): Promise<SesionSeries[]> => {
  try {
    const sesionRef = collection(db, 'clienteSeries', clienteId, 'sesiones');
    const q = query(sesionRef, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(sesionRef);
    
    const sesiones: SesionSeries[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      sesiones.push({
        fecha: data.fecha instanceof Timestamp ? data.fecha.toDate() : data.fecha,
        distancia: data.distancia,
        tiempos: (data.tiempos || []).map((t: any) => ({
          ...t,
          fecha: t.fecha instanceof Timestamp ? t.fecha.toDate() : t.fecha
        })),
        mejorTiempo: data.mejorTiempo
      });
    }
    
    return sesiones;
  } catch (error) {
    console.error('Error obteniendo sesiones series cliente:', error);
    return [];
  }
};

export const eliminarSesionSeries = async (
  clienteId: string,
  sesionId: string
): Promise<void> => {
  try {
    const sesionRef = doc(db, 'clienteSeries', clienteId, 'sesiones', sesionId);
    await deleteDoc(sesionRef);
  } catch (error) {
    console.error('Error eliminando sesión series:', error);
    throw error;
  }
};

export const getMejorTiempoMMP = async (
  clienteId: string,
  distancia: number
): Promise<number | null> => {
  try {
    const tiemposRef = doc(db, 'clienteTiempos', clienteId, 'tiemposMMP', distancia.toString());
    const docSnap = await getDoc(tiemposRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docSnap.data().mejorTiempo || null;
  } catch (error) {
    console.error('Error obteniendo mejor tiempo MMP:', error);
    return null;
  }
};