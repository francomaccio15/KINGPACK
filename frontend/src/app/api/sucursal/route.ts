import { NextRequest, NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/sucursal  — persiste la sucursal activa en cookie
// Body: { sucursal_id: string }   ('' = todas las sucursales)
// El Origin lo valida src/middleware.ts. El permiso real sobre la sucursal lo
// aplica el backend (sucursalEfectiva): esta cookie es solo una preferencia.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sucursal_id = (body as { sucursal_id?: unknown }).sucursal_id;

  const value = typeof sucursal_id === 'string' && UUID_RE.test(sucursal_id) ? sucursal_id : '';

  const res = NextResponse.json({ ok: true });
  res.cookies.set('kp_sucursal_id', value, {
    httpOnly: false,   // el cliente la lee para saber qué tab está activa
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
