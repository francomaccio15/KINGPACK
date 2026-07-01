'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { AuthUser, getToken, getStoredUser, saveSession, clearSession } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AuthContextValue {
  user:    AuthUser | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<AuthUser>;
  logout:  () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      setUser(stored);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Error al iniciar sesión');
    }
    const { token, usuario, sucursal_inicial_id } = await res.json() as {
      token: string; usuario: AuthUser; sucursal_inicial_id?: string | null;
    };
    saveSession(token, usuario);
    // Sucursal inicial de la sesión (cajero → la suya; administrador → Laprida).
    // El backend la resuelve; si viene, la fijamos en la cookie que lee serverFetch.
    if (sucursal_inicial_id) {
      document.cookie = `kp_sucursal_id=${sucursal_inicial_id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
    setUser(usuario);
    return usuario;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
