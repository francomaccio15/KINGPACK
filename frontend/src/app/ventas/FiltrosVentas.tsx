'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import FiltersBar from '@/components/ui/FiltersBar';
import { cn, inputCls, labelCls } from '@/lib/ui';

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'preventa',   label: 'Preventa' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'facturada',  label: 'Facturada' },
  { value: 'anulada',    label: 'Anulada' },
];

export default function FiltrosVentas({ hoy }: { hoy: string }) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  const q           = searchParams.get('q') ?? '';
  const estado      = searchParams.get('estado') ?? '';
  const fecha_desde = searchParams.get('fecha_desde') ?? '';
  const fecha_hasta = searchParams.get('fecha_hasta') ?? '';

  const hayFiltros = !!(q || estado || fecha_desde || fecha_hasta);
  const activos = [q, estado, fecha_desde, fecha_hasta].filter(Boolean).length;

  // Sin filtros explícitos, la vista muestra por defecto las ventas de hoy:
  // reflejamos esa fecha en los inputs para que quede claro.
  const desdeVal = hayFiltros ? fecha_desde : hoy;
  const hastaVal = hayFiltros ? fecha_hasta : hoy;

  const limpiar = () => router.replace(pathname);

  const buscador = (
    <div className="relative w-full md:flex-1 md:min-w-[200px] md:max-w-xs">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kp-gray pointer-events-none"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder="Buscar cliente o número…"
        defaultValue={q}
        onChange={e => update('q', e.target.value)}
        inputMode="search" enterKeyHint="search" autoComplete="off"
        className={cn(inputCls, 'pl-9')}
      />
    </div>
  );

  return (
    <FiltersBar activos={activos} onLimpiar={limpiar} alwaysVisible={buscador}>
      {/* Estado */}
      <div>
        <label className={cn(labelCls, 'md:hidden')}>Estado</label>
        <div className="grid grid-cols-3 xs:grid-cols-5 gap-1 md:flex md:items-center md:gap-1 md:bg-kp-surface2 md:border md:border-kp-border md:rounded-lg md:p-1">
          {ESTADOS.map(({ value, label }) => {
            const active = estado === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => update('estado', value)}
                className={cn(
                  'rounded-md text-xs font-semibold transition-colors whitespace-nowrap',
                  'min-h-touch px-2 border border-kp-border md:min-h-0 md:border-0 md:px-3 md:py-1.5',
                  active
                    ? 'bg-kp-red text-white border-kp-red'
                    : 'text-kp-gray hover:text-kp-white hover:bg-kp-surface',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rango de fechas */}
      <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
        <div>
          <label className={cn(labelCls, 'md:hidden')}>Desde</label>
          <input
            type="date"
            value={desdeVal}
            onChange={e => update('fecha_desde', e.target.value)}
            className={cn(inputCls, 'md:w-auto')}
            title="Desde"
          />
        </div>
        <div>
          <label className={cn(labelCls, 'md:hidden')}>Hasta</label>
          <input
            type="date"
            value={hastaVal}
            onChange={e => update('fecha_hasta', e.target.value)}
            className={cn(inputCls, 'md:w-auto')}
            title="Hasta"
          />
        </div>
      </div>
    </FiltersBar>
  );
}
