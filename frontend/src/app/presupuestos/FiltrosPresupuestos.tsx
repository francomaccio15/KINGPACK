'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export default function FiltrosPresupuestos() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const q           = searchParams.get('q') ?? '';
  const fecha_desde = searchParams.get('fecha_desde') ?? '';
  const fecha_hasta = searchParams.get('fecha_hasta') ?? '';

  const limpiar = () => router.replace(pathname);
  const hayFiltros = !!(q || fecha_desde || fecha_hasta);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Búsqueda */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kp-gray pointer-events-none"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por cliente o número…"
          defaultValue={q}
          onChange={e => update('q', e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-kp-surface2 border border-kp-border
            focus:border-kp-red text-kp-white placeholder:text-kp-gray outline-none transition-colors"
        />
      </div>

      {/* Rango de fechas */}
      <input
        type="date"
        value={fecha_desde}
        onChange={e => update('fecha_desde', e.target.value)}
        className="px-3 py-2 rounded-lg text-sm bg-kp-surface2 border border-kp-border
          focus:border-kp-red text-kp-white outline-none transition-colors"
        title="Desde"
      />
      <span className="text-kp-gray text-xs">—</span>
      <input
        type="date"
        value={fecha_hasta}
        onChange={e => update('fecha_hasta', e.target.value)}
        className="px-3 py-2 rounded-lg text-sm bg-kp-surface2 border border-kp-border
          focus:border-kp-red text-kp-white outline-none transition-colors"
        title="Hasta"
      />

      {/* Limpiar */}
      {hayFiltros && (
        <button
          onClick={limpiar}
          className="px-3 py-2 rounded-lg text-xs text-kp-gray hover:text-kp-white border border-transparent
            hover:border-kp-border transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
