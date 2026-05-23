import Link from 'next/link';
import AccionesVenta from './AccionesVenta';

import { serverFetch } from '@/lib/serverFetch';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fechaFmt = (d: string) => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const ESTADO_STYLE: Record<string, string> = {
  preventa:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmada: 'bg-green-500/10 text-green-400 border-green-500/30',
  facturada:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  anulada:    'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

export const dynamic = 'force-dynamic';

async function fetchVenta(id: string) {
  try {
    const res = await serverFetch(`/api/ventas/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function VentaDetallePage({ params }: { params: { id: string } }) {
  const data = await fetchVenta(params.id);

  if (!data) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Venta no encontrada.</p>
        <Link href="/ventas" className="text-kp-red hover:underline text-sm">← Volver a Ventas</Link>
      </section>
    );
  }

  const { venta, items, pagos, facturacion } = data;
  const descuento = parseFloat(venta.descuento_total || '0');

  return (
    <section className="space-y-6 max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-kp-gray">
        <Link href="/ventas" className="hover:text-kp-white transition-colors">Ventas</Link>
        <span>/</span>
        <span className="text-kp-white font-medium">#{venta.numero}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">
              Venta #{venta.numero}
            </h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ESTADO_STYLE[venta.estado] ?? ''}`}>
              {venta.estado.charAt(0).toUpperCase() + venta.estado.slice(1)}
            </span>
          </div>
          <p className="text-sm text-kp-gray pl-3">{fechaFmt(venta.fecha)}</p>
        </div>
        <AccionesVenta ventaId={params.id} estado={venta.estado} total={venta.total} facturacion={facturacion} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Columna principal — Items */}
        <div className="lg:col-span-2 space-y-5">

          {/* Items de la venta */}
          <div className="rounded-xl border border-kp-border overflow-hidden">
            <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
                Artículos ({items.length})
              </h3>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-kp-border">
                  <th className="text-left px-5 py-2.5 text-xs text-kp-gray font-semibold uppercase tracking-widest">Artículo</th>
                  <th className="text-right px-3 py-2.5 text-xs text-kp-gray font-semibold uppercase tracking-widest">Cant.</th>
                  <th className="text-right px-3 py-2.5 text-xs text-kp-gray font-semibold uppercase tracking-widest">P. Lista</th>
                  <th className="text-right px-3 py-2.5 text-xs text-kp-gray font-semibold uppercase tracking-widest">Desc.</th>
                  <th className="text-right px-5 py-2.5 text-xs text-kp-gray font-semibold uppercase tracking-widest">Precio Final</th>
                  <th className="text-right px-5 py-2.5 text-xs text-kp-gray font-semibold uppercase tracking-widest">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-kp-surface divide-y divide-kp-border">
                {items.map((item: any) => {
                  const tieneDesc = parseFloat(item.descuento_pct || '0') > 0;
                  const subtotalItem = parseFloat(item.precio_unitario_final) * parseFloat(item.cantidad);
                  return (
                    <tr key={item.articulo_id} className="hover:bg-kp-surface2 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-kp-white">{item.nombre}</p>
                        <p className="text-xs text-kp-gray font-mono">{item.codigo}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-kp-gray-lt">
                        {parseFloat(item.cantidad).toFixed(0)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        {tieneDesc
                          ? <span className="line-through text-kp-gray">{fmt(item.precio_lista)}</span>
                          : <span className="text-kp-gray">{fmt(item.precio_lista)}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        {tieneDesc
                          ? <span className="text-kp-red font-semibold">{parseFloat(item.descuento_pct).toFixed(1)}%</span>
                          : <span className="text-kp-border">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-kp-white">
                        {fmt(item.precio_unitario_final)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-kp-white">
                        {fmt(subtotalItem)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Observaciones */}
          {venta.observaciones && (
            <div className="rounded-xl border border-kp-border p-5 bg-kp-surface">
              <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray mb-2">Observaciones</h3>
              <p className="text-sm text-kp-gray-lt">{venta.observaciones}</p>
            </div>
          )}

        </div>

        {/* Columna lateral */}
        <div className="space-y-4">

          {/* Totales */}
          <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
            <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Resumen</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-kp-gray">Subtotal</span>
                <span className="text-kp-white tabular-nums">{fmt(venta.subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-kp-gray">Descuento</span>
                  <span className="text-kp-red tabular-nums font-semibold">−{fmt(descuento)}</span>
                </div>
              )}
              <div className="border-t border-kp-border pt-3 flex justify-between">
                <span className="font-bold text-kp-white text-base">Total</span>
                <span className="font-bold text-kp-white text-base tabular-nums">{fmt(venta.total)}</span>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
            <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border">
              <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Cliente</h3>
            </div>
            <div className="px-5 py-4 space-y-1.5">
              {venta.cliente_nombre ? (
                <>
                  <p className="font-semibold text-kp-white text-sm">{venta.cliente_nombre}</p>
                  {venta.cliente_cuit && (
                    <p className="text-xs text-kp-gray font-mono">{venta.cliente_cuit}</p>
                  )}
                  {venta.cliente_cond_iva && (
                    <p className="text-xs text-kp-gray-lt">{venta.cliente_cond_iva}</p>
                  )}
                  {venta.lista_precio && (
                    <span className="inline-flex text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray-lt mt-1">
                      {venta.lista_precio}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm text-kp-gray italic">Consumidor Final</p>
              )}
            </div>
          </div>

          {/* Pagos */}
          {pagos.length > 0 && (
            <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
              <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border">
                <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Formas de Pago</h3>
              </div>
              <div className="px-5 py-4 space-y-2">
                {pagos.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-kp-gray-lt">{p.medio_pago}</span>
                    <span className="text-kp-white tabular-nums font-medium">{fmt(p.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facturación ARCA */}
          {facturacion && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 overflow-hidden">
              <div className="bg-blue-500/10 px-5 py-3 border-b border-blue-500/30">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Factura ARCA</h3>
              </div>
              <div className="px-5 py-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-kp-gray">Tipo</span>
                  <span className="text-blue-300">{facturacion.tipo_comprobante}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-kp-gray">Número</span>
                  <span className="text-kp-white font-mono text-xs">
                    {String(facturacion.punto_venta).padStart(4,'0')}-{String(facturacion.factura_numero).padStart(8,'0')}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-kp-gray text-xs">CAE</span>
                  <span className="text-blue-300 font-mono text-xs break-all">{facturacion.cae}</span>
                </div>
                {facturacion.cae_vencimiento && (
                  <div className="flex justify-between text-xs">
                    <span className="text-kp-gray">Vence</span>
                    <span className="text-kp-gray-lt">{new Date(facturacion.cae_vencimiento).toLocaleDateString('es-AR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
