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
            <div key={d.dia} className="flex flex-col items-center gap-1 group" style={{ flex: '1 1 0', minWidth: 28, maxWidth: 48 }}>
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

// ─── Tipos Gastos ─────────────────────────────────────────────────────────────
interface GastosResumen { cantidad_egresos: number; total_gastos: number; promedio_egreso: number; }
interface GastoRubro  { rubro: string; subrubro: string; cantidad: number; total: number; promedio: number; tipo_operacion: string; }
interface GastoDia    { dia: string; cantidad: number; total: number; }
interface GastoTipo   { tipo_operacion: string; cantidad: number; total: number; }
interface GastosData  { periodo: { desde: string; hasta: string }; resumen: GastosResumen; por_rubro: GastoRubro[]; por_dia: GastoDia[]; por_tipo: GastoTipo[]; }

const TIPO_OP_LABEL: Record<string, string> = {
  compra_mercaderia: 'Compra mercadería', compra_gasto: 'Gasto varios',
  carga_social_laboral: 'Carga social', gasto_manual: 'Gasto manual',
  inversion_bien_uso: 'Inversión', anticipo_proveedor: 'Anticipo',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  requireAuth('/reportes');

  const tab        = (searchParams.tab as string) || 'ventas';
  const fechaDesde = (searchParams.fecha_desde as string) || defaultDesde();
  const fechaHasta = (searchParams.fecha_hasta as string) || defaultHasta();

  const qs = new URLSearchParams({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });

  // Fetch según tab
  const [resV, resG] = await Promise.all([
    tab === 'ventas' ? serverFetch(`/api/reportes/ventas?${qs}`) : Promise.resolve(null),
    tab === 'gastos' ? serverFetch(`/api/reportes/gastos?${qs}`) : Promise.resolve(null),
  ]);

  const dataV: ReportesData | null = resV?.ok ? await resV.json() : null;
  const dataG: GastosData  | null = resG?.ok ? await resG.json() : null;

  const resumen      = dataV?.resumen;
  const porDia       = dataV?.por_dia       ?? [];
  const porMedioPago = dataV?.por_medio_pago ?? [];
  const topArticulos = dataV?.top_articulos  ?? [];
  const porSucursal  = dataV?.por_sucursal   ?? [];

  // Gastos agrupados por rubro (para la tabla anidada)
  const rubrosMap = new Map<string, { subrubros: GastoRubro[]; total: number }>();
  for (const r of (dataG?.por_rubro ?? [])) {
    if (!rubrosMap.has(r.rubro)) rubrosMap.set(r.rubro, { subrubros: [], total: 0 });
    const entry = rubrosMap.get(r.rubro)!;
    entry.subrubros.push(r);
    entry.total += r.total;
  }
  const rubrosOrdenados = [...rubrosMap.entries()].sort((a, b) => b[1].total - a[1].total);

  // URLs de tab
  const tabUrl = (t: string) => `/reportes?tab=${t}&fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-xl font-bold text-kp-white tracking-tight">Reportes</h1>
          <p className="text-xs text-kp-gray mt-0.5">
            Período: {fmtDia(fechaDesde)} — {fmtDia(fechaHasta)}
          </p>
        </div>
        <FiltrosReportes fechaDesde={fechaDesde} fechaHasta={fechaHasta} tab={tab} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-kp-border">
        {[
          { value: 'ventas', label: 'Ventas' },
          { value: 'gastos', label: 'Gastos' },
        ].map(t => (
          <a
            key={t.value}
            href={tabUrl(t.value)}
            className={[
              'px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === t.value
                ? 'border-kp-red text-kp-red'
                : 'border-transparent text-kp-gray hover:text-kp-white',
            ].join(' ')}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Error state */}
      {tab === 'ventas' && !dataV && (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-8 text-center">
          <p className="text-kp-gray text-sm">No se pudo cargar el reporte de ventas.</p>
        </div>
      )}
      {tab === 'gastos' && !dataG && (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-8 text-center">
          <p className="text-kp-gray text-sm">No se pudo cargar el reporte de gastos.</p>
        </div>
      )}

      {/* ══ GASTOS ══ */}
      {tab === 'gastos' && dataG && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Total gastos"      value={fmt(dataG.resumen.total_gastos)} />
            <StatCard label="Cant. egresos"     value={fmtNum(dataG.resumen.cantidad_egresos)} />
            <StatCard label="Promedio egreso"   value={fmt(dataG.resumen.promedio_egreso)} />
          </div>

          {/* Barra por día */}
          <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
            <SectionHeader title="Gastos por día" />
            <div className="mt-4 pb-6">
              {dataG.por_dia.length === 0 ? (
                <p className="text-sm text-kp-gray py-4 text-center">Sin gastos en el período</p>
              ) : (() => {
                const maxTotal = Math.max(...dataG.por_dia.map(d => d.total), 1);
                return (
                  <div className="overflow-x-auto pb-1">
                    <div className="flex items-end gap-1.5" style={{ minWidth: `${dataG.por_dia.length * 36}px` }}>
                      {dataG.por_dia.map(d => {
                        const pct = (d.total / maxTotal) * 100;
                        return (
                          <div key={d.dia} className="flex flex-col items-center gap-1 group" style={{ flex: '1 1 0', minWidth: 28, maxWidth: 48 }}>
                            <div className="w-full relative flex items-end justify-center" style={{ height: '100px' }}>
                              <div
                                className="w-full bg-amber-600/70 group-hover:bg-amber-500 rounded-t transition-colors"
                                style={{ height: `${Math.max(pct, 2)}%` }}
                              />
                              <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 bg-kp-surface2 border border-kp-border rounded-md px-2 py-1.5 text-xs text-kp-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-center">
                                <span className="block font-bold">{fmt(d.total)}</span>
                                <span className="block text-kp-gray">{fmtNum(d.cantidad)} egresos</span>
                              </div>
                            </div>
                            <span className="text-[9px] text-kp-gray rotate-45 origin-left whitespace-nowrap translate-y-1">{fmtDia(d.dia)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Tabla por rubro/subrubro */}
          <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
            <SectionHeader title="Por rubro y subrubro" />
            {rubrosOrdenados.length === 0 ? (
              <p className="text-sm text-kp-gray py-2">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {rubrosOrdenados.map(([rubro, data]) => {
                  const pctTotal = dataG.resumen.total_gastos > 0
                    ? (data.total / dataG.resumen.total_gastos) * 100
                    : 0;
                  return (
                    <div key={rubro} className="rounded-xl border border-kp-border overflow-hidden">
                      {/* Cabecera del rubro */}
                      <div className="flex items-center justify-between px-4 py-3 bg-kp-surface2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-sm font-bold text-kp-white truncate">{rubro}</span>
                          <div className="flex-1 max-w-[160px] h-1.5 rounded-full bg-kp-border overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctTotal}%` }} />
                          </div>
                          <span className="text-xs text-kp-gray">{pctTotal.toFixed(1)}%</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-amber-400 ml-4">{fmt(data.total)}</span>
                      </div>
                      {/* Subrubros */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-kp-border/50">
                            <th className="text-left px-4 py-2 text-xs text-kp-gray uppercase tracking-wide font-semibold">Subrubro</th>
                            <th className="text-left px-4 py-2 text-xs text-kp-gray uppercase tracking-wide font-semibold">Tipo</th>
                            <th className="text-right px-4 py-2 text-xs text-kp-gray uppercase tracking-wide font-semibold">Cant.</th>
                            <th className="text-right px-4 py-2 text-xs text-kp-gray uppercase tracking-wide font-semibold">Promedio</th>
                            <th className="text-right px-4 py-2 text-xs text-kp-gray uppercase tracking-wide font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-kp-border/30">
                          {data.subrubros.map((s, i) => (
                            <tr key={i} className="hover:bg-kp-surface2 transition-colors">
                              <td className="px-4 py-2.5 text-kp-white font-medium">{s.subrubro}</td>
                              <td className="px-4 py-2.5 text-kp-gray text-xs">{TIPO_OP_LABEL[s.tipo_operacion] ?? s.tipo_operacion}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(s.cantidad)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-kp-gray">{fmt(s.promedio)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-kp-white">{fmt(s.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Total general */}
                <div className="flex justify-end items-center gap-3 pt-1">
                  <span className="text-xs text-kp-gray uppercase tracking-widest font-bold">Total período</span>
                  <span className="text-xl font-bold tabular-nums text-amber-400">{fmt(dataG.resumen.total_gastos)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Por tipo de operación */}
          {dataG.por_tipo.length > 0 && (
            <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
              <SectionHeader title="Por tipo de operación" />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kp-border">
                    <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Tipo</th>
                    <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Cant.</th>
                    <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dataG.por_tipo.map((t, i) => (
                    <tr key={i} className="border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors">
                      <td className="py-2.5 pr-3 text-kp-white font-medium">{TIPO_OP_LABEL[t.tipo_operacion] ?? t.tipo_operacion}</td>
                      <td className="py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(t.cantidad)}</td>
                      <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ VENTAS ══ */}
      {tab === 'ventas' && dataV && (
        <>
          {/* Summary cards — Ventas */}
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
