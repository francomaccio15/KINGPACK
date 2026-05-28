import Link from 'next/link';
import AbrirCaja from './AbrirCaja';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

type SucursalEstado = {
  sucursal_id: string;
  sucursal_nombre: string;
  id: string | null;           // caja abierta id
  fecha_apertura: string | null;
  saldo_inicial: string | null;
  estado: 'abierta' | null;
  total_ingresos: string;
  total_egresos: string;
  total_movimientos: number;
};

type CajaHistorial = {
  id: string;
  sucursal_id: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  estado: 'abierta' | 'cerrada';
  saldo_inicial: string;
  saldo_final_sistema: string | null;
  saldo_final_real: string | null;
  diferencia: string | null;
  sucursal_nombre: string;
  total_movimientos: number;
};

async function fetchData() {
  const [estadoRes, historialRes] = await Promise.all([
    serverFetch(`/api/caja/estado`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch(`/api/caja?limit=20`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ cajas: [] })),
  ]);
  return {
    sucursales:  estadoRes.sucursales  ?? [],
    historial:   historialRes.cajas    ?? [],
  };
}

export const dynamic = 'force-dynamic';

export default async function CajaPage() {
  const user = requireAuth('/caja');
  const { sucursales: allSucursales, historial: allHistorial } = await fetchData();

  const esCajero = user.rol === 'cajero';
  const sucursalId = user.sucursal_default_id ?? null;

  // Cajero sin sucursal asignada
  if (esCajero && !sucursalId) {
    return (
      <section className="space-y-7">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Caja</h2>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-sm text-yellow-400">
          No tenés sucursal asignada. Contactá al administrador para que configure tu sucursal de trabajo.
        </div>
      </section>
    );
  }

  // Filtrar por sucursal si es cajero
  const sucursales: SucursalEstado[] = esCajero
    ? allSucursales.filter((s: SucursalEstado) => s.sucursal_id === sucursalId)
    : allSucursales;
  const historial: CajaHistorial[] = esCajero
    ? allHistorial.filter((c: CajaHistorial) => c.sucursal_id === sucursalId)
    : allHistorial;

  const abiertas  = sucursales.filter((s: SucursalEstado) => s.estado === 'abierta');

  return (
    <section className="space-y-7">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Caja</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {esCajero && sucursales[0]
              ? sucursales[0].sucursal_nombre
              : `${abiertas.length} ${abiertas.length === 1 ? 'caja abierta' : 'cajas abiertas'} de ${sucursales.length} sucursales`
            }
          </p>
        </div>
      </div>

      {/* Cards por sucursal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sucursales.map((s) => {
          const abierta = s.estado === 'abierta';
          const saldoSistema = abierta
            ? parseFloat(s.saldo_inicial ?? '0')
              + parseFloat(s.total_ingresos)
              - parseFloat(s.total_egresos)
            : null;

          return (
            <div
              key={s.sucursal_id}
              className={[
                'rounded-xl border p-5 flex flex-col gap-4 transition-colors',
                abierta
                  ? 'bg-kp-surface border-green-500/30'
                  : 'bg-kp-surface border-kp-border',
              ].join(' ')}
            >
              {/* Header card */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-0.5">
                    {s.sucursal_nombre}
                  </p>
                  {abierta ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Caja abierta
                    </span>
                  ) : (
                    <span className="text-xs text-kp-gray/50">Sin caja activa</span>
                  )}
                </div>
                {abierta && (
                  <Link
                    href={`/caja/${s.id}`}
                    className="text-xs text-kp-gray hover:text-kp-white border border-kp-border hover:border-kp-gray rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    Ver detalle →
                  </Link>
                )}
              </div>

              {/* Métricas */}
              {abierta ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-kp-gray mb-0.5">Saldo inicial</p>
                    <p className="text-sm font-semibold tabular-nums text-kp-white">{fmt(s.saldo_inicial)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-kp-gray mb-0.5">Saldo sistema</p>
                    <p className="text-sm font-bold tabular-nums text-kp-white">{fmt(saldoSistema)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-400/70 mb-0.5">Ingresos</p>
                    <p className="text-sm tabular-nums text-green-400">+{fmt(s.total_ingresos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-kp-red/70 mb-0.5">Egresos</p>
                    <p className="text-sm tabular-nums text-kp-red">−{fmt(s.total_egresos)}</p>
                  </div>
                </div>
              ) : (
                <AbrirCaja sucursalId={s.sucursal_id} sucursalNombre={s.sucursal_nombre} />
              )}

              {abierta && (
                <p className="text-xs text-kp-gray/60 border-t border-kp-border pt-3">
                  {s.total_movimientos} {Number(s.total_movimientos) === 1 ? 'movimiento' : 'movimientos'}
                  {s.fecha_apertura && (
                    <> · Abierta {new Date(s.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Historial de cajas */}
      {historial.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-kp-gray mb-3">
            Historial reciente
          </h3>
          <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-kp-surface2 border-b border-kp-border">
                  <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Apertura</th>
                  <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Sucursal</th>
                  <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Saldo inicial</th>
                  <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Saldo sistema</th>
                  <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Saldo real</th>
                  <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Diferencia</th>
                  <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="bg-kp-surface divide-y divide-kp-border">
                {historial.map((c) => {
                  const diff = parseFloat(c.diferencia ?? '0');
                  const diffColor = Math.abs(diff) < 0.01
                    ? 'text-kp-gray'
                    : diff < 0
                      ? 'text-kp-red font-semibold'
                      : 'text-green-400 font-semibold';

                  const fecha = new Date(c.fecha_apertura).toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  });

                  return (
                    <tr key={c.id} className="hover:bg-kp-surface2 transition-colors group">
                      <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">{fecha}</td>
                      <td className="px-4 py-3 font-medium text-kp-white">{c.sucursal_nombre}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-kp-gray-lt">{fmt(c.saldo_inicial)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-kp-white">{fmt(c.saldo_final_sistema)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-kp-white">{fmt(c.saldo_final_real)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${diffColor}`}>
                        {c.diferencia != null ? fmt(diff) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.estado === 'abierta' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-green-500/10 text-green-400 border-green-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Abierta
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-kp-border/30 text-kp-gray border-kp-border/50">
                            Cerrada
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Link
                          href={`/caja/${c.id}`}
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
              </tbody>
            </table>
          </div>
        </div>
      )}

    </section>
  );
}
