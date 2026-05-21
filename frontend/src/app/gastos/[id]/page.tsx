import Link from 'next/link';
import RegistrarPago from './RegistrarPago';

const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ─── Etiquetas y estilos ──────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  compra_mercaderia:    'Compra Mercadería',
  compra_gasto:         'Compra Gasto',
  carga_social_laboral: 'Carga Social',
  gasto_manual:         'Gasto Manual',
  inversion_bien_uso:   'Inversión / Bien de Uso',
  anticipo_proveedor:   'Anticipo Proveedor',
};
const TIPO_COLOR: Record<string, string> = {
  compra_mercaderia:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  compra_gasto:         'bg-purple-500/10 text-purple-400 border-purple-500/30',
  carga_social_laboral: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  gasto_manual:         'bg-kp-border/30 text-kp-gray border-kp-border/50',
  inversion_bien_uso:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  anticipo_proveedor:   'bg-green-500/10 text-green-400 border-green-500/30',
};
const PAGO_STYLE: Record<string, string> = {
  pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  parcial:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  pagado:    'bg-green-500/10 text-green-400 border-green-500/30',
};
const PAGO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial:   'Pago Parcial',
  pagado:    'Pagado',
};
const COMP_LABEL: Record<string, string> = {
  factura_a:       'Factura A',    factura_b:       'Factura B',    factura_c:       'Factura C',
  nota_debito_a:   'ND A',         nota_debito_b:   'ND B',         nota_debito_c:   'ND C',
  nota_credito_a:  'NC A',         nota_credito_b:  'NC B',         nota_credito_c:  'NC C',
  informal:        'Comprobante Informal',
};

const TIPOS_CON_COMPROBANTE = ['compra_mercaderia', 'compra_gasto', 'inversion_bien_uso'];
const TIPOS_CON_ITEMS       = ['compra_mercaderia', 'compra_gasto'];

