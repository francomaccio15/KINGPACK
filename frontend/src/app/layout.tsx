import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { ClientLayout } from '@/components/ClientLayout';
import { getSucursalActivaId } from '@/lib/getSucursalActiva';

const montserrat = Montserrat({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'KingPack',
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
        <ClientLayout sucursales={sucursales} activaId={sucursalActivaId}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
