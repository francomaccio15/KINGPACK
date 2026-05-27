import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { puedeAcceder } from './permissions';
import type { AuthUser } from './auth';

function verifyToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Verificar firma HS256 con el secret del servidor
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[auth] JWT_SECRET no configurado');
      return null;
    }

    const expectedSig = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (expectedSig !== signature) return null;

    // Decodificar payload
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as AuthUser & { exp?: number; iat?: number };

    // Verificar expiración
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Llama esta función al inicio de cualquier Server Component protegido.
 * - Sin args: solo verifica que haya sesión activa.
 * - Con `modulo` (ej: '/ventas'): también verifica que el rol tenga acceso.
 *
 * Redirige a /login si no hay sesión o el token es inválido/expirado.
 * Redirige a /forbidden si el rol no tiene permiso al módulo.
 */
export function requireAuth(modulo?: string): AuthUser {
  const token = cookies().get('kp_token')?.value;
  if (!token) redirect('/login');

  const user = verifyToken(token);
  if (!user) redirect('/login');

  if (modulo && !puedeAcceder(user.rol, modulo)) redirect('/forbidden');

  return user;
}
