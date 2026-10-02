import Link from 'next/link';
import PrintButton from './PrintButton';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lado { cantidad: number; monto: number }

interface Bloque {
  blanco: Lado;
  negro: Lado;
  total_monto: number;
  total_cantidad: number;
  pct_blanco: number;
  pct_negro: number;
}

interface MesDato { periodo: string; blanco: number; negro: number }

interface VentaNegro {
  id: string; numero: number; fecha: string; total: number;
  cliente: string; sucursal: string | null;
}

interface CompraNegro {
  id: string; fecha: string; total: number;
  descripcion: string; tipo_operacion: string;
  proveedor: string; sucursal: string | null;
}

export interface BlancoNegroData {
  periodo: { desde: string; hasta: string };
  ventas: Bloque;
  compras: Bloque;
  ventas_por_mes: MesDato[];
  compras_por_mes: MesDato[];
  detalle_ventas_negro: VentaNegro[];
  detalle_compras_negro: CompraNegro[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmt    = (v: number | null | undefined) => (v == null || isNaN(v) ? '—' : ars.format(v));
const fmtNum = (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('es-AR').format(v));
const pct    = (v: number) => `${v.toFixed(1)}%`;

function fmtFecha(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function fmtMes(periodo: string) {
  const [y, m] = periodo.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

const TIPO_OP: Record<string, string> = {
  compra_mercaderia:    'Compra mercadería',
  compra_gasto:         'Compra / gasto',
  carga_social_laboral: 'Carga social',
  gasto_manual:         'Gasto manual',
  inversion_bien_uso:   'Bien de uso',
  anticipo_proveedor:   'Anticipo',
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-5 bg-kp-red rounded-full block" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{title}</h3>
      {sub && <span className="text-xs text-kp-gray normal-case tracking-normal">{sub}</span>}
    </div>
  );
}

/** Barra apilada blanco / negro. */
function BarraSplit({ pctBlanco }: { pctBlanco: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-kp-surface2">
      <div className="bg-emerald-500/80" style={{ width: `${pctBlanco}%` }} />
      <div className="bg-kp-red/80" style={{ width: `${100 - pctBlanco}%` }} />
    </div>
  );
}

function BloqueResumen({ titulo, b }: { titulo: string; b: Bloque }) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{titulo}</h3>
        <span className="text-xs text-kp-gray tabular-nums">
          {fmtNum(b.total_cantidad)} oper. · {fmt(b.total_monto)}
        </span>
      </div>

      <BarraSplit pctBlanco={b.pct_blanco} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 block shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">En blanco</p>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-kp-white break-all">{fmt(b.blanco.monto)}</p>
          <p className="text-xs text-kp-gray mt-0.5 tabular-nums">
            {pct(b.pct_blanco)} · {fmtNum(b.blanco.cantidad)} oper.
          </p>
        </div>

        <div className="rounded-lg border border-kp-red/30 bg-kp-red/5 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full bg-kp-red block shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-widest text-kp-red">En negro</p>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-kp-white break-all">{fmt(b.negro.monto)}</p>
          <p className="text-xs text-kp-gray mt-0.5 tabular-nums">
            {pct(b.pct_negro)} · {fmtNum(b.negro.cantidad)} oper.
          </p>
        </div>
      </div>
    </div>
  );
}

function TablaMes({ titulo, rows }: { titulo: string; rows: MesDato[] }) {
  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
      <SectionHeader title={titulo} />
      {rows.length === 0 ? (
        <p className="text-sm text-kp-gray py-2">Sin datos para el período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kp-border">
                <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Mes</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">Blanco</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-red">Negro</th>
                <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">% blanco</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const tot = r.blanco + r.negro;
                return (
                  <tr
                    key={r.periodo}
                    className={[
                      'border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors',
                      i % 2 === 0 ? '' : 'bg-kp-surface2/30',
                    ].join(' ')}
                  >
                    <td className="py-2.5 pr-3 text-kp-white font-medium whitespace-nowrap">{fmtMes(r.periodo)}</td>
                    <td className="py-2.5 text-right tabular-nums text-kp-white">{fmt(r.blanco)}</td>
                    <td className="py-2.5 text-right tabular-nums text-kp-white">{fmt(r.negro)}</td>
                    <td className="py-2.5 text-right tabular-nums text-kp-gray">
                      {tot > 0 ? pct((r.blanco / tot) * 100) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function BlancoNegro({ data }: { data: BlancoNegroData }) {
  const { ventas, compras, detalle_ventas_negro: vNegro, detalle_compras_negro: cNegro } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BloqueResumen titulo="Ventas" b={ventas} />
        <BloqueResumen titulo="Compras y egresos" b={compras} />
      </div>

      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <p className="text-xs text-kp-gray leading-relaxed max-w-3xl">
          <strong className="text-kp-white">Blanco</strong> en ventas = la venta tiene comprobante
          con CAE aprobado por ARCA. <strong className="text-kp-white">Blanco</strong> en compras =
          el egreso tiene cargado un comprobante fiscal (factura o nota A/B/C). Todo lo demás cuenta
          como negro. No se incluyen ventas anuladas ni preventas.
        </p>
        <PrintButton />
      </div>

      {/* Evolución mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TablaMes titulo="Ventas por mes"  rows={data.ventas_por_mes} />
        <TablaMes titulo="Compras por mes" rows={data.compras_por_mes} />
      </div>

      {/* Detalle ventas en negro */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <SectionHeader
          title="Ventas en negro"
          sub={vNegro.length >= 300 ? '(primeras 300)' : undefined}
        />
        {vNegro.length === 0 ? (
          <p className="text-sm text-kp-gray py-2">Todas las ventas del período están facturadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table data-rt="1" className="w-full text-sm">
              <thead>
                <tr className="border-b border-kp-border">
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">N°</th>
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Fecha</th>
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Cliente</th>
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray hidden md:table-cell">Sucursal</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Total</th>
                </tr>
              </thead>
              <tbody>
                {vNegro.map((v, i) => (
                  <tr
                    key={v.id}
                    className={[
                      'border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors',
                      i % 2 === 0 ? '' : 'bg-kp-surface2/30',
                    ].join(' ')}
                  >
                    <td className="py-2.5 pr-3">
                      <Link href={`/ventas/${v.id}`} className="text-kp-red hover:underline font-semibold tabular-nums">
                        {v.numero}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-kp-gray tabular-nums whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                    <td className="py-2.5 pr-3 text-kp-white max-w-[220px] truncate">{v.cliente}</td>
                    <td className="py-2.5 pr-3 text-kp-gray text-xs hidden md:table-cell">{v.sucursal || '—'}</td>
                    <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle compras sin comprobante */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <SectionHeader
          title="Compras y egresos sin comprobante"
          sub={cNegro.length >= 300 ? '(primeras 300)' : undefined}
        />
        {cNegro.length === 0 ? (
          <p className="text-sm text-kp-gray py-2">Todos los egresos del período tienen comprobante.</p>
        ) : (
          <div className="overflow-x-auto">
            <table data-rt="1" className="w-full text-sm">
              <thead>
                <tr className="border-b border-kp-border">
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Fecha</th>
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Proveedor</th>
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Descripción</th>
                  <th className="text-left  py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray hidden md:table-cell">Tipo</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase tracking-widest text-kp-gray">Total</th>
                </tr>
              </thead>
              <tbody>
                {cNegro.map((e, i) => (
                  <tr
                    key={e.id}
                    className={[
                      'border-b border-kp-border/50 hover:bg-kp-surface2 transition-colors',
                      i % 2 === 0 ? '' : 'bg-kp-surface2/30',
                    ].join(' ')}
                  >
                    <td className="py-2.5 pr-3 text-kp-gray tabular-nums whitespace-nowrap">{fmtFecha(e.fecha)}</td>
                    <td className="py-2.5 pr-3 text-kp-white max-w-[180px] truncate">{e.proveedor}</td>
                    <td className="py-2.5 pr-3 text-kp-gray max-w-[260px] truncate">
                      <Link href={`/gastos/${e.id}`} className="hover:text-kp-white hover:underline">
                        {e.descripcion}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-kp-gray text-xs hidden md:table-cell whitespace-nowrap">
                      {TIPO_OP[e.tipo_operacion] || e.tipo_operacion}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-kp-white font-semibold">{fmt(e.total)}</td>
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
