import Link from 'next/link';
import AccionesPedido from './AccionesPedido';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

const ESTADO_STYLE: Record<string, string> = {
  pendiente:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
  recibido_parcial: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  recibido:         'bg-green-500/10 text-green-400 border-green-500/30',
  cancelado:        'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:        'Pendiente',
  recibido_parcial: 'Recibido Parcial',
  recibido:         'Recibido',
  cancelado:        'Cancelado',
};

export const dynamic = 'force-dynamic';

export default async function DetallePedidoPage({ params }: { params: { id: string } }) {
  const user = requireAuth('/pedidos-proveedores');
  const esCajero = user.rol === 'cajero';
  let pedido: any = null;
  let items: any[] = [];

  try {
    const res = await serverFetch(`/api/pedidos-compra/${params.id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      pedido = data.pedido;
      items  = data.items ?? [];
    }
  } catch { /* handled below */ }

  if (!pedido) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Pedido no encontrado.</p>
        <Link href="/pedidos-proveedores" className="text-kp-red hover:underline text-sm">
          ← Volver a pedidos
        </Link>
      </section>
    );
  }

  const fecha = fmtDate(pedido.fecha_pedido);
  const fechaRecepcion = fmtDate(pedido.fecha_recepcion);
  const totalMerc = items.reduce((s: number, i: any) =>
    s + parseFloat(i.precio_compra) * parseFloat(i.cantidad), 0
  );

  return (
    <section className="space-y-6 max-w-4xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-kp-gray">
        <Link href="/pedidos-proveedores" className="hover:text-kp-white transition-colors">
          Pedidos a Proveedores
        </Link>
        <span>/</span>
        <span className="text-kp-white">{pedido.proveedor_nombre}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold">{pedido.proveedor_nombre}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[pedido.estado] ?? ''}`}>
              {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
            </span>
            {pedido.stock_acreditado && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Stock acreditado
              </span>
            )}
          </div>
          <p className="text-sm text-kp-gray pl-3">
            Pedido del {fecha}
            {pedido.sucursal_nombre && <> · {pedido.sucursal_nombre}</>}
            {fechaRecepcion && <> · Recibido: {fechaRecepcion}</>}
          </p>
        </div>
        <AccionesPedido pedido={pedido} items={items} esCajero={esCajero} />
      </div>

      {/* Banner: generado desde egreso */}
      {pedido.egreso_id && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-blue-400 flex-shrink-0">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="text-kp-gray">
            Generado desde egreso de compra.
          </span>
          <Link
            href={`/gastos/${pedido.egreso_id}`}
            className="ml-auto text-xs text-blue-400 hover:text-blue-300 hover:underline font-semibold whitespace-nowrap"
          >
            Ver egreso →
          </Link>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Proveedor',  value: pedido.proveedor_nombre },
          { label: 'CUIT',       value: pedido.proveedor_cuit ?? '—' },
          { label: 'Nº Factura', value: pedido.numero_factura_prov ?? '—' },
          { label: 'Teléfono',   value: pedido.proveedor_telefono ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
            <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">{c.label}</p>
            <p className="text-sm font-medium text-kp-white truncate" title={c.value}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">Artículos del Pedido</h3>
          <span className="text-xs text-kp-gray/60">{items.length} línea{items.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2/50 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Código</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Pedido</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Recibido</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">P. Compra</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {items.map((item: any) => {
              const sub       = parseFloat(item.precio_compra) * parseFloat(item.cantidad);
              const pedida    = parseFloat(item.cantidad) || 0;
              const recibida  = parseFloat(item.cantidad_recibida) || 0;
              const pct       = pedida > 0 ? Math.min(100, (recibida / pedida) * 100) : 0;
              const completo  = recibida >= pedida;
              return (
                <tr key={item.articulo_id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3 font-medium text-kp-white">{item.articulo_nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray">{item.articulo_codigo}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray-lt">{pedida.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-right">
                    {recibida > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className={`tabular-nums text-sm font-semibold ${completo ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {recibida.toLocaleString('es-AR')}
                        </span>
                        <div className="w-16 h-1 rounded-full bg-kp-border overflow-hidden">
                          <div className={`h-full rounded-full ${completo ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-kp-border text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-white">{fmt(item.precio_compra)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">{fmt(sub)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-60 space-y-2 bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span className="text-kp-gray">Mercadería</span>
            <span className="tabular-nums text-kp-white">{fmt(totalMerc)}</span>
          </div>
          {parseFloat(pedido.costo_flete_total || '0') > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-kp-gray">Flete</span>
              <span className="tabular-nums text-kp-gray-lt">{fmt(pedido.costo_flete_total)}</span>
            </div>
          )}
          <div className="border-t border-kp-border pt-2 flex justify-between">
            <span className="font-bold text-kp-white text-sm uppercase tracking-wide">Total</span>
            <span className="font-bold text-kp-white tabular-nums">{fmt(pedido.monto_total)}</span>
          </div>
        </div>
      </div>

    </section>
  );
}
