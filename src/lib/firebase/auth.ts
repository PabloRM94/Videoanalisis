import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { validarInvitacion, usarInvitacion } from './invitaciones';

export interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  objetivo: 'oposicion' | 'triatlon' | 'crossfit';
  role: 'cliente' | 'entrenador';
  codigoInvitacion?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const registerUser = async (data: RegisterData): Promise<void> => {
  try {
    // Validar código de invitación si es entrenador
    if (data.role === 'entrenador' && data.codigoInvitacion) {
      const resultado = await validarInvitacion(data.codigoInvitacion);
      if (!resultado.valida || !resultado.invitacion) {
        throw new Error(resultado.error || 'Código de invitación inválido');
      }
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: data.nombre
      });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: data.email,
        nombre: data.nombre,
        telefono: data.telefono,
        objetivo: data.objetivo,
        role: data.role,
        invitedBy: resultado.invitacion.trainerId,
        createdAt: serverTimestamp(),
      });

      // Marcar invitación como usada
      await usarInvitacion(resultado.invitacion.id, user.uid);

    } else if (data.role === 'cliente') {
      // Cliente normal - sin invitación necesaria
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: data.nombre
      });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: data.email,
        nombre: data.nombre,
        telefono: data.telefono,
        objetivo: data.objetivo,
        role: data.role,
        createdAt: serverTimestamp(),
      });

      // El grupo se asignará después desde el panel del entrenador
      await setDoc(doc(db, 'users', user.uid), {
        grupoId: null,
      }, { merge: true });

    } else {
      throw new Error('Código de invitación requerido para registrarte como entrenador');
    }

  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('El email ya está registrado');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    } else if (error.message?.includes('invitación')) {
      throw error;
    } else {
      throw new Error('Error al registrar usuario');
    }
  }
};

export const loginUser = async (data: LoginData): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, data.email, data.password);
  } catch (error: any) {
    console.error('Error logging in:', error);
    if (error.code === 'auth/invalid-email') {
      throw new Error('Email inválido');
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('Usuario no encontrado');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Contraseña incorrecta');
    } else {
      throw new Error('Error al iniciar sesión');
    }
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error resetting password:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('No existe ninguna cuenta con este email');
    } else {
      throw new Error('Error al enviar email de recuperación');
    }
  }
};

export const getUserRole = async (uid: string): Promise<string | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data().role || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};
