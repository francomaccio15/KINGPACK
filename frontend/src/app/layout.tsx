import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KingPack',
  description: 'Sistema de gestión integral — King Pack',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="bg-kingpack text-white">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              KingPack <span className="text-kingpack-accent">·</span>{' '}
              <span className="font-normal opacity-80">Gestión</span>
            </h1>
            <nav className="text-sm opacity-90">
              <a href="/articulos" className="hover:underline">Artículos</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        <footer className="text-xs text-center text-slate-500 py-6">
          KingPack · MaccioTEC · entorno {process.env.NODE_ENV}
        </footer>
      </body>
    </html>
  );
}
