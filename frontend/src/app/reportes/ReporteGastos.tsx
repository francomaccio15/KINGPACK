import FiltrosGastosReporte from './FiltrosGastosReporte';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Resumen {
  cantidad_egresos: number;
  total_gastos:     number;
  promedio:         number;
  total_pagado:     number;
  total_pendiente:  number;
}

interface Subrubro {
  subrubro:    string;
  subrubro_id: string | null;
  monto:       number;
  cantidad:    number;
}

interface RubroAgrupado {
  rubro:      string;
  rubro_id:   string | null;
  monto:      number;
  cantidad:   number;
  porcentaje: number;
  subrubros:  Subrubro[];
}

interface DiaDato {
  dia:      string;
  cantidad: number;
  monto:    number;
}

interface SucursalDato {
  sucursal: string;
  cantidad: number;
  monto:    number;
}

interface Rubro {
  id:     string;
  nombre: string;
}

interface EgresoDetalle {
  id:          string;
  fecha:       string;
  rubro:       string;
  subrubro:    string;
  proveedor:   string;
  descripcion: string | null;
  monto:       number;
  estado_pago: string;
  sucursal:    string;
}

interface GastosData {
  periodo:      { desde: string; hasta: string };
  resumen:      Resumen;
  por_rubro:    RubroAgrupado[];
  por_dia:      DiaDato[];
  por_sucursal: SucursalDato[];
  rubros:       Rubro[];
  detalle:      EgresoDetalle[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt = (v: number | null) => (v == null || isNaN(v)) ? '—' : ars.format(v);
const fmtNum = (v: number | null) => (v == null) ? '—' : new Intl.NumberFormat('es-AR').format(v);

function fmtDia(iso: string) {
  const [y, m, d] = iso.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[parseInt(m, 10) - 1]}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-5 bg-kp-red rounded-full block" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{title}</h3>
    </div>
  );
}

