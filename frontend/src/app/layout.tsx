import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ClientLayout } from '@/components/ClientLayout';
import { getSucursalActivaId } from '@/lib/getSucursalActiva';

// Montserrat servida localmente (subset latin, pesos 400–800). Antes venía de
// next/font/google, que la baja en build: si el VPS no llega a Google Fonts el
// build se cae. Con archivos locales el build no depende de la red.
const montserrat = localFont({
  src: [
    { path: './fonts/montserrat-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/montserrat-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/montserrat-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/montserrat-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/montserrat-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-montserrat',
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'KingPack',
  description: 'Sistema de gestión integral — King Pack',
  manifest:    '/manifest.webmanifest',
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'KingPack',
  },
};

export const viewport: Viewport = {
  themeColor:   '#0d0d0d',
  width:        'device-width',
  initialScale: 1,
  // Permite zoom manual (accesibilidad): nunca poner userScalable: false.
  maximumScale: 5,
  // El contenido entra debajo del notch/home indicator; las utilidades
  // pt-safe / pb-safe se encargan de despejarlo donde corresponde.
  viewportFit: 'cover',
  // Al abrir el teclado virtual se reduce el viewport en vez de taparlo, para
  // que las barras de acciones sticky (POS, formularios largos) sigan visibles.
  interactiveWidget: 'resizes-content',
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
      <body className="min-h-[100dvh] flex flex-col bg-kp-bg text-kp-white">
        <ClientLayout sucursales={sucursales} activaId={sucursalActivaId}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
