'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-7xl font-bold text-kp-red mb-4">403</p>
        <h1 className="text-xl font-semibold mb-2">Acceso denegado</h1>
        <p className="text-kp-gray text-sm mb-6">
          Tu perfil{user ? ` (${user.rol})` : ''} no tiene permiso para acceder a esta sección.
        </p>
        <Link
          href="/articulos"
          className="text-sm text-kp-red hover:underline"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
