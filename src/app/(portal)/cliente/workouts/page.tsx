'use client';

import { redirect } from 'next/navigation';

export default function ClienteWorkoutsPage() {
  // Redirect to dashboard which has the workouts view
  redirect('/cliente/dashboard');
}