// ─── Utilidad section card ─────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-kp-border overflow-hidden">
      <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">{title}</h3>
      </div>
      <div className="bg-kp-surface p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-kp-gray uppercase tracking-wide font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-kp-white">{value ?? '—'}</p>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function DetalleEgresoPage({ params }: { params: { id: string } }) {
  let egreso: any = null;
  let items: any[]  = [];
  let pagos: any[]  = [];
  let pedido: any   = null;
  let mediosPago: any[] = [];
  let cuentasBancarias: any[] = [];
  let movimientosCC: any[] = [];
  let totalesCC: any = null;

  try {
    const res = await fetch(`${API}/api/egresos/${params.id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      egreso = data.egreso;
      items  = data.items  ?? [];
      pagos  = data.pagos  ?? [];
      pedido = data.pedido ?? null;
    }
  } catch { /* handled below */ }

  if (!egreso) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Egreso no encontrado.</p>
        <Link href="/gastos" className="text-kp-red hover:underline text-sm">← Volver a Gastos</Link>
      </section>
    );
  }

  // Fetch paralelo de datos auxiliares
  const promises: Promise<void>[] = [];

  promises.push(
    fetch(`${API}/api/ventas/medios-pago`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { medios: [] })
      .then(d => { mediosPago = d.medios ?? []; })
      .catch(() => {})
  );

  promises.push(
    fetch(`${API}/api/cuentas-bancarias?activo=true`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { cuentas: [] })
      .then(d => { cuentasBancarias = d.cuentas ?? []; })
      .catch(() => {})
  );

  if (egreso.proveedor_id) {
    promises.push(
      fetch(`${API}/api/proveedores/${egreso.proveedor_id}/cuenta-corriente?limit=8`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : {})
        .then((d: any) => {
          movimientosCC = d.movimientos ?? [];
          totalesCC = d.totales ?? null;
        })
        .catch(() => {})
    );
  }

  await Promise.all(promises);

  // Calcular totales de pagos
  const totalPagado = pagos.reduce((s: number, p: any) => s + parseFloat(p.monto ?? 0), 0);
  const totalEgreso = parseFloat(egreso.total);
  const totalPendiente = Math.max(0, totalEgreso - totalPagado);
  const puedeRegistrarPago = egreso.estado_pago !== 'pagado';

  // Tiene desglose fiscal
  const tieneMontosFiscales = parseFloat(egreso.neto_gravado ?? 0) > 0
    || parseFloat(egreso.iva_21 ?? 0) > 0
    || parseFloat(egreso.iva_105 ?? 0) > 0
    || parseFloat(egreso.percepciones_ib ?? 0) > 0
    || parseFloat(egreso.otros_impuestos ?? 0) > 0
    || parseFloat(egreso.neto_no_gravado ?? 0) > 0;

  return (
    <section className="space-y-6 max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-kp-gray">
        <Link href="/gastos" className="hover:text-kp-white transition-colors">Gastos</Link>
        <span>/</span>
        <span className="text-kp-white truncate max-w-xs">{egreso.descripcion}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="w-1 h-6 bg-kp-red rounded-full block flex-shrink-0" />
            <h2 className="text-2xl font-bold">{egreso.descripcion}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TIPO_COLOR[egreso.tipo_operacion] ?? ''}`}>
              {TIPO_LABEL[egreso.tipo_operacion] ?? egreso.tipo_operacion}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${PAGO_STYLE[egreso.estado_pago] ?? ''}`}>
              {PAGO_LABEL[egreso.estado_pago] ?? egreso.estado_pago}
            </span>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {fmtDate(egreso.fecha_emision)}
            {egreso.sucursal_nombre && ` · ${egreso.sucursal_nombre}`}
          </p>
        </div>

        {puedeRegistrarPago && (
          <RegistrarPago
            egresoId={egreso.id}
            totalEgreso={totalEgreso}
            totalPagado={totalPagado}
            mediosPago={mediosPago}
            cuentasBancarias={cuentasBancarias}
          />
        )}
      </div>

      {/* Banner pedido de compra vinculado */}
      {pedido && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
          ${pedido.stock_acreditado
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-amber-500/20 bg-amber-500/5'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
            className={`w-5 h-5 flex-shrink-0 ${pedido.stock_acreditado ? 'text-green-400' : 'text-amber-400'}`}>
            <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <div className="flex-1 min-w-0">
            {pedido.stock_acreditado ? (
              <span className="text-green-400 font-semibold">Stock acreditado</span>
            ) : (
              <span className="text-amber-400 font-semibold">Stock pendiente de recepción</span>
            )}
            <span className="text-kp-gray ml-2 text-xs">
              {pedido.stock_acreditado
                ? 'La mercadería fue recibida y el stock fue actualizado.'
                : 'El pedido está pendiente. Confirmá la recepción para acreditar el stock.'}
            </span>
          </div>
          <Link
            href={`/pedidos-proveedores/${pedido.id}`}
            className={`ml-auto text-xs font-semibold hover:underline whitespace-nowrap
              ${pedido.stock_acreditado ? 'text-green-400 hover:text-green-300' : 'text-amber-400 hover:text-amber-300'}`}
          >
            {pedido.stock_acreditado ? 'Ver pedido →' : 'Confirmar recepción →'}
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Total</p>
          <p className="text-xl font-bold tabular-nums text-kp-white">{fmt(egreso.total)}</p>
        </div>
        <div className="bg-kp-surface2 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-green-400/70 uppercase tracking-widest font-semibold mb-1">Pagado</p>
          <p className="text-xl font-bold tabular-nums text-green-400">{fmt(totalPagado)}</p>
        </div>
        <div className={`bg-kp-surface2 rounded-xl p-4 border ${totalPendiente > 0 ? 'border-amber-500/20' : 'border-kp-border'}`}>
          <p className={`text-xs uppercase tracking-widest font-semibold mb-1 ${totalPendiente > 0 ? 'text-amber-400/70' : 'text-kp-gray'}`}>
            Pendiente
          </p>
          <p className={`text-xl font-bold tabular-nums ${totalPendiente > 0 ? 'text-amber-400' : 'text-kp-gray'}`}>
            {fmt(totalPendiente)}
          </p>
        </div>
      </div>

      {/* Alerta de vencimiento próximo */}
      {egreso.fecha_vencimiento_pago && egreso.estado_pago !== 'pagado' && (() => {
        const dias = Math.ceil(
          (new Date(egreso.fecha_vencimiento_pago).getTime() - Date.now()) / 86400000
        );
        if (dias > 7) return null;
        return (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${dias < 0 ? 'bg-kp-red/10 border-kp-red/30 text-kp-red' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {dias < 0
              ? `Pago vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
              : dias === 0
                ? 'El pago vence hoy'
                : `El pago vence en ${dias} día${dias !== 1 ? 's' : ''} (${fmtDate(egreso.fecha_vencimiento_pago)})`
            }
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Datos generales */}
        <Card title="Datos del Egreso">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo" value={TIPO_LABEL[egreso.tipo_operacion] ?? egreso.tipo_operacion} />
            <Field label="Fecha" value={fmtDate(egreso.fecha_emision)} />
            <Field label="Sucursal" value={egreso.sucursal_nombre} />
            {egreso.rubro_nombre && <Field label="Rubro" value={egreso.rubro_nombre} />}
            {egreso.subrubro_nombre && <Field label="Subrubro" value={egreso.subrubro_nombre} />}
            {egreso.fecha_vencimiento_pago && (
              <Field label="Vence" value={fmtDate(egreso.fecha_vencimiento_pago)} />
            )}
          </div>
        </Card>

        {/* Comprobante (si aplica) */}
        {TIPOS_CON_COMPROBANTE.includes(egreso.tipo_operacion) && egreso.tipo_comprobante && (
          <Card title="Comprobante">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo" value={COMP_LABEL[egreso.tipo_comprobante] ?? egreso.tipo_comprobante} />
              {egreso.punto_venta && egreso.numero_comprobante && (
                <Field
                  label="Número"
                  value={`${egreso.punto_venta}-${egreso.numero_comprobante}`}
                />
              )}
            </div>
          </Card>
        )}

        {/* Proveedor */}
        {egreso.proveedor_id && (
          <Card title="Proveedor">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Razón Social" value={egreso.proveedor_nombre} />
              </div>
              {egreso.proveedor_cuit && <Field label="CUIT" value={egreso.proveedor_cuit} />}
              {egreso.proveedor_cond_iva && <Field label="Condición IVA" value={egreso.proveedor_cond_iva} />}
            </div>
          </Card>
        )}

        {/* Montos fiscales */}
        {tieneMontosFiscales && (
          <Card title="Desglose Fiscal">
            <div className="space-y-2">
              {[
                { label: 'Neto Gravado',    value: egreso.neto_gravado },
                { label: 'Neto No Gravado', value: egreso.neto_no_gravado },
                { label: 'IVA 21%',         value: egreso.iva_21 },
                { label: 'IVA 10.5%',       value: egreso.iva_105 },
                { label: 'Percepciones IB', value: egreso.percepciones_ib },
                { label: 'Otros Imp.',      value: egreso.otros_impuestos },
              ]
                .filter(row => parseFloat(row.value ?? 0) !== 0)
                .map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-kp-gray">{row.label}</span>
                    <span className="tabular-nums text-kp-white">{fmt(row.value)}</span>
                  </div>
                ))}
              <div className="flex justify-between text-sm pt-2 border-t border-kp-border font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmt(egreso.total)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Ítems (compra_mercaderia / compra_gasto) */}
      {TIPOS_CON_ITEMS.includes(egreso.tipo_operacion) && items.length > 0 && (
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Ítems</h3>
            <span className="text-xs text-kp-gray/60">{items.length} línea{items.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2/50 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Descripción</th>
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Cant.</th>
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Precio Unit.</th>
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Neto Línea</th>
                <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Sucursal</th>
              </tr>
            </thead>
            <tbody className="bg-kp-surface divide-y divide-kp-border">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3 text-kp-white">
                    {item.articulo_codigo
                      ? <span className="text-kp-gray text-xs mr-2">[{item.articulo_codigo}]</span>
                      : null}
                    {item.articulo_nombre ?? item.descripcion}
                    {item.articulo_nombre && item.descripcion !== item.articulo_nombre && (
                      <span className="text-kp-gray text-xs ml-1">— {item.descripcion}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-white">
                    {parseFloat(item.cantidad).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray-lt">{fmt(item.precio_unitario)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-kp-white">{fmt(item.neto_linea)}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray">{item.sucursal_imputacion_nombre ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-kp-surface2 border-t border-kp-border">
                <td colSpan={3} className="px-4 py-3 text-xs text-kp-gray font-semibold text-right uppercase tracking-wide">
                  Total ítems
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                  {fmt(items.reduce((s: number, i: any) => s + parseFloat(i.neto_linea ?? 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Historial de pagos */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Historial de Pagos</h3>
          <span className="text-xs text-kp-gray/60">{pagos.length} pago{pagos.length !== 1 ? 's' : ''}</span>
        </div>
        {pagos.length === 0 ? (
          <div className="bg-kp-surface px-4 py-8 text-center text-kp-gray text-sm">
            No se han registrado pagos.
          </div>
        ) : (
          <div className="bg-kp-surface divide-y divide-kp-border">
            {pagos.map((pago: any) => (
              <div key={pago.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-kp-gray text-xs whitespace-nowrap">
                    {new Date(pago.fecha_pago).toLocaleDateString('es-AR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="font-semibold text-kp-white">{pago.medio_pago_nombre ?? '—'}</span>
                  {pago.cuenta_bancaria_nombre && (
                    <span className="text-kp-gray text-xs">{pago.cuenta_bancaria_nombre}</span>
                  )}
                  {pago.observaciones && (
                    <span className="text-kp-gray text-xs italic">{pago.observaciones}</span>
                  )}
                  <span className="ml-auto font-bold tabular-nums text-green-400">{fmt(pago.monto)}</span>
                </div>

                {/* Cheques anidados */}
                {Array.isArray(pago.cheques) && pago.cheques.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {pago.cheques.map((ch: any) => (
                      <div key={ch.id} className="flex flex-wrap gap-3 text-xs text-kp-gray bg-kp-surface2 rounded-lg px-3 py-1.5">
                        <span>Cheque {ch.banco}</span>
                        <span>Nro: {ch.numero_cheque}</span>
                        <span>Vence: {fmtDate(ch.fecha_vencimiento)}</span>
                        <span className="ml-auto tabular-nums text-kp-white font-semibold">{fmt(ch.importe)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cuenta corriente del proveedor */}
      {egreso.proveedor_id && movimientosCC.length > 0 && (
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
              Cuenta Corriente — {egreso.proveedor_nombre}
            </h3>
            {totalesCC && (
              <span className={`text-sm font-bold tabular-nums ${parseFloat(totalesCC.saldo_actual) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                Saldo: {fmt(totalesCC.saldo_actual)}
              </span>
            )}
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2/50 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Tipo</th>
                <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Descripción</th>
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Debe</th>
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Haber</th>
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody className="bg-kp-surface divide-y divide-kp-border">
              {movimientosCC.map((m: any) => (
                <tr key={m.id} className={`hover:bg-kp-surface2 transition-colors ${m.origen_id === egreso.id ? 'bg-kp-red/5' : ''}`}>
                  <td className="px-4 py-2.5 text-xs text-kp-gray whitespace-nowrap">
                    {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-kp-surface2 text-kp-gray border-kp-border">
                      {m.origen_tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-kp-gray-lt max-w-xs truncate">{m.descripcion ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium">
                    {parseFloat(m.debe) > 0 ? <span className="text-kp-red">{fmt(m.debe)}</span> : <span className="text-kp-gray/40">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium">
                    {parseFloat(m.haber) > 0 ? <span className="text-green-400">{fmt(m.haber)}</span> : <span className="text-kp-gray/40">—</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums text-sm font-bold ${parseFloat(m.saldo) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                    {fmt(m.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalesCC && (
            <div className="bg-kp-surface2 border-t border-kp-border px-4 py-3 flex gap-6 text-sm">
              <div>
                <span className="text-kp-gray">Total Debe: </span>
                <span className="font-semibold tabular-nums text-kp-red">{fmt(totalesCC.total_debe)}</span>
              </div>
              <div>
                <span className="text-kp-gray">Total Haber: </span>
                <span className="font-semibold tabular-nums text-green-400">{fmt(totalesCC.total_haber)}</span>
              </div>
              <div>
                <span className="text-kp-gray">Saldo Actual: </span>
                <span className={`font-bold tabular-nums ${parseFloat(totalesCC.saldo_actual) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {fmt(totalesCC.saldo_actual)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

    </section>
  );
}
