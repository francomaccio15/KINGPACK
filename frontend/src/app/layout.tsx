import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
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
      <body className="min-h-screen flex flex-col">
        <header className="bg-kp-surface border-b border-kp-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="w-1 h-6 bg-kp-red rounded-full block" />
              <h1 className="text-lg font-bold tracking-wide uppercase">
                King Pack
                <span className="text-kp-red ml-1">·</span>
                <span className="font-normal text-kp-gray ml-1 normal-case tracking-normal text-base">
                  Gestión
                </span>
              </h1>
            </div>

            {/* Nav + Selector */}
            <div className="flex items-center gap-6">
              <nav className="flex items-center gap-6 text-sm font-medium">
                <a href="/articulos"
                  className="text-kp-gray-lt hover:text-kp-red transition-colors duration-150 uppercase tracking-wide text-xs">
                  Artículos
                </a>
                <a href="/listas-precios"
                  className="text-kp-gray-lt hover:text-kp-red transition-colors duration-150 uppercase tracking-wide text-xs">
                  Listas de Precios
                </a>
              </nav>

              {/* Divisor */}
              <span className="w-px h-5 bg-kp-border" />

              {/* Selector de sucursal */}
              <SucursalSelector sucursales={sucursales} activaId={sucursalActivaId} />
            </div>

          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          {children}
        </main>

        <footer className="border-t border-kp-border text-xs text-center text-kp-gray py-5">
          KingPack &nbsp;·&nbsp; MaccioTEC &nbsp;·&nbsp; {process.env.NODE_ENV}
        </footer>
      </body>
    </html>
  );
}
