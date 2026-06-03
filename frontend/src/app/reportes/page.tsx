import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import FiltrosReportes from './FiltrosReportes';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Resumen {
  cantidad_ventas: number;
  total_ventas: number;
  total_descuentos: number;
  ticket_promedio: number;
  clientes_distintos: number;
}

interface DiaDato {
  dia: string;
  cantidad: number;
  monto: number;
}

interface MedioPago {
  nombre: string;
  cantidad_ventas: number;
  monto: number;
}

interface TopArticulo {
  nombre: string;
  codigo: string;
  cantidad_total: number;
  monto_total: number;
  en_ventas: number;
}

interface SucursalDato {
  sucursal: string;
  cantidad: number;
  monto: number;
}

interface ReportesData {
  periodo: { desde: string; hasta: string };
  resumen: Resumen;
  por_dia: DiaDato[];
  por_medio_pago: MedioPago[];
  top_articulos: TopArticulo[];
  por_sucursal: SucursalDato[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const fmtNum = (v: number | null) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('es-AR').format(v);
};

function fmtDia(iso: string) {
  const [y, m, d] = iso.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[parseInt(m, 10) - 1]}`;
}

function defaultDesde() {
  const hoy = new Date().toISOString().slice(0, 10);
  return hoy.slice(0, 8) + '01';
}

function defaultHasta() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components (server) ──────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-5 bg-kp-red rounded-full block" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{title}</h3>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
      <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-kp-white">{value}</p>
      {sub && <p className="text-xs text-kp-gray mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: DiaDato[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-kp-gray py-4 text-center">Sin datos para el período</p>;
  }
  const maxMonto = Math.max(...data.map(d => d.monto), 1);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-1.5" style={{ minWidth: `${data.length * 36}px` }}>
        {data.map(d => {
          const pct = (d.monto / maxMonto) * 100;
          return (
            <div key={d.dia} className="flex flex-col items-center gap-1 flex-1 group min-w-[28px] max-w-[48px]">
              {/* Bar */}
              <div className="w-full relative flex items-end justify-center" style={{ height: '100px' }}>
                <div
                  className="w-full bg-kp-red/70 group-hover:bg-kp-red rounded-t transition-colors duration-150"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 bg-kp-surface2 border border-kp-border rounded-md px-2 py-1.5 text-xs text-kp-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-center">
                  <span className="block font-bold">{fmt(d.monto)}</span>
                  <span className="block text-kp-gray">{fmtNum(d.cantidad)} ventas</span>
                </div>
              </div>
              {/* Label */}
              <span className="text-[9px] text-kp-gray rotate-45 origin-left whitespace-nowrap translate-y-1">
                {fmtDia(d.dia)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  requireAuth('/reportes');

  const fechaDesde = (searchParams.fecha_desde as string) || defaultDesde();
  const fechaHasta = (searchParams.fecha_hasta as string) || defaultHasta();

  const qs = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
  const res = await serverFetch(`/api/reportes/ventas?${qs.toString()}`);
  const data: ReportesData | null = res.ok ? await res.json() : null;

  const resumen = data?.resumen;
  const porDia = data?.por_dia ?? [];
  const porMedioPago = data?.por_medio_pago ?? [];
  const topArticulos = data?.top_articulos ?? [];
  const porSucursal = data?.por_sucursal ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-kp-white tracking-tight">Reportes de Ventas</h1>
          {data && (
            <p className="text-xs text-kp-gray mt-0.5">
              Período: {fmtDia(data.periodo.desde)} — {fmtDia(data.periodo.hasta)}
            </p>
          )}
        </div>
        <FiltrosReportes fechaDesde={fechaDesde} fechaHasta={fechaHasta} />
      </div>

      {/* Error state */}
      {!data && (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-8 text-center">
          <p className="text-kp-gray text-sm">No se pudo cargar el reporte. Intenta de nuevo.</p>
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatCard
              label="Total ventas"
              value={fmt(resumen?.total_ventas ?? 0)}
            />
            <StatCard
              label="Cant. ventas"
              value={fmtNum(resumen?.cantidad_ventas ?? 0)}
            />
            <StatCard
              label="Ticket promedio"
              value={fmt(resumen?.ticket_promedio ?? 0)}
            />
            <StatCard
              label="Descuentos"
              value={fmt(resumen?.total_descuentos ?? 0)}
            />
            <StatCard
              label="Clientes únicos"
              value={fmtNum(resumen?.clientes_distintos ?? 0)}
            />
          </div>

          {/* Bar chart — ventas por día */}
          <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
            <SectionHeader title="Ventas por día" />
            <div className="mt-4 pb-6">
              <BarChart data={porDia} />
            </div>
          </div>

          {/* Two-col section: medio de pago + por sucursal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Medio de pago */}
            <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
              <SectionHeader title="Por medio de pago" />
              {porMedioPago.length === 0 ? (
                <p className="text-sm text-kp-gray py-2">Sin datos</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-kp-border">
                      <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Medio</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Ventas</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porMedioPago.map((mp, i) => (
                      <tr
                        key={mp.nombre}
                        className={[
                          'border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors',
                          i % 2 === 0 ? '' : 'bg-kp-surface2/30',
                        ].join(' ')}
                      >
                        <td className="py-2.5 pr-3 text-kp-white font-medium">{mp.nombre}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(mp.cantidad_ventas)}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(mp.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Por sucursal — solo si hay datos */}
            {porSucursal.length > 0 && (
              <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
                <SectionHeader title="Por sucursal" />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-kp-border">
                      <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Sucursal</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Ventas</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porSucursal.map((s, i) => (
                      <tr
                        key={s.sucursal}
                        className={[
                          'border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors',
                          i % 2 === 0 ? '' : 'bg-kp-surface2/30',
                        ].join(' ')}
                      >
                        <td className="py-2.5 pr-3 text-kp-white font-medium">{s.sucursal}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(s.cantidad)}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(s.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top artículos */}
          <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
            <SectionHeader title="Top 20 artículos más vendidos" />
            {topArticulos.length === 0 ? (
              <p className="text-sm text-kp-gray py-2">Sin datos</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-kp-border">
                      <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray w-6">#</th>
                      <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Artículo</th>
                      <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray hidden md:table-cell">Código</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Cant.</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">En ventas</th>
                      <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topArticulos.map((a, i) => (
                      <tr
                        key={`${a.codigo}-${i}`}
                        className={[
                          'border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors',
                          i % 2 === 0 ? '' : 'bg-kp-surface2/30',
                        ].join(' ')}
                      >
                        <td className="py-2.5 pr-2 text-kp-gray tabular-nums text-xs">{i + 1}</td>
                        <td className="py-2.5 pr-4 text-kp-white font-medium max-w-[200px] truncate">{a.nombre}</td>
                        <td className="py-2.5 pr-4 text-kp-gray text-xs hidden md:table-cell">{a.codigo || '—'}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(a.cantidad_total)}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(a.en_ventas)}</td>
                        <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(a.monto_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
