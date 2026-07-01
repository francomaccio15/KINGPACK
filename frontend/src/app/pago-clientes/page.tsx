import { Suspense } from 'react';
import Link from 'next/link';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import FiltroFecha from './FiltroFecha';

type MovCliente = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  fecha: string;
  origen_tipo: string | null;
  debe: string;
  haber: string;
  saldo: string;
  origen_id: string | null;
};

type Egreso = {
  id: string;
  fecha_emision: string;
  descripcion: string;
  tipo_operacion: string;
  total: string;
  estado_pago: 'pendiente' | 'pagado' | 'parcial';
  proveedor_nombre: string | null;
  sucursal_nombre: string | null;
};

type Data = {
  fecha: string | null;
  movimientos_clientes: MovCliente[];
  egresos: Egreso[];
  totales: { clientes_debe: number; clientes_haber: number; egresos_total: number };
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const ORIGEN_LABEL: Record<string, string> = {
  venta:         'Venta',
  facturacion:   'Facturación',
  pago:          'Pago',
  correccion:    'Corrección',
  edicion_venta: 'Edición venta',
  nota_credito:  'Nota de crédito',
  devolucion:    'Devolución',
};
const ORIGEN_COLOR: Record<string, string> = {
  pago:         'bg-green-500/10 text-green-400 border-green-500/30',
  venta:        'bg-blue-500/10 text-blue-400 border-blue-500/30',
  facturacion:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  nota_credito: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  devolucion:   'bg-orange-500/10 text-orange-400 border-orange-500/30',
  correccion:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const TIPO_LABEL: Record<string, string> = {
  compra_mercaderia:    'Compra Merc.',
  compra_gasto:         'Compra Gasto',
  carga_social_laboral: 'Carga Social',
  gasto_manual:         'Gasto Manual',
  inversion_bien_uso:   'Inversión',
  anticipo_proveedor:   'Anticipo',
};
const PAGO_STYLE: Record<string, string> = {
  pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  parcial:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  pagado:    'bg-green-500/10 text-green-400 border-green-500/30',
};
const PAGO_LABEL: Record<string, string> = { pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Pagado' };

function hoyAR(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

const horaAR = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

async function fetchData(fecha: string): Promise<Data> {
  const q = new URLSearchParams({ fecha });
  return serverFetch(`/api/pago-clientes?${q}`, { cache: 'no-store' })
    .then(r => r.json())
    .catch(() => ({ fecha, movimientos_clientes: [], egresos: [], totales: { clientes_debe: 0, clientes_haber: 0, egresos_total: 0 } }));
}

export const dynamic = 'force-dynamic';

export default async function PagoClientesPage({
  searchParams,
}: {
  searchParams: { fecha?: string };
}) {
  requireAuth('/pago-clientes');
  const fecha = searchParams.fecha && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.fecha)
    ? searchParams.fecha
    : hoyAR();

  const { movimientos_clientes, egresos, totales } = await fetchData(fecha);

  const fechaLarga = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const thCls = 'text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold';

  return (
    <section className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Pago de Clientes</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3 capitalize">{fechaLarga}</p>
        </div>
        <Suspense>
          <FiltroFecha fecha={fecha} />
        </Suspense>
      </div>

      {/* Tarjetas de totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-kp-border bg-kp-surface p-4">
          <p className="text-xs uppercase tracking-widest text-kp-gray">Cobrado a clientes (haber)</p>
          <p className="text-xl font-bold text-green-400 tabular-nums mt-1">{fmt(totales?.clientes_haber)}</p>
        </div>
        <div className="rounded-xl border border-kp-border bg-kp-surface p-4">
          <p className="text-xs uppercase tracking-widest text-kp-gray">Cargado a clientes (debe)</p>
          <p className="text-xl font-bold text-kp-white tabular-nums mt-1">{fmt(totales?.clientes_debe)}</p>
        </div>
        <div className="rounded-xl border border-kp-border bg-kp-surface p-4">
          <p className="text-xs uppercase tracking-widest text-kp-gray">Egresos del día</p>
          <p className="text-xl font-bold text-kp-red tabular-nums mt-1">{fmt(totales?.egresos_total)}</p>
        </div>
      </div>

      {/* ── Movimientos de clientes ── */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-kp-gray-lt mb-2 pl-1">
          Movimientos de clientes ({movimientos_clientes.length})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className={thCls}>Hora</th>
                <th className={thCls}>Cliente</th>
                <th className={thCls}>Concepto</th>
                <th className={`${thCls} text-right`}>Debe</th>
                <th className={`${thCls} text-right`}>Haber</th>
                <th className={`${thCls} text-right`}>Saldo</th>
              </tr>
            </thead>
            <tbody className="bg-kp-surface divide-y divide-kp-border">
              {movimientos_clientes.map(m => (
                <tr key={m.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">{horaAR(m.fecha)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${m.cliente_id}`} className="font-medium text-kp-white group-hover:text-kp-red transition-colors">
                      {m.cliente_nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ORIGEN_COLOR[m.origen_tipo ?? ''] ?? 'bg-kp-border/20 text-kp-gray border-kp-border'}`}>
                      {ORIGEN_LABEL[m.origen_tipo ?? ''] ?? (m.origen_tipo ?? '—')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-white">{parseFloat(m.debe) ? fmt(m.debe) : <span className="text-kp-border">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-400">{parseFloat(m.haber) ? fmt(m.haber) : <span className="text-kp-border">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray-lt">{fmt(m.saldo)}</td>
                </tr>
              ))}
              {movimientos_clientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-kp-gray">
                    No hay movimientos de clientes en este día.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Egresos ── */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-kp-gray-lt mb-2 pl-1">
          Egresos del día ({egresos.length})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className={thCls}>Tipo</th>
                <th className={thCls}>Descripción</th>
                <th className={thCls}>Proveedor</th>
                <th className={thCls}>Sucursal</th>
                <th className={`${thCls} text-center`}>Pago</th>
                <th className={`${thCls} text-right`}>Total</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="bg-kp-surface divide-y divide-kp-border">
              {egresos.map(e => (
                <tr key={e.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-kp-border/20 text-kp-gray-lt border-kp-border">
                      {TIPO_LABEL[e.tipo_operacion] ?? e.tipo_operacion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-kp-white">{e.descripcion}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{e.proveedor_nombre ?? <span className="text-kp-border">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{e.sucursal_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${PAGO_STYLE[e.estado_pago] ?? ''}`}>
                      {PAGO_LABEL[e.estado_pago] ?? e.estado_pago}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">{fmt(e.total)}</td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/gastos/${e.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent hover:border-kp-border hover:bg-kp-surface2"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
              {egresos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-kp-gray">
                    No hay egresos en este día.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
