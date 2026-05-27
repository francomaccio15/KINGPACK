'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-1 h-7 bg-kp-red rounded-full block" />
            <h1 className="text-2xl font-bold tracking-wide uppercase">King Pack</h1>
          </div>
          <p className="text-kp-gray text-sm">Sistema de gestión integral</p>
        </div>

        {/* Card */}
        <div className="bg-kp-surface border border-kp-border rounded-xl p-8 shadow-2xl">
          <h2 className="text-base font-semibold mb-6 text-kp-gray-lt">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-kp-gray mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-kp-bg border border-kp-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-kp-red transition-colors placeholder:text-kp-border"
                placeholder="usuario@kingpack.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-kp-gray mb-1.5 uppercase tracking-wide">
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-kp-bg border border-kp-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-kp-red transition-colors placeholder:text-kp-border"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm py-2 px-3 bg-kp-red/10 border border-kp-red/30 rounded-lg text-kp-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kp-red hover:bg-kp-red-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-kp-gray text-xs mt-6">MaccioTEC · KingPack</p>
      </div>
    </div>
  );
}
