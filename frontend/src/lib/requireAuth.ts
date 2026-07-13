import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { puedeAcceder } from './permissions';
import type { AuthUser } from './auth';

type VerifyResult = { user: AuthUser | null; reason?: string; info?: Record<string, unknown> };

function verifyToken(token: string): VerifyResult {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { user: null, reason: 'MALFORMADO' };

    const [header, payload, signature] = parts;

    // Verificar firma HS256 con el secret del servidor
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[auth] JWT_SECRET no configurado');
      return { user: null, reason: 'SIN_SECRET' };
    }

    // Decodificar payload (aunque la firma falle, lo usamos para el log)
    let decoded: (AuthUser & { exp?: number; iat?: number }) | null = null;
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return { user: null, reason: 'MALFORMADO' };
    }

    const expectedSig = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (expectedSig !== signature) {
      return { user: null, reason: 'FIRMA_INVALIDA', info: { usuario: decoded?.email ?? null } };
    }

    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (decoded!.exp && decoded!.exp < now) {
      return {
        user: null,
        reason: 'EXPIRADO',
        info: {
          usuario:           decoded!.email ?? null,
          vida_util_min:     decoded!.iat ? Math.round((decoded!.exp - decoded!.iat) / 60) : null,
          expirado_hace_min: Math.round((now - decoded!.exp) / 60),
        },
      };
    }

    return { user: decoded };
  } catch {
    return { user: null, reason: 'ERROR' };
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
  // Sin cookie: visitante anónimo (o cookie ya limpiada). No se loguea para no
  // ensuciar con tráfico de bots / primeras cargas.
  if (!token) redirect('/login');

  const { user, reason, info } = verifyToken(token);
  if (!user) {
    // Instrumentación de cierres de sesión: el token SÍ vino pero se rechazó.
    // Registramos el motivo y (si expiró) la vida útil real, para detectar si la
    // sesión se cae antes de lo esperado. Grep: [auth-reject]
    console.warn('[auth-reject]', JSON.stringify({ motivo: reason, modulo: modulo ?? null, ...(info ?? {}) }));
    redirect('/login');
  }

  if (modulo && !puedeAcceder(user.rol, modulo)) redirect('/forbidden');

  return user;
}
