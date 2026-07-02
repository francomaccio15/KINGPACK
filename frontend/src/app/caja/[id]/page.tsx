import Link from 'next/link';
import RegistrarMovimiento from './RegistrarMovimiento';
import RegistrarGasto from './RegistrarGasto';
import CerrarCaja from './CerrarCaja';
import MovimientosTabla from './MovimientosTabla';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

export const dynamic = 'force-dynamic';

export default async function DetalleCajaPage({ params }: { params: { id: string } }) {
  const user = requireAuth('/caja');
  const esAdmin = user.rol === 'administrador';
  const esCajero = user.rol === 'cajero';
  const cajeroSucursalId = user.sucursal_default_id ?? null;

  let caja: any = null;
  let movimientos: any[] = [];
  let mediosPago: any[] = [];

  try {
    const res = await serverFetch(`/api/caja/${params.id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      caja       = data.caja;
      movimientos = data.movimientos ?? [];
      mediosPago  = data.medios_pago ?? [];
    }
  } catch { /* handled below */ }

  if (!caja) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Caja no encontrada.</p>
        <Link href="/caja" className="text-kp-red hover:underline text-sm">← Volver a Caja</Link>
      </section>
    );
  }

  // Cajeros ven el efectivo (base del arqueo) + los movimientos que registraron
  // ellos mismos aunque no sean efectivo (ej. una transferencia que cobraron),
  // así ven en su caja lo que cargaron. El resto de medios sigue siendo solo admin.
  const movimientosFiltrados = esAdmin
    ? movimientos
    : movimientos.filter((m: any) =>
        // egresos y retiros siempre (reducen el físico sin importar el medio)
        ['egreso', 'retiro'].includes(m.tipo) ||
        (m.medio_pago ?? '').toLowerCase().includes('efectivo') ||
        // no-efectivo que registró este mismo cajero
        (m.usuario_id != null && m.usuario_id === user.id)
      );

  const abierta = caja.estado === 'abierta';

  // Saldo del sistema = EFECTIVO físico esperado en el cajón. Cheques,
  // transferencias, tarjetas, MP y QR se reciben pero no son efectivo, así que
  // no cuentan para el arqueo (esto evita una "FALTA" falsa cuando hay un cheque).
  const esEfectivo = (m: any) =>
    (m.medio_pago ?? '').toLowerCase().includes('efectivo') || !m.medio_pago;
  const ingresosEfectivo = movimientos
    .filter((m: any) => ['ingreso', 'venta'].includes(m.tipo) && esEfectivo(m))
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);
  const egresosFisicos = movimientos
    .filter((m: any) => ['egreso', 'retiro'].includes(m.tipo))
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);
  const saldoSistema = parseFloat(caja.saldo_inicial) + ingresosEfectivo - egresosFisicos;

  const diff = caja.diferencia != null ? parseFloat(caja.diferencia) : null;

  // ── Resumen del día — totales completos (todos los medios de pago) ─────────
  const totalVentasDia = movimientos
    .filter((m: any) => m.tipo === 'venta')
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);

  const totalIngresosDia = movimientos
    .filter((m: any) => m.tipo === 'ingreso')
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);

  const totalEgresosDia = movimientos
    .filter((m: any) => m.tipo === 'egreso')
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);

  const totalRetirosDia = movimientos
    .filter((m: any) => m.tipo === 'retiro')
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);

  const resultadoNeto = totalVentasDia + totalIngresosDia - totalEgresosDia - totalRetirosDia;

  // Ventas agrupadas por medio de pago
  const ventasPorMedio: Record<string, number> = {};
  for (const m of movimientos) {
    if (m.tipo !== 'venta') continue;
    const k = m.medio_pago ?? 'Otro';
    ventasPorMedio[k] = (ventasPorMedio[k] ?? 0) + parseFloat(m.monto ?? 0);
  }
  const ventasMedios = Object.entries(ventasPorMedio).sort((a, b) => b[1] - a[1]);
  // diferencia = saldo sistema − saldo real ⇒ positivo = FALTA, negativo = SOBRA
  const diffCuadrada = diff == null || Math.abs(diff) < 0.01;
  const diffColor = diffCuadrada
    ? 'text-kp-gray'
    : diff! > 0 ? 'text-kp-red' : 'text-amber-400';
  const diffLabel = diffCuadrada
    ? 'Caja cuadrada'
    : diff! > 0 ? '▼ FALTA' : '▲ SOBRA';

  const fecha = new Date(caja.fecha_apertura).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <section className="space-y-6 max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-kp-gray">
        <Link href="/caja" className="hover:text-kp-white transition-colors">Caja</Link>
        <span>/</span>
        <span className="text-kp-white">{caja.sucursal_nombre}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold">{caja.sucursal_nombre}</h2>
            {abierta ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-green-500/10 text-green-400 border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Abierta
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-kp-border/30 text-kp-gray border-kp-border/50">
                Cerrada
              </span>
            )}
          </div>
          <p className="text-sm text-kp-gray pl-3">Apertura: {fecha}</p>
        </div>

        {/* Acciones */}
        {abierta && (esAdmin || (esCajero && caja.sucursal_id === cajeroSucursalId)) && (
          <div className="flex gap-2 flex-wrap">
            {esAdmin && <RegistrarMovimiento cajaId={caja.id} mediosPago={mediosPago} />}
            {esCajero && <RegistrarGasto cajaId={caja.id} />}
            <CerrarCaja
              cajaId={caja.id}
              saldoSistema={saldoSistema}
              saldoInicial={parseFloat(String(caja.saldo_inicial ?? 0))}
              sucursalNombre={caja.sucursal_nombre ?? ''}
              fechaApertura={caja.fecha_apertura ?? ''}
            />
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Saldo inicial</p>
          <p className="text-lg font-bold tabular-nums text-kp-white">{fmt(caja.saldo_inicial)}</p>
        </div>
        <div className="bg-kp-surface2 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-green-400/70 uppercase tracking-widest font-semibold mb-1">
            Ingresos{!esAdmin ? ' (efectivo)' : ''}
          </p>
          <p className="text-lg font-bold tabular-nums text-green-400">
            +{fmt(esAdmin ? caja.total_ingresos : ingresosEfectivo)}
          </p>
        </div>
        <div className="bg-kp-surface2 border border-kp-red/20 rounded-xl p-4">
          <p className="text-xs text-kp-red/70 uppercase tracking-widest font-semibold mb-1">Egresos</p>
          <p className="text-lg font-bold tabular-nums text-kp-red">
            -{fmt(esAdmin ? caja.total_egresos : egresosFisicos)}
          </p>
        </div>
        <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Saldo sistema</p>
          <p className="text-lg font-bold tabular-nums text-kp-white">{fmt(saldoSistema)}</p>
        </div>
      </div>

      {/* Arqueo (solo cerradas y solo admin) */}
      {!abierta && esAdmin && (
        <div className={[
          'rounded-xl border p-5 flex flex-wrap gap-6',
          diff != null && Math.abs(diff) > 0.01
            ? diff < 0 ? 'border-kp-red/40 bg-kp-red/5' : 'border-green-500/30 bg-green-500/5'
            : 'border-kp-border bg-kp-surface2',
        ].join(' ')}>
          <div>
            <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Saldo sistema</p>
            <p className="text-xl font-bold tabular-nums text-kp-white">{fmt(caja.saldo_final_sistema)}</p>
          </div>
          <div>
            <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Saldo real (contado)</p>
            <p className="text-xl font-bold tabular-nums text-kp-white">{fmt(caja.saldo_final_real)}</p>
          </div>
          <div>
            <p className={`text-xs uppercase tracking-widest font-semibold mb-1 ${diffCuadrada ? 'text-kp-gray' : diffColor}`}>{diffLabel}</p>
            <p className={`text-xl font-bold tabular-nums ${diffColor}`}>
              {diff == null ? '—' : `${!diffCuadrada ? (diff > 0 ? '−' : '+') : ''}${fmt(Math.abs(diff))}`}
            </p>
          </div>
          {caja.fecha_cierre && (
            <div>
              <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Cierre</p>
              <p className="text-sm text-kp-white">
                {new Date(caja.fecha_cierre).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Resumen del Día ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
        <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-kp-red rounded-full block" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-white">Resumen del Día</h3>
          </div>
          <span className="text-xs text-kp-gray">
            {new Date(caja.fecha_apertura).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Columna izquierda: ventas por medio de pago */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-kp-gray uppercase tracking-widest">Ventas por medio de pago</p>
            {ventasMedios.length === 0 ? (
              <p className="text-sm text-kp-gray italic">Sin ventas registradas</p>
            ) : (
              <div className="space-y-2">
                {ventasMedios.map(([medio, monto]) => {
                  const pct = totalVentasDia > 0 ? (monto / totalVentasDia) * 100 : 0;
                  return (
                    <div key={medio}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-kp-white font-medium">{medio}</span>
                        <span className="text-sm tabular-nums font-bold text-green-400">{fmt(monto)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-kp-border overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-1 border-t border-kp-border">
                  <span className="text-xs text-kp-gray uppercase tracking-widest font-bold">Total ventas</span>
                  <span className="text-base tabular-nums font-bold text-green-400">{fmt(totalVentasDia)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: otros movimientos + resultado */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-kp-gray uppercase tracking-widest">Otros movimientos</p>
            <div className="space-y-2">
              {totalIngresosDia > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-kp-gray">Ingresos manuales</span>
                  <span className="tabular-nums text-green-400 font-semibold">{fmt(totalIngresosDia)}</span>
                </div>
              )}
              {totalEgresosDia > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-kp-gray">Gastos / egresos</span>
                  <span className="tabular-nums text-kp-red font-semibold">−{fmt(totalEgresosDia)}</span>
                </div>
              )}
              {totalRetirosDia > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-kp-gray">Retiros</span>
                  <span className="tabular-nums text-kp-red font-semibold">−{fmt(totalRetirosDia)}</span>
                </div>
              )}
              {totalIngresosDia === 0 && totalEgresosDia === 0 && totalRetirosDia === 0 && (
                <p className="text-sm text-kp-gray italic">Sin otros movimientos</p>
              )}
            </div>

            {/* Resultado neto — destacado */}
            <div className={`rounded-xl border px-4 py-3 mt-2 ${
              resultadoNeto >= 0
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-kp-red/30 bg-kp-red/5'
            }`}>
              <p className="text-xs text-kp-gray uppercase tracking-widest font-bold mb-1">Resultado del día</p>
              <p className={`text-2xl font-bold tabular-nums ${resultadoNeto >= 0 ? 'text-green-400' : 'text-kp-red'}`}>
                {resultadoNeto >= 0 ? '+' : ''}{fmt(resultadoNeto)}
              </p>
              <p className="text-xs text-kp-gray mt-1">
                Ventas {fmt(totalVentasDia + totalIngresosDia)} — Gastos {fmt(totalEgresosDia + totalRetirosDia)}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Tabla de movimientos */}
      <MovimientosTabla movimientos={movimientosFiltrados} esAdmin={esAdmin} />

      {/* Print layout — cierre de caja (hidden on screen, visible on print) */}
      {caja.estado === 'cerrada' && (
        <div className="hidden print:block" style={{ fontFamily: 'Arial, sans-serif', color: '#111', background: 'white' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '1px', margin: 0 }}>KING PACK DESCARTABLES</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>REPORTE DE CIERRE DE CAJA</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px' }}>
              <p style={{ margin: '0 0 2px' }}><strong>Sucursal:</strong> {caja.sucursal_nombre}</p>
              <p style={{ margin: '0 0 2px' }}>
                <strong>Fecha apertura:</strong>{' '}
                {new Date(caja.fecha_apertura).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Fecha cierre:</strong>{' '}
                {caja.fecha_cierre ? new Date(caja.fecha_cierre).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
          </div>

          {/* Resumen de saldos */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' }}>
            <tbody>
              {([
                ['Saldo inicial',            fmt(caja.saldo_inicial)],
                ['Ingresos en efectivo',     '+' + fmt(ingresosEfectivo)],
                ['Egresos / retiros',        '−' + fmt(egresosFisicos)],
                ['Saldo sistema (efectivo)', fmt(caja.saldo_final_sistema)],
                ['Saldo real (contado)',     fmt(caja.saldo_final_real)],
                [
                  diffCuadrada ? 'Diferencia' : diff! > 0 ? 'FALTA' : 'SOBRA',
                  diff == null ? '—' : `${!diffCuadrada ? (diff > 0 ? '−' : '+') : ''}${fmt(Math.abs(diff))}`,
                ],
              ] as [string, string][]).map(([label, val]) => (
                <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 8px', color: '#6b7280' }}>{label}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '8px', margin: 0 }}>
            KingPack — Generado el {new Date().toLocaleDateString('es-AR')}
          </p>
        </div>
      )}

    </section>
  );
}
