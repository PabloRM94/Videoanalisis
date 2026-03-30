'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

type UserRole = 'cliente' | 'entrenador' | null;

interface AuthUser extends User {
  role?: UserRole;
  nombre?: string;
  telefono?: string;
  objetivo?: string;
  grupoId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const authUser: AuthUser = {
              ...firebaseUser,
              role: userData.role || null,
              nombre: userData.nombre || '',
              telefono: userData.telefono || '',
              objetivo: userData.objetivo || '',
              grupoId: userData.grupoId || null,
            };
            setUser(authUser);
            setRole(userData.role || null);
          } else {
            // User exists in Auth but not in Firestore (shouldn't happen)
            setUser({ ...firebaseUser, role: null });
            setRole(null);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUser({ ...firebaseUser, role: null });
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
