import { cookies } from 'next/headers';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * fetch autenticado para Server Components.
 * Lee el JWT de la cookie kp_token y lo agrega como Authorization header.
 * Si la cookie kp_sucursal_id está seteada (admin/supervisor filtrando por sucursal),
 * la inyecta como ?sucursal_id= en la URL para que el backend filtre correctamente.
 */
export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const jar      = cookies();
  const token    = jar.get('kp_token')?.value;
  const sucursal = jar.get('kp_sucursal_id')?.value; // '' = Todas, UUID = una sucursal

  // Inyectar sucursal_id solo si hay UUID real Y no está ya en la URL (evita duplicados)
  let fullPath = path;
  if (sucursal) {
    const [base, qs] = path.split('?');
    const params = new URLSearchParams(qs || '');
    if (!params.has('sucursal_id')) {
      params.set('sucursal_id', sucursal);
    }
    fullPath = `${base}?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API}${fullPath}`, { ...init, headers });
}
