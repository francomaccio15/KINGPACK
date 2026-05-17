'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Proveedor = { id: string; razon_social: string };

const ESTADOS = [
  { value: '',                label: 'Todos los estados' },
  { value: 'pendiente',       label: 'Pendiente' },
  { value: 'recibido_parcial',label: 'Parcial' },
  { value: 'recibido',        label: 'Recibido' },
  { value: 'cancelado',       label: 'Cancelado' },
];

export default function FiltrosPedidos({ proveedores }: { proveedores: Proveedor[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const push = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/pedidos-proveedores?${params.toString()}`);
  }, [router, sp]);

  const limpiar = () => router.push('/pedidos-proveedores');
  const hayFiltros = !!(sp.get('q') || sp.get('estado') || sp.get('proveedor_id') || sp.get('fecha_desde') || sp.get('fecha_hasta'));

  const inputCls = 'bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Buscar */}
      <input
        type="search"
        placeholder="Buscar proveedor o Nº factura…"
        defaultValue={sp.get('q') ?? ''}
        onChange={e => push('q', e.target.value)}
        className={`${inputCls} w-64`}
      />

      {/* Proveedor */}
      <select
        value={sp.get('proveedor_id') ?? ''}
        onChange={e => push('proveedor_id', e.target.value)}
        className={`${inputCls} w-52`}
      >
        <option value="">Todos los proveedores</option>
        {proveedores.map(p => (
          <option key={p.id} value={p.id}>{p.razon_social}</option>
        ))}
      </select>

      {/* Estado */}
      <select
        value={sp.get('estado') ?? ''}
        onChange={e => push('estado', e.target.value)}
        className={`${inputCls} w-44`}
      >
        {ESTADOS.map(e => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>

      {/* Rango de fechas */}
      <input
        type="date"
        value={sp.get('fecha_desde') ?? ''}
        onChange={e => push('fecha_desde', e.target.value)}
        className={`${inputCls} w-40`}
      />
      <span className="text-kp-gray text-sm">—</span>
      <input
        type="date"
        value={sp.get('fecha_hasta') ?? ''}
        onChange={e => push('fecha_hasta', e.target.value)}
        className={`${inputCls} w-40`}
      />

      {hayFiltros && (
        <button
          onClick={limpiar}
          className="text-xs text-kp-gray hover:text-kp-red transition-colors underline underline-offset-2"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
