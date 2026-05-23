import { cookies } from 'next/headers';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * fetch autenticado para Server Components.
 * Lee el JWT de la cookie kp_token y lo agrega como Authorization header.
 */
export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = cookies().get('kp_token')?.value;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API}${path}`, { ...init, headers });
}
