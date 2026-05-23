import { Suspense } from 'react';
import Link from 'next/link';
import FiltrosPedidos from './FiltrosPedidos';
import NuevoPedido from './NuevoPedido';

import { serverFetch } from '@/lib/serverFetch';

type Pedido = {
  id: string;
  fecha_pedido: string;
  estado: 'pendiente' | 'recibido_parcial' | 'recibido' | 'cancelado';
  monto_total: string;
  numero_factura_prov: string | null;
  proveedor_id: string;
  proveedor_nombre: string;
  sucursal_nombre: string | null;
  items_count: number;
  egreso_id: string | null;
  stock_acreditado: boolean;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const ESTADO_STYLE: Record<string, string> = {
  pendiente:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
  recibido_parcial: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  recibido:         'bg-green-500/10 text-green-400 border-green-500/30',
  cancelado:        'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:        'Pendiente',
  recibido_parcial: 'Parcial',
  recibido:         'Recibido',
  cancelado:        'Cancelado',
};

async function fetchData(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  if (params.q)            q.set('q', params.q);
  if (params.estado)       q.set('estado', params.estado);
  if (params.proveedor_id) q.set('proveedor_id', params.proveedor_id);
  if (params.fecha_desde)  q.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta)  q.set('fecha_hasta', params.fecha_hasta);
  q.set('limit', '200');

  const [pedidosRes, sucursalesRes, proveedoresRes] = await Promise.all([
    serverFetch(`/api/pedidos-compra?${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ pedidos: [], count: 0 })),
    serverFetch(`/api/sucursales`,           { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch(`/api/proveedores?limit=500`,{ cache: 'no-store' }).then(r => r.json()).catch(() => ({ proveedores: [] })),
  ]);

  return {
    pedidos:     pedidosRes.pedidos       ?? [],
    count:       pedidosRes.count         ?? 0,
    sucursales:  sucursalesRes.sucursales ?? [],
    proveedores: proveedoresRes.proveedores ?? [],
  };
}

export const dynamic = 'force-dynamic';

export default async function PedidosProveedoresPage({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; proveedor_id?: string; fecha_desde?: string; fecha_hasta?: string };
}) {
  const { pedidos, count, sucursales, proveedores } = await fetchData(searchParams);
  const hayFiltros = !!(searchParams.q || searchParams.estado || searchParams.proveedor_id || searchParams.fecha_desde || searchParams.fecha_hasta);

  const pendienteCount = pedidos.filter((p: Pedido) => p.estado === 'pendiente').length;

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Pedidos a Proveedores</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {count} {count === 1 ? 'pedido' : 'pedidos'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <NuevoPedido sucursales={sucursales} proveedores={proveedores} />

          {/* Indicador de pendientes */}
          {pendienteCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold text-amber-400">
                {pendienteCount} esperando confirmación
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-kp-gray/60 pl-3 -mt-2">
        Los pedidos se generan automáticamente al registrar una compra de mercadería en Gastos.
      </p>

      {/* Filtros */}
      <Suspense>
        <FiltrosPedidos proveedores={proveedores} />
      </Suspense>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Proveedor</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Sucursal</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Items</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Total</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Stock</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {pedidos.map((p: Pedido) => {
              const fecha = new Date(p.fecha_pedido).toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              });
              return (
                <tr key={p.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">{fecha}</td>
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors">
                    {p.proveedor_nombre}
                    {p.egreso_id && (
                      <Link
                        href={`/gastos/${p.egreso_id}`}
                        onClick={e => e.stopPropagation()}
                        className="ml-2 text-xs text-blue-400/70 hover:text-blue-400 hover:underline"
                        title="Ver egreso de origen"
                      >
                        egreso
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{p.sucursal_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-xs text-kp-gray tabular-nums">
                    {p.items_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {fmt(p.monto_total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[p.estado] ?? ''}`}>
                      {ESTADO_LABEL[p.estado] ?? p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.stock_acreditado ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400 font-semibold">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Acreditado
                      </span>
                    ) : p.estado !== 'cancelado' ? (
                      <span className="text-xs text-amber-400/70">Pendiente</span>
                    ) : (
                      <span className="text-xs text-kp-gray/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/pedidos-proveedores/${p.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1
                        text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent
                        hover:border-kp-border hover:bg-kp-surface2"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-kp-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <p className="text-kp-gray text-sm">
                      {hayFiltros
                        ? 'No hay pedidos que coincidan con los filtros.'
                        : 'No hay pedidos registrados.'}
                    </p>
                    {!hayFiltros && (
                      <p className="text-kp-gray/50 text-xs">
                        Al registrar una compra de mercadería en{' '}
                        <Link href="/gastos/nuevo" className="text-kp-red hover:underline">Gastos</Link>
                        , el pedido aparece aquí automáticamente.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
