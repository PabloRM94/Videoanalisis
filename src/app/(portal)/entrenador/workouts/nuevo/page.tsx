'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /entrenador/workouts/nuevo
 * Redirige a /nuevo/editar que contiene el formulario de creación.
 */
export default function NuevoWorkoutPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/entrenador/workouts/nuevo/editar');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600" />
    </div>
  );
}
