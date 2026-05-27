import Link from 'next/link';
import RegistrarMovimiento from './RegistrarMovimiento';
import CerrarCaja from './CerrarCaja';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const TIPO_STYLE: Record<string, string> = {
  ingreso: 'bg-green-500/10 text-green-400 border-green-500/30',
  egreso:  'bg-kp-red/10 text-kp-red border-kp-red/30',
  retiro:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  venta:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso',
  egreso:  'Egreso',
  retiro:  'Retiro',
  venta:   'Venta',
};

export const dynamic = 'force-dynamic';

export default async function DetalleCajaPage({ params }: { params: { id: string } }) {
  const user = requireAuth('/caja');
  const esAdmin = user.rol === 'administrador';

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

  // Cajeros solo ven movimientos de efectivo
  const movimientosFiltrados = esAdmin
    ? movimientos
    : movimientos.filter((m: any) =>
        m.tipo !== 'venta' || (m.medio_pago ?? '').toLowerCase().includes('efectivo')
      );

  // Recalcular KPIs a partir de los movimientos filtrados
  const totalIngresosVista = movimientosFiltrados
    .filter((m: any) => ['ingreso', 'venta'].includes(m.tipo))
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);
  const totalEgresosVista = movimientosFiltrados
    .filter((m: any) => !['ingreso', 'venta'].includes(m.tipo))
    .reduce((acc: number, m: any) => acc + parseFloat(m.monto ?? 0), 0);

  const abierta = caja.estado === 'abierta';
  const saldoSistema = esAdmin
    ? parseFloat(caja.saldo_inicial) + parseFloat(caja.total_ingresos) - parseFloat(caja.total_egresos)
    : parseFloat(caja.saldo_inicial) + totalIngresosVista - totalEgresosVista;

  const diff = caja.diferencia != null ? parseFloat(caja.diferencia) : null;
  const diffColor = diff == null || Math.abs(diff) < 0.01
    ? 'text-kp-gray'
    : diff < 0 ? 'text-kp-red' : 'text-green-400';

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

        {/* Acciones (solo admin) */}
        {abierta && esAdmin && (
          <div className="flex gap-2">
            <RegistrarMovimiento cajaId={caja.id} mediosPago={mediosPago} />
            <CerrarCaja cajaId={caja.id} saldoSistema={saldoSistema} />
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
            +{fmt(esAdmin ? caja.total_ingresos : totalIngresosVista)}
          </p>
        </div>
        <div className="bg-kp-surface2 border border-kp-red/20 rounded-xl p-4">
          <p className="text-xs text-kp-red/70 uppercase tracking-widest font-semibold mb-1">Egresos</p>
          <p className="text-lg font-bold tabular-nums text-kp-red">
            −{fmt(esAdmin ? caja.total_egresos : totalEgresosVista)}
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
            <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Diferencia</p>
            <p className={`text-xl font-bold tabular-nums ${diffColor}`}>
              {diff != null ? fmt(diff) : '—'}
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

      {/* Tabla de movimientos */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">
            Movimientos{!esAdmin ? ' — Efectivo' : ''}
          </h3>
          <span className="text-xs text-kp-gray/60">{movimientosFiltrados.length} registros</span>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2/50 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Hora</th>
              <th className="text-center px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Concepto</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Medio de Pago</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {movimientosFiltrados.map((m: any) => {
              const esIngreso = ['ingreso', 'venta'].includes(m.tipo);
              return (
                <tr key={m.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">
                    {new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TIPO_STYLE[m.tipo] ?? ''}`}>
                      {TIPO_LABEL[m.tipo] ?? m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-kp-white">{m.concepto}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{m.medio_pago ?? '—'}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${esIngreso ? 'text-green-400' : 'text-kp-red'}`}>
                    {esIngreso ? '+' : '−'}{fmt(m.monto)}
                  </td>
                </tr>
              );
            })}
            {movimientosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-kp-gray text-sm">
                  No hay movimientos{!esAdmin ? ' en efectivo' : ''} registrados en esta caja.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
