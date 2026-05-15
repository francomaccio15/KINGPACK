'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

type Sucursal = { id: string; nombre: string };

export default function ClientesFiltros({ sucursales }: { sucursales: Sucursal[] }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }, [searchParams, pathname, router]);

  const q          = searchParams.get('q') ?? '';
  const activo     = searchParams.get('activo') ?? '';
  const sucursalId = searchParams.get('sucursal_id') ?? '';

  return (
    <div className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? 'opacity-60' : ''}`}>

      {/* Buscador */}
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray pointer-events-none">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por nombre o CUIT…"
          defaultValue={q}
          onChange={e => update('q', e.target.value)}
          className="pl-8 pr-3 py-1.5 w-56 bg-kp-surface2 border border-kp-border rounded-lg text-sm text-kp-white
            placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
        />
      </div>

      {/* Filtro sucursal */}
      {sucursales.length > 0 && (
        <select
          value={sucursalId}
          onChange={e => update('sucursal_id', e.target.value)}
          className="py-1.5 px-3 bg-kp-surface2 border border-kp-border rounded-lg text-sm text-kp-white
            focus:outline-none focus:border-kp-red transition-colors"
        >
          <option value="">Todas las sucursales</option>
          {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      )}

      {/* Filtro estado */}
      <select
        value={activo}
        onChange={e => update('activo', e.target.value)}
        className="py-1.5 px-3 bg-kp-surface2 border border-kp-border rounded-lg text-sm text-kp-white
          focus:outline-none focus:border-kp-red transition-colors"
      >
        <option value="">Solo activos</option>
        <option value="all">Todos</option>
        <option value="false">Inactivos</option>
      </select>

      {/* Limpiar filtros */}
      {(q || sucursalId || activo) && (
        <button
          onClick={() => startTransition(() => router.replace(pathname))}
          className="text-xs text-kp-gray hover:text-kp-white transition-colors px-2 py-1.5 rounded border border-transparent hover:border-kp-border"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
