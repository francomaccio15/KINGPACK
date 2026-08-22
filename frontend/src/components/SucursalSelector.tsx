'use client';

import { useRouter } from 'next/navigation';

type Sucursal = { id: string; nombre: string };

export default function SucursalSelector({
  sucursales,
  activaId,
  layout = 'inline',
}: {
  sucursales: Sucursal[];
  activaId: string;
  /**
   * `inline` = toggle horizontal compacto del header (escritorio).
   * `stack`  = botones tactiles en grilla, para el drawer mobile, donde el
   *            toggle horizontal no entra a partir de 3 sucursales.
   */
  layout?: 'inline' | 'stack';
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

  const stack = layout === 'stack';

  return (
    <div
      className={
        stack
          ? 'grid grid-cols-2 gap-1.5'
          : 'flex items-center gap-1 bg-kp-surface2 border border-kp-border rounded-lg p-0.5'
      }
    >
      {opciones.map(s => {
        const isActive = s.id === activaId;
        return (
          <button
            key={s.id}
            onClick={() => seleccionar(s.id)}
            className={[
              'font-semibold uppercase tracking-wide rounded-md transition-colors',
              stack
                ? 'min-h-touch px-3 text-xs border border-kp-border'
                : 'px-3 py-1.5 text-xs',
              isActive
                ? 'bg-kp-red text-kp-white border-kp-red'
                : 'text-kp-gray hover:text-kp-gray-lt',
            ].join(' ')}
          >
            {s.nombre}
          </button>
        );
      })}
    </div>
  );
}
