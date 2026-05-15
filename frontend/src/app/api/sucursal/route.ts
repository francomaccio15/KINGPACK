import { NextRequest, NextResponse } from 'next/server';

// POST /api/sucursal  — persiste la sucursal activa en cookie
// Body: { sucursal_id: string }   ('' = todas las sucursales)
export async function POST(req: NextRequest) {
  const { sucursal_id } = await req.json();

  // TODO(fase-2): validar que el usuario tenga permiso sobre esta sucursal
  const value = typeof sucursal_id === 'string' ? sucursal_id : '';

  const res = NextResponse.json({ ok: true });
  res.cookies.set('kp_sucursal_id', value, {
    httpOnly: false,   // el cliente la lee para saber qué tab está activa
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
