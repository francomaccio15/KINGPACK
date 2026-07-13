export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  rol: 'administrador' | 'supervisor' | 'cajero' | 'vendedor';
  sucursal_default_id: string | null;
}

const TOKEN_KEY = 'kp_token';
const USER_KEY  = 'kp_user';

export function saveSession(token: string, usuario: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
  // Cookie para que los Server Components puedan leer el token.
  // max-age = 24h, igual que la expiración del JWT (JWT_EXPIRES_IN en el backend);
  // deben coincidir para que la cookie no muera antes ni después que el token.
  document.cookie = `kp_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Strict`;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = 'kp_token=; path=/; max-age=0';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthUser; } catch { return null; }
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** fetch autenticado — agrega el header Authorization automáticamente */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API}${path}`, { ...init, headers });
}
