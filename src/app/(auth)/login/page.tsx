'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Loader2 } from 'lucide-react';
import { loginUser } from '@/lib/firebase/auth';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && role === 'entrenador') {
      router.push('/entrenador/dashboard');
    } else if (!authLoading && role === 'cliente') {
      router.push('/cliente/dashboard');
    }
  }, [role, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUser({ email, password });
      // AuthContext will update and trigger redirect via useEffect
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-900 to-ocean-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4">
            <MessageCircle className="w-10 h-10 text-gold-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">VideoAnálisis</h1>
          <p className="text-ocean-200 mt-2">Inicia sesión para continuar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ocean-100 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ocean-100 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-gold-500 hover:bg-gold-400 text-ocean-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Iniciar Sesión'
            )}
          </button>

          <div className="text-center pt-4 border-t border-white/10">
            <p className="text-ocean-200 text-sm">
              ¿No tienes cuenta?{' '}
              <Link href="/registro" className="text-gold-400 hover:text-gold-300 font-medium">
                Regístrate
              </Link>
            </p>
          </div>
        </form>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-ocean-300 hover:text-white text-sm">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
