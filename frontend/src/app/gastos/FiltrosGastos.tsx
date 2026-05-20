'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Proveedor = { id: string; razon_social: string };

const TIPOS = [
  { value: '',                     label: 'Todos los tipos' },
  { value: 'compra_mercaderia',    label: 'Compra Mercadería' },
  { value: 'compra_gasto',         label: 'Compra Gasto' },
  { value: 'carga_social_laboral', label: 'Carga Social' },
  { value: 'gasto_manual',         label: 'Gasto Manual' },
  { value: 'inversion_bien_uso',   label: 'Inversión / Bien de Uso' },
  { value: 'anticipo_proveedor',   label: 'Anticipo a Proveedor' },
];

const ESTADOS_PAGO = [
  { value: '',          label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente de pago' },
  { value: 'parcial',   label: 'Pago parcial' },
  { value: 'pagado',    label: 'Pagado' },
];

export default function FiltrosGastos({ proveedores }: { proveedores: Proveedor[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const push = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/gastos?${params.toString()}`);
  }, [router, sp]);

  const limpiar = () => router.push('/gastos');
  const hayFiltros = !!(sp.get('q') || sp.get('tipo_operacion') || sp.get('proveedor_id')
    || sp.get('fecha_desde') || sp.get('fecha_hasta') || sp.get('estado_pago'));

  const inputCls = 'bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        type="search"
        placeholder="Buscar descripción o proveedor…"
        defaultValue={sp.get('q') ?? ''}
        onChange={e => push('q', e.target.value)}
        className={`${inputCls} w-64`}
      />

      <select
        value={sp.get('tipo_operacion') ?? ''}
        onChange={e => push('tipo_operacion', e.target.value)}
        className={`${inputCls} w-52`}
      >
        {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

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

      <select
        value={sp.get('estado_pago') ?? ''}
        onChange={e => push('estado_pago', e.target.value)}
        className={`${inputCls} w-44`}
      >
        {ESTADOS_PAGO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>

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
