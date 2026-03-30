'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Loader2, User, Dumbbell } from 'lucide-react';
import { registerUser } from '@/lib/firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { validarInvitacion } from '@/lib/firebase/invitaciones';

type Objetivo = 'oposicion' | 'triatlon' | 'crossfit';

export default function RegistroPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
    objetivo: '' as Objetivo | '',
    role: 'cliente' as 'cliente' | 'entrenador',
    codigoInvitacion: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && role) {
      if (role === 'entrenador') {
        router.push('/entrenador/dashboard');
      } else {
        router.push('/cliente/dashboard');
      }
    }
  }, [role, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!formData.objetivo) {
      setError('Selecciona un objetivo');
      return;
    }

    // Validar código de invitación si es entrenador
    if (formData.role === 'entrenador') {
      if (!formData.codigoInvitacion.trim()) {
        setError('Ingresa el código de invitación');
        return;
      }

      setLoading(true);
      
      try {
        const resultado = await validarInvitacion(formData.codigoInvitacion.trim());
        if (!resultado.valida) {
          setError(resultado.error || 'Código de invitación inválido');
          setLoading(false);
          return;
        }
      } catch (err) {
        setError('Error al validar invitación');
        setLoading(false);
        return;
      }
    }

    setLoading(true);

    try {
      await registerUser({
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        password: formData.password,
        objetivo: formData.objetivo as Objetivo,
        role: formData.role,
        codigoInvitacion: formData.role === 'entrenador' ? formData.codigoInvitacion.trim() : undefined,
      });
      
      // AuthContext will update and trigger redirect
    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario');
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
          <p className="text-ocean-200 mt-2">Crea tu cuenta</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 space-y-5">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: 'cliente', codigoInvitacion: '' })}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                formData.role === 'cliente'
                  ? 'border-gold-400 bg-gold-400/20 text-white'
                  : 'border-white/20 text-ocean-200 hover:border-white/40'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Cliente</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: 'entrenador' })}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                formData.role === 'entrenador'
                  ? 'border-gold-400 bg-gold-400/20 text-white'
                  : 'border-white/20 text-ocean-200 hover:border-white/40'
              }`}
            >
              <Dumbbell className="w-5 h-5" />
              <span className="font-medium">Entrenador</span>
            </button>
          </div>

          {/* Código de invitación - solo para entrenadores */}
          {formData.role === 'entrenador' && (
            <div>
              <label htmlFor="codigoInvitacion" className="block text-sm font-medium text-ocean-100 mb-2">
                Código de invitación *
              </label>
              <input
                id="codigoInvitacion"
                name="codigoInvitacion"
                type="text"
                value={formData.codigoInvitacion}
                onChange={(e) => setFormData({ ...formData, codigoInvitacion: e.target.value.toUpperCase() })}
                required
                maxLength={8}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400 uppercase"
                placeholder="XXXXXXXX"
              />
              <p className="text-ocean-300 text-xs mt-1">
                Solicita un código a otro entrenador dado de alta
              </p>
            </div>
          )}

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-ocean-100 mb-2">
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              value={formData.nombre}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ocean-100 mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="telefono" className="block text-sm font-medium text-ocean-100 mb-2">
              Teléfono (WhatsApp)
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              value={formData.telefono}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="+34 612 345 678"
            />
          </div>

          <div>
            <label htmlFor="objetivo" className="block text-sm font-medium text-ocean-100 mb-2">
              Objetivo
            </label>
            <select
              id="objetivo"
              name="objetivo"
              value={formData.objetivo}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold-400 appearance-none"
            >
              <option value="" className="bg-ocean-800">Selecciona tu objetivo</option>
              <option value="oposicion" className="bg-ocean-800">Oposiciones (Bomberos, Policía, Militar)</option>
              <option value="triatlon" className="bg-ocean-800">Triatlón</option>
              <option value="crossfit" className="bg-ocean-800">CrossFit</option>
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ocean-100 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-ocean-300 focus:outline-none focus:ring-2 focus:ring-gold-400"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ocean-100 mb-2">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
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
              'Crear Cuenta'
            )}
          </button>

          <div className="text-center pt-4 border-t border-white/10">
            <p className="text-ocean-200 text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium">
                Inicia sesión
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
