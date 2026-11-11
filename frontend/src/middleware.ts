import { NextRequest, NextResponse } from 'next/server';

// CSRF / CORS del frontend Next.
// - Toda mutación (POST/PUT/PATCH/DELETE) que llegue con un Origin de otro sitio
//   se rechaza con 403.
// - Los preflight CORS (OPTIONS) de otros sitios también se rechazan: el
//   frontend no expone nada para orígenes ajenos.
// La API Express (/api en nginx) usa token Bearer y tiene su propio chequeo.
const SAFE = new Set(['GET', 'HEAD']);

function mismoOrigen(req: NextRequest, origin: string): boolean {
  try {
    const o = new URL(origin);
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    return o.host === host;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  if (SAFE.has(req.method)) return NextResponse.next();

  const origin = req.headers.get('origin');
  // Sin Origin: no es un navegador haciendo un pedido cross-site (curl, server).
  if (origin && !mismoOrigen(req, origin)) {
    console.warn('[security]', JSON.stringify({
      evento: 'origen_rechazado', capa: 'frontend', metodo: req.method,
      ruta: req.nextUrl.pathname, origin,
      ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || null,
    }));
    return new NextResponse(JSON.stringify({ error: 'Origen no permitido' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
