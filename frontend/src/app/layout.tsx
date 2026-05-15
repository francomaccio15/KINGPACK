import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import SucursalSelector from '@/components/SucursalSelector';
import { getSucursalActivaId } from '@/lib/getSucursalActiva';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KingPack',
  description: 'Sistema de gestión integral — King Pack',
};

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchSucursales() {
  try {
    const r = await fetch(`${API}/api/sucursales`, { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).sucursales ?? [];
  } catch { return []; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [sucursales, sucursalActivaId] = await Promise.all([
    fetchSucursales(),
    Promise.resolve(getSucursalActivaId()),
  ]);

  return (
    <html lang="es" className={montserrat.variable}>
      <body className="min-h-screen flex flex-col bg-kp-bg text-kp-white">

        {/* Header — logo + selector de sucursal */}
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
            <SucursalSelector sucursales={sucursales} activaId={sucursalActivaId} />
          </div>
        </header>

        {/* Cuerpo: sidebar + contenido */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-8">
              {children}
            </div>
          </main>
        </div>

        <footer className="border-t border-kp-border text-xs text-center text-kp-gray py-4 flex-shrink-0 bg-kp-surface">
          KingPack &nbsp;·&nbsp; MaccioTEC &nbsp;·&nbsp; {process.env.NODE_ENV}
        </footer>

      </body>
    </html>
  );
}
