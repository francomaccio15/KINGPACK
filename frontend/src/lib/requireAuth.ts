import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { puedeAcceder } from './permissions';
import type { AuthUser } from './auth';

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as AuthUser;
  } catch { return null; }
}

/**
 * Llama esta función al inicio de cualquier Server Component protegido.
 * - Sin args: solo verifica que haya sesión activa.
 * - Con `modulo` (ej: '/ventas'): también verifica que el rol tenga acceso.
 *
 * Redirige a /login si no hay sesión, a /forbidden si no tiene permiso.
 */
export function requireAuth(modulo?: string): AuthUser {
  const token = cookies().get('kp_token')?.value;
  if (!token) redirect('/login');

  const user = decodeToken(token);
  if (!user) redirect('/login');

  if (modulo && !puedeAcceder(user.rol, modulo)) redirect('/forbidden');

  return user;
}
