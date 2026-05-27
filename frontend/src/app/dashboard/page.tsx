import Link from 'next/link';
import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';

type DashboardData = {
  ventas_hoy:         { cantidad: number; monto: number };
  ventas_mes:         { cantidad: number; monto: number };
  egresos_hoy:        { monto: number };
  egresos_mes:        { monto: number };
  resultado_hoy:      number;
  resultado_mes:      number;
  stock_bajo:         number;
  pedidos_pendientes: number;
  ultimas_ventas: {
    id: string; numero: number; total: string;
    fecha: string; estado: string; cliente: string | null;
  }[];
};

const $ = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const pct = (a: number, b: number) => {
  if (b === 0) return null;
  const v = ((a - b) / Math.abs(b)) * 100;
  return { valor: v, sube: v >= 0 };
};

function Tarjeta({
  titulo, valor, sub, href, alerta,
}: {
  titulo: string;
  valor: string;
  sub?: React.ReactNode;
  href?: string;
  alerta?: boolean;
}) {
  const inner = (
    <div className={[
      'rounded-xl border p-5 flex flex-col gap-1 transition-colors',
      alerta
        ? 'bg-kp-red/10 border-kp-red/40'
        : 'bg-kp-surface border-kp-border',
      href ? 'hover:border-kp-red/60 cursor-pointer' : '',
    ].join(' ')}>
      <p className="text-xs font-semibold uppercase tracking-widest text-kp-gray">{titulo}</p>
      <p className={['text-2xl font-bold', alerta ? 'text-kp-red' : 'text-kp-white'].join(' ')}>{valor}</p>
      {sub && <p className="text-xs text-kp-gray mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Badge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    confirmada: 'bg-green-500/15 text-green-400',
    facturada:  'bg-blue-500/15  text-blue-400',
    preventa:   'bg-yellow-500/15 text-yellow-400',
    anulada:    'bg-kp-red/15    text-kp-red',
  };
  return (
    <span className={['text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', map[estado] ?? 'bg-kp-surface2 text-kp-gray'].join(' ')}>
      {estado}
    </span>
  );
}

export default async function DashboardPage() {
  requireAuth();

  const res = await serverFetch('/api/dashboard');
  const d: DashboardData = res.ok ? await res.json() : null;

  if (!d) {
    return (
      <div className="p-8 text-kp-gray">No se pudo cargar el dashboard.</div>
    );
  }

  const margenHoy = d.ventas_hoy.monto > 0
    ? ((d.resultado_hoy / d.ventas_hoy.monto) * 100).toFixed(1)
    : '0';
  const margenMes = d.ventas_mes.monto > 0
    ? ((d.resultado_mes / d.ventas_mes.monto) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-kp-white">Dashboard</h1>
        <p className="text-sm text-kp-gray mt-0.5">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Alertas */}
      {(d.stock_bajo > 0 || d.pedidos_pendientes > 0) && (
        <div className="flex flex-wrap gap-3">
          {d.stock_bajo > 0 && (
            <Link href="/articulos" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red/10 border border-kp-red/40 text-kp-red text-sm font-semibold hover:bg-kp-red/20 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {d.stock_bajo} artículo{d.stock_bajo !== 1 ? 's' : ''} con stock bajo
            </Link>
          )}
          {d.pedidos_pendientes > 0 && (
            <Link href="/pedidos-proveedores" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 text-sm font-semibold hover:bg-yellow-500/20 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              {d.pedidos_pendientes} pedido{d.pedidos_pendientes !== 1 ? 's' : ''} pendiente{d.pedidos_pendientes !== 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* Tarjetas del día */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-kp-gray mb-3">Hoy</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tarjeta
            titulo="Ventas"
            valor={$(d.ventas_hoy.monto)}
            sub={`${d.ventas_hoy.cantidad} operación${d.ventas_hoy.cantidad !== 1 ? 'es' : ''}`}
            href="/ventas"
          />
          <Tarjeta
            titulo="Egresos"
            valor={$(d.egresos_hoy.monto)}
            href="/gastos"
          />
          <Tarjeta
            titulo="Resultado"
            valor={$(d.resultado_hoy)}
            alerta={d.resultado_hoy < 0}
          />
          <Tarjeta
            titulo="Margen"
            valor={`${margenHoy}%`}
            alerta={parseFloat(margenHoy) < 0}
          />
        </div>
      </section>

      {/* Tarjetas del mes */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-kp-gray mb-3">Este mes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tarjeta
            titulo="Ventas"
            valor={$(d.ventas_mes.monto)}
            sub={`${d.ventas_mes.cantidad} operación${d.ventas_mes.cantidad !== 1 ? 'es' : ''}`}
            href="/ventas"
          />
          <Tarjeta
            titulo="Egresos"
            valor={$(d.egresos_mes.monto)}
            href="/gastos"
          />
          <Tarjeta
            titulo="Resultado"
            valor={$(d.resultado_mes)}
            alerta={d.resultado_mes < 0}
          />
          <Tarjeta
            titulo="Margen"
            valor={`${margenMes}%`}
            alerta={parseFloat(margenMes) < 0}
          />
        </div>
      </section>

      {/* Últimas ventas */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Últimas ventas</h2>
          <Link href="/ventas" className="text-xs text-kp-red hover:underline font-semibold">Ver todas →</Link>
        </div>
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kp-border bg-kp-surface">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-kp-gray">#</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-kp-gray">Cliente</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-kp-gray">Estado</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-kp-gray">Total</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-kp-gray">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {d.ultimas_ventas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-kp-gray text-sm">
                    No hay ventas registradas aún.
                  </td>
                </tr>
              )}
              {d.ultimas_ventas.map(v => (
                <tr key={v.id} className="hover:bg-kp-surface transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/ventas/${v.id}`} className="font-mono font-bold text-kp-red hover:underline">
                      #{v.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-kp-white">{v.cliente ?? <span className="text-kp-gray italic">Consumidor final</span>}</td>
                  <td className="px-4 py-3"><Badge estado={v.estado} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-kp-white">{$(parseFloat(v.total))}</td>
                  <td className="px-4 py-3 text-right text-kp-gray whitespace-nowrap">
                    {new Date(v.fecha).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
