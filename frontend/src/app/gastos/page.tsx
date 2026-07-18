import { Suspense } from 'react';
import Link from 'next/link';
import FiltrosGastos from './FiltrosGastos';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

type Egreso = {
  id: string;
  tipo_operacion: string;
  tipo_comprobante: string | null;
  punto_venta: string | null;
  numero_comprobante: string | null;
  fecha_emision: string;
  descripcion: string;
  total: string;
  estado_pago: 'pendiente' | 'pagado' | 'parcial';
  fecha_vencimiento_pago: string | null;
  proveedor_nombre: string | null;
  proveedor_cuit: string | null;
  sucursal_nombre: string | null;
  rubro_nombre: string | null;
  subrubro_nombre: string | null;
  items_count: number;
};

type Alerta = {
  vencimientos_egresos: { id: string; descripcion: string; total: string; fecha_vencimiento_pago: string; proveedor_nombre: string | null }[];
  vencimientos_cheques: { banco: string; numero_cheque: string; fecha_vencimiento: string; importe: string; proveedor_nombre: string | null }[];
  obligaciones_pendientes: { id: string; descripcion: string; periodo_mes: number; periodo_anio: number }[];
  bloqueo_cierre: boolean;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const TIPO_LABEL: Record<string, string> = {
  compra_mercaderia:    'Compra Merc.',
  compra_gasto:         'Compra Gasto',
  carga_social_laboral: 'Carga Social',
  gasto_manual:         'Gasto Manual',
  inversion_bien_uso:   'Inversión',
  anticipo_proveedor:   'Anticipo',
};

const TIPO_COLOR: Record<string, string> = {
  compra_mercaderia:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  compra_gasto:         'bg-purple-500/10 text-purple-400 border-purple-500/30',
  carga_social_laboral: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  gasto_manual:         'bg-kp-border/30 text-kp-gray border-kp-border/50',
  inversion_bien_uso:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  anticipo_proveedor:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

const PAGO_STYLE: Record<string, string> = {
  pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  parcial:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  pagado:    'bg-green-500/10 text-green-400 border-green-500/30',
};
const PAGO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial:   'Parcial',
  pagado:    'Pagado',
};

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

async function fetchData(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  if (params.q)              q.set('q', params.q);
  if (params.tipo_operacion) q.set('tipo_operacion', params.tipo_operacion);
  if (params.proveedor_id)   q.set('proveedor_id', params.proveedor_id);
  if (params.estado_pago)    q.set('estado_pago', params.estado_pago);
  if (params.fecha_desde)    q.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta)    q.set('fecha_hasta', params.fecha_hasta);
  q.set('limit', '100');

  const [egresosRes, proveedoresRes, alertasRes] = await Promise.all([
    serverFetch(`/api/egresos?${q}`,           { cache: 'no-store' }).then(r => r.json()).catch(() => ({ egresos: [], count: 0 })),
    serverFetch('/api/proveedores?limit=500',   { cache: 'no-store' }).then(r => r.json()).catch(() => ({ proveedores: [] })),
    serverFetch('/api/egresos/alertas',         { cache: 'no-store' }).then(r => r.json()).catch(() => null),
  ]);

  return {
    egresos:     egresosRes.egresos    ?? [],
    count:       egresosRes.count      ?? 0,
    proveedores: proveedoresRes.proveedores ?? [],
    alertas:     alertasRes as Alerta | null,
  };
}

export const dynamic = 'force-dynamic';

