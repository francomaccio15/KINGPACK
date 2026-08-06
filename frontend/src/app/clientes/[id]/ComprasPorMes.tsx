// Panel de compras del cliente por mes (últimos 12 meses). Server component:
// solo muestra datos, sin interactividad. Destaca el total del mes actual y grafica
// cada mes con una barra + el monto visible, para que se lea de un vistazo.

interface MesCompra { mes: string; total: number; cantidad: number }

const arsCompacto = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
});
const fmt = (n: number) => arsCompacto.format(Number.isFinite(n) ? n : 0);

const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// 'YYYY-MM' → etiqueta corta ("ago 26"), sin pasar por Date para no correr zonas.
function etiquetaMes(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_ABBR[(parseInt(m, 10) || 1) - 1]} ${y.slice(2)}`;
}
function etiquetaMesLargo(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_LARGO[(parseInt(m, 10) || 1) - 1]} ${y}`;
}

export default function ComprasPorMes({ meses }: { meses: MesCompra[] }) {
  if (!meses || meses.length === 0) return null;

  const actual   = meses[meses.length - 1];               // el mes en curso (último)
  const anterior = meses[meses.length - 2];               // mes pasado
  const conCompras = meses.filter(m => m.total > 0);
  const totalAnual = meses.reduce((s, m) => s + m.total, 0);
  const promedio   = conCompras.length > 0 ? totalAnual / conCompras.length : 0;
  const maxTotal   = Math.max(...meses.map(m => m.total), 1);

  // Variación del mes actual vs el anterior (solo si el anterior tuvo compras).
  const variacion = anterior && anterior.total > 0
    ? ((actual.total - anterior.total) / anterior.total) * 100
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-1 h-4 bg-kp-red rounded-full block" />
        <h3 className="font-bold uppercase tracking-wide text-sm">Compras por mes</h3>
        <span className="text-xs text-kp-gray">(últimos 12 meses)</span>
      </div>

      <div className="rounded-xl bg-kp-surface border border-kp-border p-5 space-y-5">

        {/* Resumen: mes actual destacado + contexto */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-kp-red/30 bg-kp-red/5 px-4 py-3">
            <p className="text-[10px] text-kp-red uppercase tracking-widest font-bold mb-1">
              {etiquetaMesLargo(actual.mes)}
            </p>
            <p className="text-2xl font-bold tabular-nums text-kp-white">{fmt(actual.total)}</p>
            <p className="text-[10px] text-kp-gray mt-1">
              {actual.cantidad > 0 ? `${actual.cantidad} compra${actual.cantidad === 1 ? '' : 's'} este mes` : 'sin compras este mes'}
              {variacion !== null && (
                <span className={variacion >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {'  ·  '}{variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(0)}% vs mes pasado
                </span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-kp-border bg-kp-surface2/40 px-4 py-3">
            <p className="text-[10px] text-kp-gray uppercase tracking-widest font-bold mb-1">Promedio mensual</p>
            <p className="text-xl font-bold tabular-nums text-kp-white">{fmt(promedio)}</p>
            <p className="text-[10px] text-kp-gray mt-1">meses con compras</p>
          </div>

          <div className="col-span-2 md:col-span-1 rounded-xl border border-kp-border bg-kp-surface2/40 px-4 py-3">
            <p className="text-[10px] text-kp-gray uppercase tracking-widest font-bold mb-1">Total 12 meses</p>
            <p className="text-xl font-bold tabular-nums text-kp-white">{fmt(totalAnual)}</p>
            <p className="text-[10px] text-kp-gray mt-1">{conCompras.length} de 12 meses con compras</p>
          </div>
        </div>

        {/* Barras por mes */}
        <div className="space-y-1.5">
          {meses.map((m, i) => {
            const esActual = i === meses.length - 1;
            const ancho = m.total > 0 ? Math.max((m.total / maxTotal) * 100, 2) : 0;
            return (
              <div key={m.mes} className="flex items-center gap-3">
                <span className={`w-14 shrink-0 text-[11px] tabular-nums ${esActual ? 'text-kp-white font-semibold' : 'text-kp-gray'}`}>
                  {etiquetaMes(m.mes)}
                </span>
                <div className="flex-1 h-5 rounded bg-kp-surface2/60 overflow-hidden">
                  {ancho > 0 && (
                    <div
                      className={`h-full rounded ${esActual ? 'bg-kp-red' : 'bg-kp-red/40'}`}
                      style={{ width: `${ancho}%` }}
                    />
                  )}
                </div>
                <span className={`w-24 shrink-0 text-right text-xs tabular-nums ${
                  m.total > 0 ? (esActual ? 'text-kp-white font-bold' : 'text-kp-gray-lt') : 'text-kp-border'}`}>
                  {m.total > 0 ? fmt(m.total) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
