import Link from 'next/link';
import AccionesPedido from './AccionesPedido';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  recibido_parcial: 'Recibido Parcial',
  recibido:         'Recibido',
  cancelado:        'Cancelado',
};

export const dynamic = 'force-dynamic';

export default async function DetallePedidoPage({ params }: { params: { id: string } }) {
  let pedido: any = null;
  let items: any[] = [];

  try {
    const res = await fetch(`${API}/api/pedidos-compra/${params.id}`, { cache: 'no-store' });
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

  const fecha = new Date(pedido.fecha_pedido).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const fechaRecepcion = pedido.fecha_recepcion
    ? new Date(pedido.fecha_recepcion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

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
          <div className="flex items-center gap-3 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold">{pedido.proveedor_nombre}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[pedido.estado] ?? ''}`}>
              {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
            </span>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            Pedido del {fecha}
            {pedido.sucursal_nombre && <> · {pedido.sucursal_nombre}</>}
            {fechaRecepcion && <> · Recibido: {fechaRecepcion}</>}
          </p>
        </div>
        <AccionesPedido pedido={pedido} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Proveedor',    value: pedido.proveedor_nombre },
          { label: 'CUIT',         value: pedido.proveedor_cuit ?? '—' },
          { label: 'Nº Factura',   value: pedido.numero_factura_prov ?? '—' },
          { label: 'Teléfono',     value: pedido.proveedor_telefono ?? '—' },
        ].map(c => (
          <div key={c.label} className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
            <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">{c.label}</p>
            <p className="text-sm font-medium text-kp-white truncate" title={c.value}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">Artículos del Pedido</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2/50 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Código</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Cantidad</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">P. Compra</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Flete Asign.</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {items.map((item: any) => {
              const sub = parseFloat(item.precio_compra) * parseFloat(item.cantidad);
              return (
                <tr key={item.articulo_id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3 font-medium text-kp-white">{item.articulo_nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray">{item.articulo_codigo}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray-lt">
                    {parseFloat(item.cantidad).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-white">
                    {fmt(item.precio_compra)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray-lt text-xs">
                    {fmt(item.costo_flete_asignado)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {fmt(sub)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span className="text-kp-gray">Mercadería</span>
            <span className="tabular-nums text-kp-white">{fmt(totalMerc)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-kp-gray">Flete</span>
            <span className="tabular-nums text-kp-gray-lt">{fmt(pedido.costo_flete_total)}</span>
          </div>
          <div className="border-t border-kp-border pt-2 flex justify-between">
            <span className="font-bold text-kp-white text-sm uppercase tracking-wide">Total</span>
            <span className="font-bold text-kp-white tabular-nums">{fmt(pedido.monto_total)}</span>
          </div>
        </div>
      </div>

    </section>
  );
}
