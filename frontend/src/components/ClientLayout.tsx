'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import SucursalSelector from './SucursalSelector';
import NotifBell from './NotifBell';
import { KingPackLogoWithSubtitle } from './KingPackLogo';

interface Sucursal { id: string; nombre: string; }

const PUBLIC_PATHS = ['/login', '/forbidden'];

const IcoMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

function UserMenu({ nombre, rol }: { nombre: string; rol: string }) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right leading-none min-w-0">
        <p className="text-sm font-medium text-kp-white truncate max-w-[130px]">{nombre}</p>
        <p className="text-xs text-kp-gray mt-0.5 capitalize">{rol}</p>
      </div>
      <button
        onClick={() => { logout(); router.push('/login'); }}
        className="text-xs text-kp-gray hover:text-kp-red transition-colors px-2 py-1 rounded hover:bg-kp-border whitespace-nowrap"
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

  const [mobileOpen, setMobileOpen] = useState(false);

  // Cerrar drawer mobile al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  if (isPublic) return <div className="flex-1">{children}</div>;
  if (!user) return null;

  return (
    <>
      <header className="h-14 flex-shrink-0 bg-kp-surface border-b border-kp-border z-20 print:hidden">
        <div className="h-full px-4 md:px-5 flex items-center gap-3">

          {/* Hamburger — solo mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-md text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors flex-shrink-0"
          >
            <IcoMenu />
          </button>

          <KingPackLogoWithSubtitle subtitle="Gestión" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Controles derecha */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {(user.rol === 'administrador' || user.rol === 'cajero') && <NotifBell />}
            {user.rol === 'cajero' ? (
              <span className="hidden sm:inline-block px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md bg-kp-surface2 border border-kp-border text-kp-gray-lt truncate max-w-[120px]">
                {sucursales.find(s => s.id === user.sucursal_default_id)?.nombre ?? 'Sucursal'}
              </span>
            ) : (
              <div className="hidden sm:block">
                <SucursalSelector sucursales={sucursales} activaId={activaId ?? ''} />
              </div>
            )}
            <UserMenu nombre={user.nombre} rol={user.rol} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="print:hidden">
          <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        </div>
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>

      <footer className="border-t border-kp-border text-xs text-center text-kp-gray py-4 flex-shrink-0 bg-kp-surface print:hidden">
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
