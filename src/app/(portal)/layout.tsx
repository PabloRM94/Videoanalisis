'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  Calendar, 
  History, 
  LogOut, 
  Menu, 
  X,
  Dumbbell,
  UserPlus,
  Timer
} from 'lucide-react';

const clienteNavItems = [
  { href: '/cliente/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/cliente/workouts', label: 'Workouts', icon: Calendar },
  { href: '/cliente/historial', label: 'Historial', icon: History },
];

const entrenadorNavItems = [
  { href: '/entrenador/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/entrenador/clientes', label: 'Clientes', icon: Dumbbell },
  { href: '/entrenador/tareas', label: 'Banco de Tareas', icon: Dumbbell },
  { href: '/entrenador/workouts', label: 'Workouts', icon: Calendar },
  { href: '/entrenador/cronometro', label: 'Cronómetro', icon: Timer },
  { href: '/entrenador/invitaciones', label: 'Invitaciones', icon: UserPlus },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Redirect based on role
    if (user && role && pathname === '/portal') {
      if (role === 'entrenador') {
        router.push('/entrenador/dashboard');
      } else {
        router.push('/cliente/dashboard');
      }
    }
  }, [user, role, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ocean-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  if (!user || !role) {
    return null;
  }

  const isEntrenador = role === 'entrenador';
  const navItems = isEntrenador ? entrenadorNavItems : clienteNavItems;

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-ocean-50">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm lg:hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href={isEntrenador ? '/entrenador/dashboard' : '/cliente/dashboard'} className="flex items-center gap-2">
            <span className="text-xl font-bold text-ocean-700">PabloRM</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-ocean-600 hover:bg-ocean-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-ocean-200 px-4 py-3 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  pathname === item.href
                    ? 'bg-ocean-100 text-ocean-700'
                    : 'text-ocean-600 hover:bg-ocean-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-screen fixed">
          <div className="p-6">
            <Link href={isEntrenador ? '/entrenador/dashboard' : '/cliente/dashboard'} className="flex items-center gap-2">
              <Dumbbell className="w-8 h-8 text-ocean-600" />
              <span className="text-xl font-bold text-ocean-700">PabloRM</span>
            </Link>
          </div>

          <nav className="px-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  pathname === item.href
                    ? 'bg-ocean-100 text-ocean-700 font-medium'
                    : 'text-ocean-600 hover:bg-ocean-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-ocean-200">
            <div className="mb-3 px-4">
              <p className="font-medium text-ocean-700 truncate">{user.nombre}</p>
              <p className="text-sm text-ocean-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 p-8">
          {children}
        </main>
      </div>

      {/* Mobile Main Content */}
      <main className="lg:hidden p-4">
        {children}
      </main>
    </div>
  );
}
