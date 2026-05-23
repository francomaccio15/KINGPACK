import Link from 'next/link';
import RegistrarPago from './RegistrarPago';
import EditarCliente from './EditarCliente';
import EstadoCuentaPDF from './EstadoCuentaPDF';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: any) => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? '—' : ars.format(n); };
const fmtFecha = (f: string) => new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const dynamic = 'force-dynamic';

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  requireAuth();
  const [clienteRes, movsRes, condIvaRes, listasRes, sucursalesRes] = await Promise.all([
    serverFetch(`/api/clientes/${params.id}`,              { cache: 'no-store' }),
    serverFetch(`/api/clientes/${params.id}/movimientos?limit=100`, { cache: 'no-store' }),
    serverFetch(`/api/clientes/cond-iva`,                 { cache: 'no-store' }),
    serverFetch(`/api/listas-precios`,                    { cache: 'no-store' }),
    serverFetch(`/api/sucursales`,                        { cache: 'no-store' }),
  ]);

  if (!clienteRes.ok) {
    return (
      <div className="rounded-xl bg-kp-surface border border-kp-red/40 p-6">
        <p className="text-kp-red font-bold">Cliente no encontrado</p>
        <Link href="/clientes" className="text-sm text-kp-gray hover:text-kp-white mt-2 inline-block">← Volver</Link>
      </div>
    );
  }

  const { cliente }                        = await clienteRes.json();
  const { movimientos = [], correcciones = [], saldo_inicial = 0 } = movsRes.ok ? await movsRes.json() : {};
  const condIva    = condIvaRes.ok  ? (await condIvaRes.json()).cond_iva    ?? [] : [];
  const listas     = listasRes.ok   ? (await listasRes.json()).listas       ?? [] : [];
  const sucursales = sucursalesRes.ok ? (await sucursalesRes.json()).sucursales ?? [] : [];

  const saldoActual  = parseFloat(cliente.saldo_actual  || '0');
  const limiteCredito = parseFloat(cliente.limite_credito || '0');
  const excedeCredito = limiteCredito > 0 && saldoActual > limiteCredito;

  const TIPO_LABEL: Record<string, string> = {
    venta:      'Venta',
    facturacion:'Facturación',
    pago:       'Pago',
    correccion: 'Corrección',
  };

  return (
    <section className="space-y-6">

      {/* Breadcrumb */}
      <Link href="/clientes" className="text-xs text-kp-gray hover:text-kp-white transition-colors">
        ← Clientes
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">{cliente.razon_social}</h2>
            {!cliente.activo && (
              <span className="text-xs bg-kp-surface2 border border-kp-border text-kp-gray rounded px-2 py-0.5">Inactivo</span>
            )}
          </div>
          {cliente.cuit && (
            <p className="text-sm text-kp-gray pl-3 font-mono">CUIT: {cliente.cuit}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EstadoCuentaPDF clienteId={cliente.id} />
          <EditarCliente cliente={cliente} condIva={condIva} listas={listas} sucursales={sucursales} />
          <RegistrarPago clienteId={cliente.id} saldoActual={saldoActual} />
        </div>
      </div>

      {/* Banner alerta crédito excedido */}
      {excedeCredito && (
        <div className="flex items-center gap-3 rounded-xl border border-kp-red/50 bg-kp-red/10 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-kp-red flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-sm text-kp-red font-semibold">
            Límite de crédito excedido — debe {fmt(saldoActual)} / límite {fmt(limiteCredito)}
          </p>
        </div>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl border px-5 py-4 ${excedeCredito ? 'bg-kp-red/10 border-kp-red/40' : 'bg-kp-surface border-kp-border'}`}>
          <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Saldo Actual</p>
          <p className={`text-lg font-bold tabular-nums ${excedeCredito ? 'text-kp-red' : saldoActual > 0 ? 'text-amber-400' : saldoActual < 0 ? 'text-green-400' : 'text-kp-white'}`}>
            {fmt(saldoActual)}
          </p>
        </div>
        <div className={`rounded-xl border px-5 py-4 ${excedeCredito ? 'bg-kp-red/10 border-kp-red/40' : 'bg-kp-surface border-kp-border'}`}>
          <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Límite Crédito</p>
          <p className={`text-lg font-bold tabular-nums ${excedeCredito ? 'text-kp-red' : 'text-kp-white'}`}>
            {fmt(limiteCredito)}
          </p>
        </div>
        {[
          { label: 'Descuento Extra', value: `${parseFloat(cliente.descuento_adicional || '0').toFixed(1)}%`, color: 'text-kp-white' },
          { label: 'Lista de Precios', value: cliente.lista_precio ?? '—', color: 'text-kp-gray-lt' },
        ].map(card => (
          <div key={card.label} className="rounded-xl bg-kp-surface border border-kp-border px-5 py-4">
            <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Info del cliente */}
      <div className="rounded-xl bg-kp-surface border border-kp-border p-5">
        <h3 className="text-xs text-kp-gray uppercase tracking-widest mb-3">Información</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            { label: 'Condición IVA', value: cliente.cond_iva },
            { label: 'Teléfono', value: cliente.telefono },
            { label: 'Sucursal', value: cliente.sucursal_nombre },
            { label: 'Dirección', value: cliente.direccion },
            { label: 'Saldo Inicial', value: fmt(saldo_inicial) },
            { label: 'Cliente desde', value: new Date(cliente.created_at).toLocaleDateString('es-AR') },
          ].map(row => (
            <div key={row.label}>
              <p className="text-[10px] text-kp-gray uppercase tracking-widest">{row.label}</p>
              <p className="text-kp-gray-lt mt-0.5">{row.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cuenta Corriente */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-kp-red rounded-full block" />
          <h3 className="font-bold uppercase tracking-wide text-sm">Cuenta Corriente</h3>
          <span className="text-xs text-kp-gray">({movimientos.length} movimientos)</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Tipo</th>
                <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Debe</th>
                <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Haber</th>
                <th className="text-right px-4 py-3 uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                  <span className="text-kp-red">Saldo</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-kp-surface divide-y divide-kp-border">

              {/* Saldo inicial */}
              <tr className="bg-kp-surface2/50">
                <td className="px-4 py-2 text-xs text-kp-gray whitespace-nowrap">—</td>
                <td className="px-4 py-2 text-xs text-kp-gray italic">Saldo inicial</td>
                <td className="px-4 py-2 text-right text-xs text-kp-gray">—</td>
                <td className="px-4 py-2 text-right text-xs text-kp-gray">—</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs font-semibold text-kp-gray-lt">{fmt(saldo_inicial)}</td>
              </tr>

              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-kp-gray text-xs">Sin movimientos registrados</td>
                </tr>
              )}

              {movimientos.map((m: any) => (
                <tr key={m.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-kp-gray whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border
                      ${m.origen_tipo === 'pago'
                        ? 'text-green-400 bg-green-400/10 border-green-400/30'
                        : m.origen_tipo === 'venta'
                        ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                        : 'text-kp-gray-lt bg-kp-surface2 border-kp-border'}`}>
                      {TIPO_LABEL[m.origen_tipo] ?? m.origen_tipo ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    {parseFloat(m.debe) > 0
                      ? <span className="text-amber-400 font-semibold">{fmt(m.debe)}</span>
                      : <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    {parseFloat(m.haber) > 0
                      ? <span className="text-green-400 font-semibold">{fmt(m.haber)}</span>
                      : <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold">
                    <span className={parseFloat(m.saldo) > 0 ? 'text-amber-400' : parseFloat(m.saldo) < 0 ? 'text-green-400' : 'text-kp-gray'}>
                      {fmt(m.saldo)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correcciones */}
      {correcciones.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-kp-border rounded-full block" />
            <h3 className="font-bold uppercase tracking-wide text-sm text-kp-gray">Notas y Correcciones</h3>
          </div>
          <div className="rounded-xl border border-kp-border overflow-hidden">
            {correcciones.filter((c: any) => c.monto !== 0 || c.motivo).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-kp-border last:border-0 bg-kp-surface">
                <div>
                  <p className="text-sm text-kp-gray-lt">{c.motivo}</p>
                  <p className="text-xs text-kp-gray mt-0.5">{fmtFecha(c.fecha)}</p>
                </div>
                {parseFloat(c.monto) !== 0 && (
                  <span className={`text-sm font-bold tabular-nums ${parseFloat(c.monto) > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                    {parseFloat(c.monto) > 0 ? '+' : ''}{fmt(c.monto)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}
