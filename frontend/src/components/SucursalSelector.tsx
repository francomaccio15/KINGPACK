'use client';

import { useRouter } from 'next/navigation';

type Sucursal = { id: string; nombre: string };

export default function SucursalSelector({
  sucursales,
  activaId,
}: {
  sucursales: Sucursal[];
  activaId: string;
}) {
  const router = useRouter();

  const seleccionar = (id: string) => {
    if (id === activaId) return;
    // Cookie accesible al server en cada request; persiste 30 días
    document.cookie = `kp_sucursal_id=${id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    router.refresh();
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
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors
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
