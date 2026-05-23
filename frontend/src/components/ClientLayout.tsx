'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import SucursalSelector from './SucursalSelector';

interface Sucursal { id: string; nombre: string; }

const PUBLIC_PATHS = ['/login', '/forbidden'];

function UserMenu({ nombre, rol }: { nombre: string; rol: string }) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-none">
        <p className="text-sm font-medium text-kp-white">{nombre}</p>
        <p className="text-xs text-kp-gray mt-0.5 capitalize">{rol}</p>
      </div>
      <button
        onClick={() => { logout(); router.push('/login'); }}
        className="text-xs text-kp-gray hover:text-kp-red transition-colors px-2 py-1 rounded hover:bg-kp-border"
      >
        Salir
      </button>
    </div>
  );
}

function AppShell({
  children,
  sucursales,
  activaId,
}: {
  children: React.ReactNode;
  sucursales: Sucursal[];
  activaId: string | null;
}) {
  const { user, loading } = useAuth();
  const router    = useRouter();
  const pathname  = usePathname();
  const isPublic  = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.replace('/login');
    }
  }, [loading, user, isPublic, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-kp-gray text-sm">Cargando...</p>
      </div>
    );
  }

  // Páginas públicas: sin shell
  if (isPublic) return <div className="flex-1">{children}</div>;

  // Esperando redirect
  if (!user) return null;

  return (
    <>
      <header className="h-14 flex-shrink-0 bg-kp-surface border-b border-kp-border z-20">
        <div className="h-full px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h1 className="text-lg font-bold tracking-wide uppercase">
              King Pack
              <span className="text-kp-red ml-1">·</span>
              <span className="font-normal text-kp-gray ml-1 normal-case tracking-normal text-base">
                Gestión
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-5">
            <SucursalSelector sucursales={sucursales} activaId={activaId ?? ''} />
            <UserMenu nombre={user.nombre} rol={user.rol} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>

      <footer className="border-t border-kp-border text-xs text-center text-kp-gray py-4 flex-shrink-0 bg-kp-surface">
        KingPack &nbsp;·&nbsp; MaccioTEC &nbsp;·&nbsp;
        <span className="capitalize">{user.rol}</span>
      </footer>
    </>
  );
}

export function ClientLayout({
  children,
  sucursales,
  activaId,
}: {
  children: React.ReactNode;
  sucursales: Sucursal[];
  activaId: string | null;
}) {
  return (
    <AuthProvider>
      <AppShell sucursales={sucursales} activaId={activaId}>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