function StatCard({ label, value, sub, alerta }: { label: string; value: string; sub?: string; alerta?: boolean }) {
  return (
    <div className={['rounded-xl border p-4', alerta ? 'bg-red-950/30 border-red-800/40' : 'bg-kp-surface border-kp-border'].join(' ')}>
      <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className={['text-2xl font-bold tabular-nums', alerta ? 'text-red-400' : 'text-kp-white'].join(' ')}>{value}</p>
      {sub && <p className="text-xs text-kp-gray mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: DiaDato[] }) {
  if (!data.length) return <p className="text-sm text-kp-gray py-4 text-center">Sin datos para el período</p>;
  const maxMonto = Math.max(...data.map(d => d.monto), 1);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-1.5" style={{ minWidth: `${data.length * 36}px` }}>
        {data.map(d => {
          const pct = (d.monto / maxMonto) * 100;
          return (
            <div key={d.dia} className="flex flex-col items-center gap-1 group" style={{ flex: '1 1 0', minWidth: 28, maxWidth: 48 }}>
              <div className="w-full relative flex items-end justify-center" style={{ height: 100 }}>
                <div
                  className="w-full bg-orange-600/60 group-hover:bg-orange-500 rounded-t transition-colors"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 bg-kp-surface2 border border-kp-border rounded-md px-2 py-1.5 text-xs text-kp-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-center">
                  <span className="block font-bold">{fmt(d.monto)}</span>
                  <span className="block text-kp-gray">{fmtNum(d.cantidad)} egreso{d.cantidad !== 1 ? 's' : ''}</span>
                </div>
              </div>
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

const BADGE_PAGO: Record<string, string> = {
  pagado:   'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  pendiente:'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  parcial:  'bg-blue-900/40 text-blue-300 border-blue-700/40',
};

// ─── Main component ────────────────────────────────────────────────────────────
export default function ReporteGastos({
  data,
  fechaDesde,
  fechaHasta,
  rubroId,
}: {
  data: GastosData;
  fechaDesde: string;
  fechaHasta: string;
  rubroId?: string;
}) {
  const { resumen, por_rubro, por_dia, por_sucursal, rubros, detalle } = data;
  const totalGastos = resumen.total_gastos ?? 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Filtros */}
      <FiltrosGastosReporte
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        rubroId={rubroId}
        rubros={rubros}
      />

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Total gastos"    value={fmt(totalGastos)} />
        <StatCard label="Cant. egresos"   value={fmtNum(resumen.cantidad_egresos)} />
        <StatCard label="Promedio"        value={fmt(resumen.promedio)} />
        <StatCard label="Pagado"          value={fmt(resumen.total_pagado)}
          sub={totalGastos > 0 ? `${((resumen.total_pagado / totalGastos) * 100).toFixed(0)}% del total` : undefined} />
        <StatCard label="Pendiente"       value={fmt(resumen.total_pendiente)}
          alerta={resumen.total_pendiente > 0}
          sub={totalGastos > 0 ? `${((resumen.total_pendiente / totalGastos) * 100).toFixed(0)}% del total` : undefined} />
      </div>

      {/* Gráfico por día */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <SectionHeader title="Gastos por día" />
        <div className="mt-4 pb-6">
          <BarChart data={por_dia} />
        </div>
      </div>

      {/* Por rubro */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <SectionHeader title="Por rubro" />
        {por_rubro.length === 0 ? (
          <p className="text-sm text-kp-gray py-2">Sin datos</p>
        ) : (
          <div className="space-y-3 mt-2">
            {por_rubro.map(r => (
              <div key={r.rubro_id ?? r.rubro} className="space-y-1">
                {/* Fila rubro */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-bold text-kp-white">{r.rubro}</span>
                      <span className="text-sm font-bold text-kp-white tabular-nums">{fmt(r.monto)}</span>
                    </div>
                    {/* Barra proporcional */}
                    <div className="h-2 rounded-full bg-kp-surface2 overflow-hidden">
                      <div
                        className="h-full bg-kp-red rounded-full transition-all"
                        style={{ width: `${r.porcentaje}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-kp-gray w-12 text-right tabular-nums">{r.porcentaje}%</span>
                </div>
                {/* Subrubros */}
                {r.subrubros.length > 0 && (
                  <div className="ml-4 space-y-0.5">
                    {r.subrubros.map(s => (
                      <div key={s.subrubro_id ?? s.subrubro} className="flex justify-between text-xs text-kp-gray">
                        <span>{s.subrubro} <span className="opacity-50">({fmtNum(s.cantidad)})</span></span>
                        <span className="tabular-nums">{fmt(s.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Por sucursal */}
      {por_sucursal.length > 0 && (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
          <SectionHeader title="Por sucursal" />
          <table className="w-full text-sm mt-1">
            <thead>
              <tr className="border-b border-kp-border">
                <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Sucursal</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Egresos</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Monto</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">%</th>
              </tr>
            </thead>
            <tbody>
              {por_sucursal.map((s, i) => (
                <tr key={s.sucursal} className={['border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors', i % 2 === 0 ? '' : 'bg-kp-surface2/30'].join(' ')}>
                  <td className="py-2.5 text-kp-white font-medium">{s.sucursal}</td>
                  <td className="py-2.5 text-right tabular-nums text-kp-gray">{fmtNum(s.cantidad)}</td>
                  <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(s.monto)}</td>
                  <td className="py-2.5 text-right tabular-nums text-kp-gray text-xs">
                    {totalGastos > 0 ? `${((s.monto / totalGastos) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <SectionHeader title={`Detalle de egresos (${fmtNum(detalle.length)})`} />
        {detalle.length === 0 ? (
          <p className="text-sm text-kp-gray py-2">Sin egresos en el período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kp-border">
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Fecha</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Rubro / Subrubro</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray hidden md:table-cell">Proveedor / Desc.</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray hidden lg:table-cell">Sucursal</th>
                  <th className="text-center py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Estado</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Monto</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((e, i) => (
                  <tr key={e.id} className={['border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors', i % 2 === 0 ? '' : 'bg-kp-surface2/30'].join(' ')}>
                    <td className="py-2.5 text-kp-gray text-xs whitespace-nowrap pr-3">{fmtDia(e.fecha)}</td>
                    <td className="py-2.5 pr-4">
                      <p className="text-kp-white text-xs font-semibold">{e.rubro}</p>
                      <p className="text-kp-gray text-xs">{e.subrubro}</p>
                    </td>
                    <td className="py-2.5 pr-4 hidden md:table-cell max-w-[200px]">
                      <p className="text-kp-white text-xs truncate">{e.proveedor}</p>
                      {e.descripcion && <p className="text-kp-gray text-xs truncate">{e.descripcion}</p>}
                    </td>
                    <td className="py-2.5 text-kp-gray text-xs hidden lg:table-cell">{e.sucursal}</td>
                    <td className="py-2.5 text-center">
                      <span className={['inline-block px-2 py-0.5 text-xs font-semibold rounded border', BADGE_PAGO[e.estado_pago] ?? 'bg-zinc-800 text-zinc-400 border-zinc-600'].join(' ')}>
                        {e.estado_pago}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(e.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
