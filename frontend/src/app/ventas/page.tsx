import { Suspense } from 'react';
import Link from 'next/link';
import FiltrosVentas from './FiltrosVentas';
import NuevaVenta from './NuevaVenta';
import { serverFetch } from '@/lib/serverFetch';

type Venta = {
  id: string;
  numero: number;
  fecha: string;
  estado: 'preventa' | 'confirmada' | 'facturada' | 'anulada';
  total: string;
  subtotal: string;
  descuento_total: string;
  cliente_nombre: string | null;
  sucursal_nombre: string | null;
  lista_precio: string | null;
  cae: string | null;
  facturada_ok: boolean | null;
  items_count: number;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const ESTADO_STYLE: Record<string, string> = {
  preventa:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmada: 'bg-green-500/10 text-green-400 border-green-500/30',
  facturada:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  anulada:    'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

const ESTADO_LABEL: Record<string, string> = {
  preventa:   'Preventa',
  confirmada: 'Confirmada',
  facturada:  'Facturada',
  anulada:    'Anulada',
};

async function fetchData(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  if (params.q)           q.set('q', params.q);
  if (params.estado)      q.set('estado', params.estado);
  if (params.fecha_desde) q.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) q.set('fecha_hasta', params.fecha_hasta);
  q.set('limit', '100');

  const [ventasRes, sucursalesRes, listasRes] = await Promise.all([
    serverFetch(`/api/ventas?${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ventas: [], count: 0 })),
    serverFetch('/api/sucursales',  { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch('/api/listas-precios', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ listas: [] })),
  ]);

  const rawListas = listasRes.listas ?? [];
  return {
    ventas:     ventasRes.ventas ?? [],
    count:      ventasRes.count ?? 0,
    sucursales: sucursalesRes.sucursales ?? [],
    listas:     rawListas.map((l: any) => ({
      id: l.id,
      nombre: l.nombre,
      descuento_lista: parseFloat(l.descuento_base_pct) || 0,
    })),
  };
}

export const dynamic = 'force-dynamic';

export default async function VentasPage({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string };
}) {
  const { ventas, count, sucursales, listas } = await fetchData(searchParams);
  const hayFiltros = !!(searchParams.q || searchParams.estado || searchParams.fecha_desde || searchParams.fecha_hasta);

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Ventas</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {count} {count === 1 ? 'registro' : 'registros'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </p>
        </div>
        <NuevaVenta sucursales={sucursales} listas={listas} />
      </div>

      {/* Filtros */}
      <Suspense>
        <FiltrosVentas />
      </Suspense>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Nº</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Sucursal</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Items</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Descuento</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Total</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {ventas.map((v: Venta) => {
              const descuento = parseFloat(v.descuento_total || '0');
              const fecha = new Date(v.fecha).toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              });
              return (
                <tr key={v.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray-lt tabular-nums">
                    #{v.numero}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">
                    {fecha}
                  </td>
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors">
                    {v.cliente_nombre ?? <span className="text-kp-gray italic text-xs">Consumidor Final</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">
                    {v.sucursal_nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-kp-gray tabular-nums">
                    {v.items_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">
                    {descuento > 0
                      ? <span className="text-kp-red">−{fmt(descuento)}</span>
                      : <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {fmt(v.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[v.estado] ?? ''}`}>
                      {v.cae && (
                        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
                      )}
                      {ESTADO_LABEL[v.estado] ?? v.estado}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/ventas/${v.id}`}
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
            {ventas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-kp-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    <p className="text-kp-gray text-sm">
                      {hayFiltros ? 'No hay ventas que coincidan con los filtros.' : 'No hay ventas registradas todavía.'}
                    </p>
                    {!hayFiltros && (
                      <p className="text-kp-gray/50 text-xs">Usá el botón "Nueva Venta" para registrar la primera.</p>
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