export default async function GastosPage({
  searchParams,
}: {
  searchParams: { q?: string; tipo_operacion?: string; proveedor_id?: string; estado_pago?: string; fecha_desde?: string; fecha_hasta?: string };
}) {
  requireAuth('/gastos');
  const { egresos, count, proveedores, alertas } = await fetchData(searchParams);
  const hayFiltros = !!(searchParams.q || searchParams.tipo_operacion || searchParams.proveedor_id || searchParams.estado_pago || searchParams.fecha_desde || searchParams.fecha_hasta);

  const totalOblig = alertas?.obligaciones_pendientes?.length ?? 0;
  const totalVenc = (alertas?.vencimientos_egresos?.length ?? 0) + (alertas?.vencimientos_cheques?.length ?? 0);

  return (
    <section className="space-y-5">

      {/* Alerta crítica de cierre */}
      {alertas?.bloqueo_cierre && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-kp-red/40 bg-kp-red/10">
          <svg className="w-5 h-5 text-kp-red flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-bold text-kp-red">Período incompleto — no se puede cerrar</p>
            <p className="text-xs text-kp-red/80 mt-0.5">
              Faltan cargar {totalOblig} obligacion{totalOblig !== 1 ? 'es' : ''} del mes:{' '}
              {alertas.obligaciones_pendientes.map(o => (
                <span key={o.id} className="font-semibold">{o.descripcion} ({MESES[o.periodo_mes]}/{o.periodo_anio})</span>
              )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
            </p>
          </div>
        </div>
      )}

      {/* Alerta de vencimientos próximos */}
      {totalVenc > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-bold text-amber-400">
              {totalVenc} vencimiento{totalVenc !== 1 ? 's' : ''} próximo{totalVenc !== 1 ? 's' : ''} (próximos 7 días)
            </p>
            <div className="text-xs text-amber-400/80 mt-0.5 space-y-0.5">
              {alertas?.vencimientos_egresos?.map(v => (
                <p key={v.id}>
                  · {new Date(v.fecha_vencimiento_pago).toLocaleDateString('es-AR')} — {v.descripcion} {v.proveedor_nombre ? `(${v.proveedor_nombre})` : ''} — {fmt(v.total)}
                </p>
              ))}
              {alertas?.vencimientos_cheques?.map((c, i) => (
                <p key={i}>
                  · Cheque {c.banco} Nº {c.numero_cheque} vence {new Date(c.fecha_vencimiento).toLocaleDateString('es-AR')} — {fmt(c.importe)}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Egresos</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {count} {count === 1 ? 'registro' : 'registros'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </p>
        </div>
        <Link
          href="/gastos/nuevo"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Egreso
        </Link>
      </div>

      {/* Filtros */}
      <Suspense>
        <FiltrosGastos proveedores={proveedores} />
      </Suspense>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Comprobante</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Proveedor</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Sucursal</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Rubro</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Total</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Pago</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {egresos.map((e: Egreso) => {
              const fecha = new Date(e.fecha_emision).toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              });
              const comprobante = e.tipo_comprobante
                ? `${e.tipo_comprobante.replace('_', ' ').toUpperCase()} ${e.punto_venta ? e.punto_venta + '-' : ''}${e.numero_comprobante ?? ''}`
                : null;

              return (
                <tr key={e.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">{fecha}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TIPO_COLOR[e.tipo_operacion] ?? 'bg-kp-border/20 text-kp-gray border-kp-border'}`}>
                      {TIPO_LABEL[e.tipo_operacion] ?? e.tipo_operacion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray font-mono">
                    {comprobante ?? <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {e.proveedor_nombre
                      ? <span className="font-medium text-kp-white group-hover:text-kp-red transition-colors">{e.proveedor_nombre}</span>
                      : <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{e.sucursal_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">
                    {e.subrubro_nombre
                      ? <>{e.rubro_nombre && <span className="text-kp-border">{e.rubro_nombre} / </span>}{e.subrubro_nombre}</>
                      : <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {fmt(e.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${PAGO_STYLE[e.estado_pago] ?? ''}`}>
                      {PAGO_LABEL[e.estado_pago] ?? e.estado_pago}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/gastos/${e.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent hover:border-kp-border hover:bg-kp-surface2"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {egresos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-kp-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <p className="text-kp-gray text-sm">
                      {hayFiltros ? 'No hay egresos que coincidan con los filtros.' : 'No hay egresos registrados todavía.'}
                    </p>
                    {!hayFiltros && (
                      <p className="text-kp-gray/50 text-xs">Usá el botón "Nuevo Egreso" para registrar el primero.</p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
