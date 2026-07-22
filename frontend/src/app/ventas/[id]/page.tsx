import Link from 'next/link';
import AccionesVenta from './AccionesVenta';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import FacturaQR from './FacturaQR';
import { KingPackLogoPrint } from '@/components/KingPackLogo';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fechaFmt = (d: string) => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// El "precio de lista" que se muestra es el precio MADRE CONGELADO al momento de la
// venta (el backend lo trae con COALESCE al madre vivo para ventas viejas). El
// descuento se calcula respecto a ese madre para que el descuento de la lista quede
// VISIBLE (base madre → desc% → precio final). Usar el madre congelado (y no el
// vivo) evita que el descuento cambie si el precio del artículo se actualiza después.
function desglosePrecio(item: any) {
  const madre = parseFloat(String(item.precio_madre ?? item.precio_lista ?? '0')) || 0;
  const final = parseFloat(String(item.precio_unitario_final ?? '0')) || 0;
  const base  = madre >= final ? madre : parseFloat(String(item.precio_lista ?? madre)) || madre;
  const descPct = base > 0 ? (1 - final / base) * 100 : 0;
  return { base, final, descPct, tieneDesc: descPct > 0.05 };
}
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
  // Subtotal y descuento calculados sobre el precio madre congelado de cada ítem
  // (para que el descuento sea visible y coincida con las columnas P. Lista/Desc.).
  // El total (lo efectivamente cobrado) no cambia: sigue siendo venta.total.
  const totalVenta   = parseFloat(venta.total || '0');
  const subtotalBase = items.reduce(
    (acc: number, it: any) => acc + desglosePrecio(it).base * parseFloat(it.cantidad || '0'), 0);
  // Descuento extra (renglón propio de la venta) y descuento por lista/ítem (el resto).
  const descExtraMonto = parseFloat(venta.descuento_extra_monto || '0') || 0;
  const descExtraPct   = parseFloat(venta.descuento_extra_pct || '0') || 0;
  const descuento      = Math.max(0, subtotalBase - totalVenta - descExtraMonto);
  const descExtraLabel = descExtraPct > 0
    ? `Descuento extra ${descExtraPct.toFixed(2).replace(/\.?0+$/, '')}%`
    : 'Descuento extra';

  // Discriminación de IVA para la factura fiscal. precio_unitario_final YA incluye
  // IVA y descuento; el IVA se calcula sobre el neto ya descontado, agrupado por
  // alícuota (neto = total_grupo / (1 + alíc); IVA = total_grupo − neto).
  const letraFactura = facturacion?.tipo_comprobante?.split(' ').pop() ?? '';
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const ivaPorAlic: Record<string, number> = {};
  for (const it of items) {
    const alic = parseFloat(it.alicuota) || 21;
    ivaPorAlic[alic] = (ivaPorAlic[alic] || 0) + parseFloat(it.precio_unitario_final || '0') * parseFloat(it.cantidad || '0');
  }
  const discrimIva = Object.entries(ivaPorAlic).map(([alic, incl]) => {
    const a = parseFloat(alic);
    const neto = r2(incl / (1 + a / 100));
    return { alic: a, neto, iva: r2(incl - neto) };
  }).sort((x, y) => x.alic - y.alic);
  const netoGravado  = r2(discrimIva.reduce((s, d) => s + d.neto, 0));
  const ivaContenido = r2(discrimIva.reduce((s, d) => s + d.iva, 0));

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
                    const { base, descPct, tieneDesc } = desglosePrecio(item);
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
                            ? <span className="line-through text-kp-gray">{fmt(base)}</span>
                            : <span className="text-kp-gray">{fmt(base)}</span>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs">
                          {tieneDesc
                            ? <span className="text-kp-red font-semibold">{descPct.toFixed(1)}%</span>
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
                  <span className="text-kp-white tabular-nums">{fmt(subtotalBase)}</span>
                </div>
                {descuento > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">Descuento</span>
                    <span className="text-kp-red tabular-nums font-semibold">−{fmt(descuento)}</span>
                  </div>
                )}
                {descExtraMonto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">{descExtraLabel}</span>
                    <span className="text-kp-red tabular-nums font-semibold">−{fmt(descExtraMonto)}</span>
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
          @page { size: A4 portrait; margin: 0; }
          @page facturaPage { size: A4 portrait; margin: 0; }
          .print-layout-venta    { display: block !important; padding: 8mm; box-sizing: border-box; }
          .print-layout-factura  { display: none  !important; }
        }
        @media print {
          body.print-factura .print-layout-venta   { display: none  !important; }
          body.print-factura .print-layout-factura { display: block !important; padding: 8mm; box-sizing: border-box; page: facturaPage; }
        }
      `}</style>

      {/* ── Layout de impresión REMITO (mitad hoja A4) ─────────────────────── */}
      <div className="print-layout-venta hidden print:block" style={{ fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#111', background: 'white' }}>

        {/* Encabezado: número + badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111', paddingBottom: '4px', marginBottom: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.3px' }}>
            REMITO <span style={{ fontSize: '9px' }}>N° {venta.numero}</span>
          </div>
          <div style={{ background: '#111', color: 'white', padding: '2px 8px', fontSize: '7px', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            No válido como comprobante fiscal
          </div>
        </div>

        {/* 2 columnas: Emisor | Cliente */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '2px solid #111', marginBottom: '5px' }}>
          <div style={{ borderRight: '2px solid #111', padding: '4px 6px' }}>
            <div style={{ marginBottom: '2px' }}><KingPackLogoPrint height={18} /></div>
            <p style={{ fontSize: '8px', fontWeight: '800', marginBottom: '1px' }}>DISTRIBUIDORA KING PACK S.A.S.</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>CUIT:</strong> 30-71792696-6</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>IIBB:</strong> 30-71792696-6</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Inicio Act.:</strong> 06/01/2010</p>
            <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Cond. IVA:</strong> Responsable Inscripto</p>
            {venta.sucursal_nombre && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Sucursal:</strong> {venta.sucursal_nombre}</p>}
            {venta.sucursal_direccion && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Dom.:</strong> {venta.sucursal_direccion}</p>}
            <p style={{ fontSize: '7.5px' }}><strong>Fecha:</strong> {fechaFmt(venta.fecha)}</p>
          </div>
          <div style={{ padding: '4px 6px' }}>
            <p style={{ fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>Cliente</p>
            <p style={{ fontSize: '8.5px', fontWeight: '800', marginBottom: '1px' }}>{venta.cliente_nombre ?? 'Consumidor Final'}</p>
            {venta.cliente_cuit && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>CUIT:</strong> {venta.cliente_cuit}</p>}
            {venta.cliente_cond_iva && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Cond. IVA:</strong> {venta.cliente_cond_iva}</p>}
            {venta.cliente_direccion && <p style={{ fontSize: '7.5px' }}><strong>Dom.:</strong> {venta.cliente_direccion}</p>}
          </div>
        </div>

        {/* Tabla de artículos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '5px', border: '1.5px solid #111' }}>
          <thead>
            <tr style={{ background: '#111', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', borderRight: '1px solid #555' }}>Artículo</th>
              <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '32px', borderRight: '1px solid #555' }}>Cant.</th>
              <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '72px', borderRight: '1px solid #555' }}>P. Lista</th>
              <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '38px', borderRight: '1px solid #555' }}>Desc.</th>
              <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '72px', borderRight: '1px solid #555' }}>P. Final</th>
              <th style={{ textAlign: 'right', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '72px' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => {
              const { base, descPct, tieneDesc } = desglosePrecio(item);
              const subtotalItem = parseFloat(item.precio_unitario_final) * parseFloat(item.cantidad);
              return (
                <tr key={item.articulo_id} style={{ borderBottom: '1px solid #bbb', background: i % 2 === 0 ? 'white' : '#f4f4f4' }}>
                  <td style={{ padding: '2px 5px', fontWeight: '600', borderRight: '1px solid #ccc' }}>{item.nombre}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{parseFloat(item.cantidad).toFixed(0)}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{fmt(base)}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tieneDesc ? '#dc2626' : '#999', borderRight: '1px solid #ccc' }}>
                    {tieneDesc ? `${descPct.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{fmt(item.precio_unitario_final)}</td>
                  <td style={{ padding: '2px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>{fmt(subtotalItem)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pie: pagos + observaciones + total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end' }}>
          <div style={{ fontSize: '8px' }}>
            {pagos.length > 0 && (
              <>
                <p style={{ fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', color: '#555', marginBottom: '2px' }}>Formas de Pago</p>
                {pagos.map((p: any, i: number) => (
                  <div key={i}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1px' }}>
                      <span>{p.medio_pago}</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.monto)}</strong>
                    </div>
                    {Array.isArray(p.cheques) && p.cheques.map((ch: any) => (
                      <div key={ch.id} style={{ fontSize: '7px', color: '#555', paddingLeft: '6px' }}>
                        {ch.banco} · N° {ch.numero_cheque} · Vence {new Date(ch.fecha_vencimiento).toLocaleDateString('es-AR')} · <strong>{fmt(ch.importe)}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
            {venta.observaciones && (
              <p style={{ marginTop: '3px', color: '#444' }}><strong>Obs:</strong> {venta.observaciones}</p>
            )}
          </div>
          <div style={{ border: '2px solid #111', padding: '4px 8px', textAlign: 'right', minWidth: '115px' }}>
            {(descuento > 0 || descExtraMonto > 0) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#555', marginBottom: '1px' }}>
                  <span>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotalBase)}</span>
                </div>
                {descuento > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#dc2626', marginBottom: '2px' }}>
                    <span>Descuento</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(descuento)}</span>
                  </div>
                )}
                {descExtraMonto > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#dc2626', marginBottom: '2px' }}>
                    <span>{descExtraLabel}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(descExtraMonto)}</span>
                  </div>
                )}
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', fontWeight: '900', borderTop: (descuento > 0 || descExtraMonto > 0) ? '2px solid #111' : undefined, paddingTop: (descuento > 0 || descExtraMonto > 0) ? '3px' : undefined }}>
              <span>TOTAL</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(venta.total)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Layout de impresión FACTURA FISCAL (mitad hoja A4) ─────────────── */}
      {facturacion && (
        <div className="print-layout-factura hidden" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8px', color: '#111', background: 'white', width: '100%', boxSizing: 'border-box' }}>

          {/* ══ ENCABEZADO FISCAL — 3 columnas ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 1fr', border: '2px solid #111', marginBottom: '4px' }}>

            {/* Emisor */}
            <div style={{ padding: '4px 6px', borderRight: '2px solid #111' }}>
              <div style={{ marginBottom: '2px' }}><KingPackLogoPrint height={18} /></div>
              <p style={{ fontSize: '8px', fontWeight: '800', marginBottom: '1px' }}>DISTRIBUIDORA KING PACK S.A.S.</p>
              <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>CUIT:</strong> 30-71792696-6</p>
              <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>IIBB:</strong> 30-71792696-6</p>
              <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Inicio Act.:</strong> 06/01/2010</p>
              <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Cond. IVA:</strong> Responsable Inscripto</p>
              {venta.sucursal_direccion && <p style={{ fontSize: '7.5px', marginBottom: '1px' }}><strong>Dom.:</strong> {venta.sucursal_direccion}</p>}
              {venta.sucursal_telefono && <p style={{ fontSize: '7.5px' }}><strong>Tel:</strong> {venta.sucursal_telefono}</p>}
            </div>

            {/* Letra */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid #111', padding: '5px 3px', gap: '3px' }}>
              <div style={{ width: '44px', height: '44px', border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '36px', fontWeight: '900', lineHeight: 1 }}>
                  {facturacion.tipo_comprobante?.split(' ').pop() ?? ''}
                </span>
              </div>
              <span style={{ fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>
                {facturacion.tipo_comprobante}
              </span>
            </div>

            {/* Datos comprobante */}
            <div style={{ padding: '4px 6px' }}>
              <p style={{ fontSize: '7px', fontWeight: '800', textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>Datos del Comprobante</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#555', paddingBottom: '2px', width: '40%' }}>N°</td>
                    <td style={{ fontWeight: '700', fontFamily: 'monospace', fontSize: '9px', paddingBottom: '2px' }}>
                      {String(facturacion.punto_venta).padStart(4, '0')}-{String(facturacion.factura_numero).padStart(8, '0')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ color: '#555', paddingBottom: '2px' }}>Fecha</td>
                    <td style={{ fontWeight: '600', paddingBottom: '2px' }}>{fechaCorta(facturacion.fecha_emision ?? facturacion.cae_vencimiento ?? venta.fecha)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#555', paddingBottom: '2px' }}>Tipo</td>
                    <td style={{ fontWeight: '600', paddingBottom: '2px' }}>{facturacion.tipo_comprobante}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#555' }}>P. Venta</td>
                    <td style={{ fontFamily: 'monospace' }}>{String(facturacion.punto_venta).padStart(4, '0')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ RECEPTOR ══ */}
          <div style={{ border: '1.5px solid #111', padding: '3px 8px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: '8px' }}>
              <span><strong>Razón Social:</strong> {venta.cliente_nombre ?? 'Consumidor Final'}</span>
              {venta.cliente_cuit && <span><strong>CUIT:</strong> {venta.cliente_cuit}</span>}
              {venta.cliente_cond_iva && <span><strong>IVA:</strong> {venta.cliente_cond_iva}</span>}
              {venta.cliente_direccion && <span><strong>Dom.:</strong> {venta.cliente_direccion}</span>}
            </div>
          </div>

          {/* ══ TABLA ══ */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginBottom: '4px', border: '1.5px solid #111' }}>
            <thead>
              <tr style={{ background: '#111', color: 'white' }}>
                <th style={{ textAlign: 'left', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', borderRight: '1px solid #555' }}>Descripción</th>
                <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '32px', borderRight: '1px solid #555' }}>Cant.</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '72px', borderRight: '1px solid #555' }}>P. Unitario</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '38px', borderRight: '1px solid #555' }}>Desc.</th>
                <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '72px', borderRight: '1px solid #555' }}>P. Final</th>
                <th style={{ textAlign: 'right', padding: '3px 5px', fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', width: '72px' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => {
                const { base, descPct, tieneDesc } = desglosePrecio(item);
                const subtotalItem = parseFloat(item.precio_unitario_final) * parseFloat(item.cantidad);
                return (
                  <tr key={item.articulo_id ?? i} style={{ borderBottom: '1px solid #bbb', background: i % 2 === 0 ? 'white' : '#f4f4f4' }}>
                    <td style={{ padding: '2px 5px', fontWeight: '600', borderRight: '1px solid #ccc' }}>{item.nombre}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{parseFloat(item.cantidad).toFixed(0)}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{fmt(base)}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tieneDesc ? '#dc2626' : '#999', borderRight: '1px solid #ccc' }}>
                      {tieneDesc ? `${descPct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '2px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #ccc' }}>{fmt(item.precio_unitario_final)}</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>{fmt(subtotalItem)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ══ PIE — Pagos | CAE+QR | Total ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'end' }}>

            {/* Pagos */}
            <div style={{ fontSize: '8px' }}>
              <p style={{ fontSize: '7px', fontWeight: '700', textTransform: 'uppercase', color: '#555', marginBottom: '2px' }}>Formas de Pago</p>
              {pagos.length > 0 ? pagos.map((p: any, i: number) => (
                <div key={i} style={{ marginBottom: '1px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span>{p.medio_pago}</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.monto)}</strong>
                  </div>
                  {Array.isArray(p.cheques) && p.cheques.map((ch: any) => (
                    <div key={ch.id} style={{ fontSize: '7px', color: '#555', paddingLeft: '6px' }}>
                      {ch.banco} · N° {ch.numero_cheque} · Vence {new Date(ch.fecha_vencimiento).toLocaleDateString('es-AR')} · <strong>{fmt(ch.importe)}</strong>
                    </div>
                  ))}
                </div>
              )) : <span style={{ color: '#999', fontStyle: 'italic' }}>Sin registrar</span>}
            </div>

            {/* CAE + QR */}
            <div style={{ border: '1.5px solid #111', padding: '4px 6px', fontSize: '7.5px', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {facturacion.qr_url && <FacturaQR url={facturacion.qr_url} size={46} />}
              <div>
                <p style={{ fontSize: '6.5px', fontWeight: '700', textTransform: 'uppercase', color: '#555', marginBottom: '1px' }}>CAE</p>
                <p style={{ fontFamily: 'monospace', fontSize: '8px', fontWeight: '800', letterSpacing: '0.3px' }}>{facturacion.cae}</p>
                {facturacion.cae_vencimiento && <p style={{ fontSize: '7px', color: '#374151', marginTop: '1px' }}>Vto: {fechaCorta(facturacion.cae_vencimiento)}</p>}
                <p style={{ fontSize: '6px', color: '#777', marginTop: '2px' }}>Válido ante ARCA (ex-AFIP)</p>
              </div>
            </div>

            {/* Total */}
            <div style={{ border: '2px solid #111', padding: '4px 8px', textAlign: 'right', minWidth: '150px' }}>
              {(descuento > 0 || descExtraMonto > 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#555', marginBottom: '1px' }}>
                    <span>Subtotal</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotalBase)}</span>
                  </div>
                  {descuento > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#dc2626', marginBottom: '2px' }}>
                      <span>Descuento</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(descuento)}</span>
                    </div>
                  )}
                  {descExtraMonto > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#dc2626', marginBottom: '2px' }}>
                      <span>{descExtraLabel}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>−{fmt(descExtraMonto)}</span>
                    </div>
                  )}
                </>
              )}
              {/* Factura A: discriminación de IVA (neto gravado + IVA por alícuota) */}
              {letraFactura === 'A' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#555', marginBottom: '1px' }}>
                    <span>Neto gravado</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(netoGravado)}</span>
                  </div>
                  {discrimIva.map(d => (
                    <div key={d.alic} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '7.5px', color: '#555', marginBottom: '1px' }}>
                      <span>IVA {String(d.alic).replace('.', ',')}%</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(d.iva)}</span>
                    </div>
                  ))}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', fontWeight: '900', borderTop: (descuento > 0 || descExtraMonto > 0 || letraFactura === 'A') ? '2px solid #111' : undefined, paddingTop: (descuento > 0 || descExtraMonto > 0 || letraFactura === 'A') ? '3px' : undefined }}>
                <span>TOTAL</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(venta.total)}</span>
              </div>
            </div>
          </div>

          {/* Factura B — Régimen de Transparencia Fiscal al Consumidor (Ley 27.743) */}
          {letraFactura === 'B' && (
            <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px solid #bbb', fontSize: '7px', color: '#374151' }}>
              <strong>IVA contenido: {fmt(ivaContenido)}</strong>
              {' — '}Régimen de Transparencia Fiscal al Consumidor, Ley 27.743
            </div>
          )}

        </div>
      )}

    </section>
  );
}
