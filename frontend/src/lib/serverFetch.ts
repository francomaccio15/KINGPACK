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

  // Inyectar sucursal_id en la query string solo si hay un UUID real seleccionado
  let fullPath = path;
  if (sucursal) {
    const separator = path.includes('?') ? '&' : '?';
    fullPath = `${path}${separator}sucursal_id=${encodeURIComponent(sucursal)}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API}${fullPath}`, { ...init, headers });
}
