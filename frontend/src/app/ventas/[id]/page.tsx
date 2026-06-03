import Link from 'next/link';
import AccionesVenta from './AccionesVenta';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import { KingPackLogoPrint } from '@/components/KingPackLogo';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fechaFmt = (d: string) => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const fechaCorta = (d: string) => new Date(d).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

const ESTADO_STYLE: Record<string, string> = {
  preventa:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmada: 'bg-green-500/10 text-green-400 border-green-500/30',
  facturada:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  anulada:    'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

const ESTADO_LABEL: Record<string, string> = {
  preventa: 'Preventa', confirmada: 'Confirmada', facturada: 'Facturada', anulada: 'Anulada',
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
  const user = requireAuth('/ventas');
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

  // Historial de ediciones (solo para admin/supervisor)
  const esAdmin = user.rol === 'administrador' || user.rol === 'supervisor';
  let ediciones: any[] = [];
  if (esAdmin) {
    try {
      const resEd = await serverFetch(`/api/ventas/${params.id}/ediciones`, { cache: 'no-store' });
      if (resEd.ok) ediciones = (await resEd.json()).ediciones ?? [];
    } catch { /* silencioso */ }
  }

  return (
    <section className="space-y-6 max-w-5xl">

      {/* ── Vista pantalla ────────────────────────────────────────────────── */}
      <div className="print:hidden">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-kp-gray mb-6">
          <Link href="/ventas" className="hover:text-kp-white transition-colors">Ventas</Link>
          <span>/</span>
          <span className="text-kp-white font-medium">#{venta.numero}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
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
          <AccionesVenta ventaId={params.id} estado={venta.estado} total={venta.total} facturacion={facturacion} observaciones={venta.observaciones ?? null} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Columna principal — Items */}
          <div className="lg:col-span-2 space-y-5">
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

            {venta.observaciones && (
              <div className="rounded-xl border border-kp-border p-5 bg-kp-surface">
                <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray mb-2">Observaciones</h3>
                <p className="text-sm text-kp-gray-lt">{venta.observaciones}</p>
              </div>
            )}
          </div>

          {/* Columna lateral */}
          <div className="space-y-4">

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

            <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
              <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border">
                <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Cliente</h3>
              </div>
              <div className="px-5 py-4 space-y-1.5">
                {venta.cliente_nombre ? (
                  <>
                    <Link
                      href={`/clientes/${venta.cliente_id}`}
                      className="group flex items-center gap-1.5 hover:gap-2 transition-all"
                    >
                      <span className="font-semibold text-kp-white text-sm group-hover:text-kp-red transition-colors">
                        {venta.cliente_nombre}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-kp-gray group-hover:text-kp-red transition-colors flex-shrink-0">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </Link>
                    {venta.cliente_cuit && <p className="text-xs text-kp-gray font-mono">{venta.cliente_cuit}</p>}
                    {venta.cliente_cond_iva && <p className="text-xs text-kp-gray-lt">{venta.cliente_cond_iva}</p>}
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

            {pagos.length > 0 && (
              <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
                <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Formas de Pago</h3>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {pagos.map((p: any, i: number) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-kp-gray-lt">{p.medio_pago}</span>
                        <span className="text-kp-white tabular-nums font-medium">{fmt(p.monto)}</span>
                      </div>
                      {Array.isArray(p.cheques) && p.cheques.length > 0 && (
                        <div className="ml-3 space-y-1">
                          {p.cheques.map((ch: any) => (
                            <div key={ch.id} className="flex flex-wrap gap-3 text-xs text-kp-gray bg-kp-surface2 rounded-lg px-3 py-1.5">
                              <span>{ch.banco}</span>
                              <span>Nro: {ch.numero_cheque}</span>
                              {ch.fecha_emision && <span>Emisión: {new Date(ch.fecha_emision).toLocaleDateString('es-AR')}</span>}
                              <span>Vence: {new Date(ch.fecha_vencimiento).toLocaleDateString('es-AR')}</span>
                              <span className="ml-auto tabular-nums text-kp-white font-semibold">{fmt(ch.importe)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
      </div>

      {/* ── Historial de ediciones (solo admins) ─────────────────────────── */}
      {esAdmin && ediciones.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden print:hidden">
          <div className="bg-amber-500/10 px-5 py-3 border-b border-amber-500/30 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-amber-400 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Historial de ediciones ({ediciones.length})
            </h3>
          </div>
          <div className="divide-y divide-amber-500/20">
            {ediciones.map((ed: any) => {
              const fecha = new Date(ed.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              const anteriores: any[] = ed.items_anteriores ?? [];
              const nuevos: any[]    = ed.items_nuevos ?? [];

              // Detectar cambios
              const eliminados = anteriores.filter(a => !nuevos.find(n => n.articulo_id === a.articulo_id));
              const agregados  = nuevos.filter(n => !anteriores.find(a => a.articulo_id === n.articulo_id));
              const modificados = nuevos.filter(n => {
                const ant = anteriores.find(a => a.articulo_id === n.articulo_id);
                return ant && (parseFloat(ant.cantidad) !== parseFloat(n.cantidad) || parseFloat(ant.descuento_pct) !== parseFloat(n.descuento_pct));
              });

              return (
                <div key={ed.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-amber-300">{fecha}</p>
                      <p className="text-xs text-kp-gray mt-0.5">por <span className="text-kp-white">{ed.usuario_nombre ?? 'Usuario desconocido'}</span></p>
                    </div>
                    {ed.observacion && (
                      <span className="text-xs bg-amber-500/15 border border-amber-500/30 text-amber-200 rounded-lg px-3 py-1.5 max-w-xs text-right">
                        "{ed.observacion}"
                      </span>
                    )}
                  </div>

                  {/* Cambios detectados */}
                  <div className="space-y-1.5">
                    {eliminados.map((it: any) => (
                      <div key={it.articulo_id} className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold flex-shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Eliminado
                        </span>
                        <span className="text-kp-gray">{it.nombre}</span>
                        <span className="text-kp-gray font-mono text-[10px]">({it.codigo})</span>
                        <span className="text-kp-gray ml-auto">x{parseFloat(it.cantidad).toFixed(0)} · {fmt(it.precio_unitario_final)}</span>
                      </div>
                    ))}
                    {agregados.map((it: any) => (
                      <div key={it.articulo_id} className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold flex-shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Agregado
                        </span>
                        <span className="text-kp-gray">{it.nombre}</span>
                        <span className="text-kp-gray font-mono text-[10px]">({it.codigo})</span>
                        <span className="text-kp-gray ml-auto">x{parseFloat(it.cantidad).toFixed(0)} · {fmt(it.precio_unitario_final)}</span>
                      </div>
                    ))}
                    {modificados.map((it: any) => {
                      const ant = anteriores.find(a => a.articulo_id === it.articulo_id);
                      return (
                        <div key={it.articulo_id} className="flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-bold flex-shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Modificado
                          </span>
                          <span className="text-kp-gray">{it.nombre}</span>
                          {ant && parseFloat(ant.cantidad) !== parseFloat(it.cantidad) && (
                            <span className="text-kp-gray">cant: <span className="line-through text-rose-400/70">{parseFloat(ant.cantidad).toFixed(0)}</span> → <span className="text-emerald-400">{parseFloat(it.cantidad).toFixed(0)}</span></span>
                          )}
                          {ant && parseFloat(ant.descuento_pct) !== parseFloat(it.descuento_pct) && (
                            <span className="text-kp-gray">desc: <span className="line-through text-rose-400/70">{parseFloat(ant.descuento_pct).toFixed(1)}%</span> → <span className="text-emerald-400">{parseFloat(it.descuento_pct).toFixed(1)}%</span></span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Estilos de control de modo de impresión ──────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .print-layout-venta    { display: block !important; }
          .print-layout-factura  { display: none  !important; }
        }
        @media print {
          body.print-factura .print-layout-venta   { display: none  !important; }
          body.print-factura .print-layout-factura { display: block !important; }
        }
      `}</style>

      {/* ── Layout de impresión VENTA ─────────────────────────────────────── */}
      <div className="print-layout-venta hidden print:block" style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: 'white' }}>

        {/* Encabezado del documento */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <KingPackLogoPrint />
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '1px' }}>VENTA #{venta.numero}</p>
            <div style={{ display: 'inline-block', marginTop: '4px', padding: '2px 10px', border: '1px solid #d1d5db', borderRadius: '20px', fontSize: '11px', fontWeight: '600', color: '#374151' }}>
              {ESTADO_LABEL[venta.estado] ?? venta.estado}
            </div>
          </div>
        </div>

        {/* Fila de metadatos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px' }}>
          <div>
            <p style={{ color: '#6b7280', marginBottom: '2px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fecha</p>
            <p style={{ fontWeight: '600' }}>{fechaFmt(venta.fecha)}</p>
          </div>
          <div>
            <p style={{ color: '#6b7280', marginBottom: '2px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cliente</p>
            <p style={{ fontWeight: '600' }}>{venta.cliente_nombre ?? 'Consumidor Final'}</p>
            {venta.cliente_cuit && <p style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '11px' }}>{venta.cliente_cuit}</p>}
          </div>
          <div>
            <p style={{ color: '#6b7280', marginBottom: '2px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sucursal / Lista</p>
            <p style={{ fontWeight: '600' }}>{venta.sucursal_nombre ?? '—'}</p>
            {venta.lista_precio && <p style={{ color: '#6b7280', fontSize: '11px' }}>{venta.lista_precio}</p>}
          </div>
        </div>

        {/* Tabla de artículos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ background: '#111', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>Artículo</th>
              <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>Código</th>
              <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>Cant.</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>P. Lista</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>Desc.</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>P. Final</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: '700', letterSpacing: '0.5px', fontSize: '10px', textTransform: 'uppercase' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => {
              const tieneDesc = parseFloat(item.descuento_pct || '0') > 0;
              const subtotalItem = parseFloat(item.precio_unitario_final) * parseFloat(item.cantidad);
              return (
                <tr key={item.articulo_id} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '8px 10px', fontWeight: '600' }}>{item.nombre}</td>
                  <td style={{ padding: '8px 6px', fontFamily: 'monospace', color: '#6b7280', fontSize: '11px' }}>{item.codigo}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(item.cantidad).toFixed(0)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tieneDesc ? '#9ca3af' : '#111', textDecoration: tieneDesc ? 'line-through' : 'none' }}>
                    {fmt(item.precio_lista)}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: tieneDesc ? '600' : 'normal', color: tieneDesc ? '#dc2626' : '#9ca3af' }}>
                    {tieneDesc ? `${parseFloat(item.descuento_pct).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.precio_unitario_final)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>{fmt(subtotalItem)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Fila inferior: Pagos + Totales + ARCA */}
        <div style={{ display: 'grid', gridTemplateColumns: facturacion ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>

          {/* Formas de pago */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#f3f4f6', padding: '6px 12px', borderBottom: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151' }}>Formas de Pago</p>
            </div>
            <div style={{ padding: '10px 12px', fontSize: '12px' }}>
              {pagos.length > 0 ? pagos.map((p: any, i: number) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#374151' }}>{p.medio_pago}</span>
                    <span style={{ fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.monto)}</span>
                  </div>
                  {Array.isArray(p.cheques) && p.cheques.map((ch: any) => (
                    <div key={ch.id} style={{ fontSize: '10px', color: '#6b7280', paddingLeft: '8px', marginBottom: '2px' }}>
                      {ch.banco} · Nro {ch.numero_cheque} · Vence {new Date(ch.fecha_vencimiento).toLocaleDateString('es-AR')} · <strong>{fmt(ch.importe)}</strong>
                    </div>
                  ))}
                </div>
              )) : <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin registrar</p>}
            </div>
          </div>

          {/* Totales */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#f3f4f6', padding: '6px 12px', borderBottom: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151' }}>Resumen</p>
            </div>
            <div style={{ padding: '10px 12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#6b7280' }}>Subtotal</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(venta.subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#6b7280' }}>Descuento</span>
                  <span style={{ color: '#dc2626', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>−{fmt(descuento)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ fontWeight: '800', fontSize: '14px' }}>TOTAL</span>
                <span style={{ fontWeight: '800', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>{fmt(venta.total)}</span>
              </div>
            </div>
          </div>

          {/* Factura ARCA */}
          {facturacion && (
            <div style={{ border: '1px solid #bfdbfe', borderRadius: '6px', overflow: 'hidden', background: '#eff6ff' }}>
              <div style={{ background: '#dbeafe', padding: '6px 12px', borderBottom: '1px solid #bfdbfe' }}>
                <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e40af' }}>Factura ARCA</p>
              </div>
              <div style={{ padding: '10px 12px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#374151' }}>Tipo</span>
                  <span style={{ fontWeight: '600', color: '#1d4ed8' }}>{facturacion.tipo_comprobante}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#374151' }}>Número</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {String(facturacion.punto_venta).padStart(4,'0')}-{String(facturacion.factura_numero).padStart(8,'0')}
                  </span>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <p style={{ color: '#374151', marginBottom: '2px' }}>CAE</p>
                  <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#1d4ed8', wordBreak: 'break-all' }}>{facturacion.cae}</p>
                </div>
                {facturacion.cae_vencimiento && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#6b7280' }}>Vencimiento CAE</span>
                    <span>{fechaCorta(facturacion.cae_vencimiento)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Observaciones */}
        {venta.observaciones && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', marginBottom: '4px' }}>Observaciones</p>
            <p style={{ color: '#374151' }}>{venta.observaciones}</p>
          </div>
        )}

        {/* Pie del documento */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af' }}>
          <span>KING PACK DESCARTABLES · Sistema de Gestión</span>
          <span>Documento generado el {new Date().toLocaleDateString('es-AR')}</span>
        </div>

      </div>

      {/* ── Layout de impresión FACTURA FISCAL ───────────────────────────────── */}
      {facturacion && (
        <div className="print-layout-factura hidden" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', color: '#111', background: 'white', width: '100%', boxSizing: 'border-box' }}>

          {/* ══ ENCABEZADO FISCAL — 3 columnas ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', border: '2px solid #111', marginBottom: '10px' }}>

            {/* Emisor */}
            <div style={{ padding: '10px 12px', borderRight: '2px solid #111' }}>
              <div style={{ marginBottom: '6px' }}>
                <KingPackLogoPrint />
              </div>
              <p style={{ fontSize: '11px', marginBottom: '2px', marginLeft: '9px' }}>
                <strong>CUIT:</strong> 30-71792696-6
              </p>
              <p style={{ fontSize: '11px', marginBottom: '2px', marginLeft: '9px' }}>
                <strong>Cond. IVA:</strong> Responsable Inscripto
              </p>
              {venta.sucursal_direccion && (
                <p style={{ fontSize: '11px', marginBottom: '2px', marginLeft: '9px' }}>
                  <strong>Domicilio:</strong> {venta.sucursal_direccion}
                </p>
              )}
              {venta.sucursal_telefono && (
                <p style={{ fontSize: '11px', marginBottom: '2px', marginLeft: '9px' }}>
                  <strong>Tel:</strong> {venta.sucursal_telefono}
                </p>
              )}
              <p style={{ fontSize: '11px', marginLeft: '9px' }}>
                <strong>Sucursal:</strong> {venta.sucursal_nombre}
              </p>
            </div>

            {/* Letra del comprobante */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid #111', padding: '8px 4px', gap: '4px' }}>
              <div style={{ width: '64px', height: '64px', border: '3px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                <span style={{ fontSize: '48px', fontWeight: '900', lineHeight: 1 }}>
                  {facturacion.tipo_comprobante?.split(' ').pop() ?? ''}
                </span>
              </div>
              <span style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151', textAlign: 'center', lineHeight: 1.2 }}>
                {facturacion.tipo_comprobante}
              </span>
            </div>

            {/* Datos del comprobante */}
            <div style={{ padding: '10px 12px' }}>
              <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', marginBottom: '6px' }}>
                Datos del Comprobante
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: '3px', width: '45%' }}>N° Comprobante</td>
                    <td style={{ fontWeight: '700', fontFamily: 'monospace', paddingBottom: '3px', fontSize: '12px' }}>
                      {String(facturacion.punto_venta).padStart(4, '0')}-{String(facturacion.factura_numero).padStart(8, '0')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: '3px' }}>Fecha Emisión</td>
                    <td style={{ fontWeight: '600', paddingBottom: '3px' }}>
                      {fechaCorta(facturacion.fecha_emision ?? facturacion.cae_vencimiento ?? venta.fecha)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280', paddingBottom: '3px' }}>Tipo</td>
                    <td style={{ fontWeight: '600', paddingBottom: '3px' }}>{facturacion.tipo_comprobante}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#6b7280' }}>Punto de Venta</td>
                    <td style={{ fontFamily: 'monospace' }}>{String(facturacion.punto_venta).padStart(4, '0')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ RECEPTOR ══ */}
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px 12px', marginBottom: '10px', background: '#f9fafb' }}>
            <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', marginBottom: '6px' }}>
              Datos del Receptor
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '11px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ color: '#6b7280', flexShrink: 0 }}>Razón Social:</span>
                <span style={{ fontWeight: '700' }}>{venta.cliente_nombre ?? 'Consumidor Final'}</span>
              </div>
              {venta.cliente_cuit && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>CUIT:</span>
                  <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{venta.cliente_cuit}</span>
                </div>
              )}
              {venta.cliente_cond_iva && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>Cond. IVA:</span>
                  <span style={{ fontWeight: '600' }}>{venta.cliente_cond_iva}</span>
                </div>
              )}
              {venta.cliente_direccion && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>Domicilio:</span>
                  <span>{venta.cliente_direccion}</span>
                </div>
              )}
              {venta.cliente_telefono && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>Teléfono:</span>
                  <span>{venta.cliente_telefono}</span>
                </div>
              )}
            </div>
          </div>

          {/* ══ TABLA DE ARTÍCULOS ══ */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '10px' }}>
            <thead>
              <tr style={{ background: '#111', color: 'white' }}>
                <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Código</th>
                <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Descripción</th>
                <th style={{ textAlign: 'center', padding: '7px 6px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '40px' }}>Cant.</th>
                <th style={{ textAlign: 'right', padding: '7px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px' }}>P. Unitario</th>
                <th style={{ textAlign: 'right', padding: '7px 6px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '50px' }}>% Desc.</th>
                <th style={{ textAlign: 'right', padding: '7px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px' }}>P. Final</th>
                <th style={{ textAlign: 'right', padding: '7px 8px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => {
                const tieneDesc = parseFloat(item.descuento_pct || '0') > 0;
                const subtotalItem = parseFloat(item.precio_unitario_final) * parseFloat(item.cantidad);
                return (
                  <tr key={item.articulo_id ?? i} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '10px', color: '#6b7280' }}>{item.codigo}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600' }}>{item.nombre}</td>
                    <td style={{ padding: '6px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {parseFloat(item.cantidad).toFixed(0)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tieneDesc ? '#9ca3af' : '#111', textDecoration: tieneDesc ? 'line-through' : 'none' }}>
                      {fmt(item.precio_lista)}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: tieneDesc ? '700' : '400', color: tieneDesc ? '#dc2626' : '#9ca3af' }}>
                      {tieneDesc ? `${parseFloat(item.descuento_pct).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.precio_unitario_final)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>{fmt(subtotalItem)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ══ FILA INFERIOR — Pagos | Totales ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px', marginBottom: '10px' }}>

            {/* Formas de pago */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: '#f3f4f6', padding: '5px 10px', borderBottom: '1px solid #d1d5db' }}>
                <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#374151' }}>Formas de Pago</p>
              </div>
              <div style={{ padding: '8px 10px', fontSize: '11px' }}>
                {pagos.length > 0 ? pagos.map((p: any, i: number) => (
                  <div key={i} style={{ marginBottom: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#374151' }}>{p.medio_pago}</span>
                      <span style={{ fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.monto)}</span>
                    </div>
                    {Array.isArray(p.cheques) && p.cheques.map((ch: any) => (
                      <div key={ch.id} style={{ fontSize: '9px', color: '#6b7280', paddingLeft: '8px', marginTop: '2px', lineHeight: 1.4 }}>
                        {ch.banco} · N° {ch.numero_cheque}
                        {ch.fecha_emision && ` · Emis. ${new Date(ch.fecha_emision).toLocaleDateString('es-AR')}`}
                        {` · Vence ${new Date(ch.fecha_vencimiento).toLocaleDateString('es-AR')} · `}
                        <strong style={{ color: '#111' }}>{fmt(ch.importe)}</strong>
                      </div>
                    ))}
                  </div>
                )) : (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin registrar</p>
                )}
              </div>
            </div>

            {/* Totales */}
            <div style={{ border: '2px solid #111', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: '#f3f4f6', padding: '5px 10px', borderBottom: '1px solid #d1d5db' }}>
                <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#374151' }}>Resumen</p>
              </div>
              <div style={{ padding: '8px 10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(venta.subtotal)}</span>
                </div>
                {descuento > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#6b7280' }}>Descuento</span>
                    <span style={{ color: '#dc2626', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>−{fmt(descuento)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111', paddingTop: '6px', marginTop: '4px' }}>
                  <span style={{ fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Imp.</span>
                  <span style={{ fontWeight: '900', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{fmt(venta.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ PIE FISCAL — CAE ══ */}
          <div style={{ border: '2px solid #111', borderRadius: '4px', padding: '10px 14px', background: '#f9fafb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', marginBottom: '4px' }}>
                  Código de Autorización Electrónica (CAE)
                </p>
                <p style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: '900', letterSpacing: '2px', color: '#111', marginBottom: '4px' }}>
                  {facturacion.cae}
                </p>
                {facturacion.cae_vencimiento && (
                  <p style={{ fontSize: '11px', color: '#374151' }}>
                    <strong>Vencimiento CAE:</strong> {fechaCorta(facturacion.cae_vencimiento)}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '9px', color: '#6b7280', lineHeight: 1.5, maxWidth: '200px' }}>
                  Este comprobante es válido ante<br />
                  <strong style={{ color: '#111' }}>ARCA (ex-AFIP)</strong>
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

    </section>
  );
}
