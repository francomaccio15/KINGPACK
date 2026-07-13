'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { landingPath } from '@/lib/permissions';
import { KingPackLogoFull } from '@/components/KingPackLogo';

export default function LoginPage() {
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const usuario = await login(email, password);
      // Navegación DURA (full reload) en lugar de router.replace: fuerza al
      // servidor a renderizar la landing con la cookie recién seteada. Evita el
      // Router Cache de Next, que mientras estábamos deslogueados prefeteó las
      // rutas protegidas como "redirigir a /login" y hacía rebotar el login
      // (obligaba a reintentar varias veces). No reseteamos loading: la página
      // se va a recargar entera.
      window.location.assign(landingPath(usuario.rol));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <KingPackLogoFull />
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
