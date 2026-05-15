'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Sucursal = { id: string; nombre: string };

export default function SucursalSelector({
  sucursales,
  activaId,
}: {
  sucursales: Sucursal[];
  activaId: string;
}) {
  const router   = useRouter();
  const [loading, setLoading] = useState(false);

  const seleccionar = async (id: string) => {
    if (id === activaId || loading) return;
    setLoading(true);
    await fetch('/api/sucursal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sucursal_id: id }),
    });
    router.refresh();
    setLoading(false);
  };

  const opciones: Sucursal[] = [
    { id: '', nombre: 'Todas' },
    ...sucursales,
  ];

  return (
    <div className="flex items-center gap-1 bg-kp-surface2 border border-kp-border rounded-lg p-0.5">
      {opciones.map(s => {
        const isActive = s.id === activaId;
        return (
          <button
            key={s.id}
            onClick={() => seleccionar(s.id)}
            disabled={loading}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors disabled:opacity-60
              ${isActive
                ? 'bg-kp-red text-kp-white'
                : 'text-kp-gray hover:text-kp-gray-lt'
              }`}
          >
            {s.nombre}
          </button>
        );
      })}
    </div>
  );
}
