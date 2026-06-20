import FiltrosEstadoResultados from './FiltrosEstadoResultados';
import PrintButton from './PrintButton';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Subrubro {
  subrubro_id: string;
  subrubro:    string;
  monto:       number;
  cantidad:    number;
  es_cero:     boolean;
}
interface Rubro {
  rubro_id:    string;
  rubro:       string;
  rubro_orden: number;
  total:       number;
  subrubros:   Subrubro[];
}
interface ERData {
  periodo:  { desde: string; hasta: string };
  ingresos: {
    ventas_brutas:   number;
    descuentos:      number;
    notas_credito:   number;
    ventas_netas:    number;
    cantidad_ventas: number;
  };
  costo_mercaderia: {
    costo_vendido:    number;
    utilidad_bruta:   number;
    margen_bruto_pct: number;
  };
  gastos: {
    rubros:       Rubro[];
    total_gastos: number;
  };
  resultado: {
    resultado_periodo: number;
    margen_pct:        number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const fmt  = (n: number) => ars.format(n);
const fmtParen = (n: number) => n === 0 ? '$ —' : `(${ars.format(n)})`;

function fmtMes(iso: string) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = iso.split('-');
  return `${meses[parseInt(m) - 1]} ${y}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Fila de sección (título principal en negrita) */
function SeccionHeader({ titulo }: { titulo: string }) {
  return (
    <tr className="bg-kp-surface2/60">
      <td colSpan={2} className="px-5 py-2 text-xs font-black uppercase tracking-widest text-kp-gray">
        {titulo}
      </td>
    </tr>
  );
}

/** Fila de línea simple */
function Linea({
  label, valor, nivel = 1, cero = false, negativo = false, italic = false
}: {
  label: string; valor: number; nivel?: number;
  cero?: boolean; negativo?: boolean; italic?: boolean;
}) {
  const textCls = cero
    ? 'text-kp-gray/40'
    : negativo ? 'text-kp-white' : 'text-kp-white';
  const valCls = cero
    ? 'text-kp-gray/40'
    : negativo ? 'text-orange-300' : 'text-kp-white';

  return (
    <tr className={['border-b border-kp-border/30 hover:bg-kp-surface2/30 transition-colors', cero ? 'opacity-60' : ''].join(' ')}>
      <td className={['px-5 py-1.5 text-sm', textCls, italic ? 'italic' : ''].join(' ')}
          style={{ paddingLeft: `${nivel * 20 + 8}px` }}>
        {label}
      </td>
      <td className={['px-5 py-1.5 text-sm text-right tabular-nums', valCls].join(' ')}>
        {cero ? '$ —' : negativo ? fmtParen(valor) : fmt(valor)}
      </td>
    </tr>
  );
}

/** Fila de subtotal (bold, con fondo) */
function Subtotal({
  label, valor, positivo = true, grande = false
}: {
  label: string; valor: number; positivo?: boolean; grande?: boolean;
}) {
  const esPositivo = valor >= 0;
  const valorCls = grande
    ? esPositivo ? 'text-emerald-400' : 'text-red-400'
    : 'text-kp-white';

  return (
    <tr className={['border-b-2 border-kp-border', grande ? 'bg-kp-surface2' : 'bg-kp-surface2/40'].join(' ')}>
      <td className={['px-5 py-2.5 font-bold', grande ? 'text-base' : 'text-sm'].join(' ')}
          style={{ paddingLeft: grande ? 20 : 28 }}>
        <span className="text-kp-white">{label}</span>
      </td>
      <td className={['px-5 py-2.5 text-right tabular-nums font-bold', grande ? 'text-base' : 'text-sm', valorCls].join(' ')}>
        {fmt(valor)}
      </td>
    </tr>
  );
}

/** Separador visual */
function Separador() {
  return <tr><td colSpan={2} className="py-1" /></tr>;
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function EstadoResultados({
  data, fechaDesde, fechaHasta,
}: {
  data: ERData; fechaDesde: string; fechaHasta: string;
}) {
  const { ingresos, costo_mercaderia, gastos, resultado } = data;
  const mismoPeriodo = fechaDesde.slice(0, 7) === fechaHasta.slice(0, 7);
  const tituloPeriodo = mismoPeriodo
    ? fmtMes(fechaDesde)
    : `${fechaDesde} — ${fechaHasta}`;

  return (
    <div className="flex flex-col gap-6">

      {/* Filtros */}
      <FiltrosEstadoResultados fechaDesde={fechaDesde} fechaHasta={fechaHasta} />

      {/* Documento P&L */}
      <div className="rounded-xl border border-kp-border overflow-hidden print:border-0 print:rounded-none" id="er-print">

        {/* Encabezado del documento */}
        <div className="bg-kp-surface2 px-6 py-5 border-b border-kp-border flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-kp-gray mb-0.5">
              King Pack
            </p>
            <h2 className="text-xl font-black text-kp-white tracking-tight">
              Estado de Resultados
            </h2>
            <p className="text-sm text-kp-gray mt-0.5">{tituloPeriodo}</p>
          </div>
          <PrintButton />
        </div>

        {/* Tabla P&L */}
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-kp-border">
              <th className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-kp-gray">
                Concepto
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray w-48">
                Importe
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ══════════════════════════════════════════════════
                I. INGRESOS POR VENTAS
            ══════════════════════════════════════════════════ */}
            <SeccionHeader titulo="I. Ingresos por Ventas" />

            <Linea
              label={`Ventas Brutas (${ingresos.cantidad_ventas} ventas)`}
              valor={ingresos.ventas_brutas}
              nivel={1}
              cero={ingresos.ventas_brutas === 0}
            />
            <Linea
              label="(−) Descuentos otorgados"
              valor={ingresos.descuentos}
              nivel={1}
              cero={ingresos.descuentos === 0}
              negativo={ingresos.descuentos > 0}
              italic
            />
            <Linea
              label="(−) Notas de Crédito / Devoluciones"
              valor={ingresos.notas_credito}
              nivel={1}
              cero={ingresos.notas_credito === 0}
              negativo={ingresos.notas_credito > 0}
              italic
            />

            <Subtotal label="= Ventas Netas del Período" valor={ingresos.ventas_netas} />
            <Separador />

            {/* ══════════════════════════════════════════════════
                II. COSTO DE MERCADERÍA VENDIDA → UTILIDAD BRUTA
            ══════════════════════════════════════════════════ */}
            <SeccionHeader titulo="II. Costo de Mercadería Vendida" />

            <Linea
              label="(−) Costo de mercadería vendida"
              valor={costo_mercaderia.costo_vendido}
              nivel={1}
              cero={costo_mercaderia.costo_vendido === 0}
              negativo={costo_mercaderia.costo_vendido > 0}
              italic
            />

            <Subtotal label="= Utilidad Bruta" valor={costo_mercaderia.utilidad_bruta} />
            <Separador />

            {/* ══════════════════════════════════════════════════
                III. EGRESOS — rubro por rubro, todos los subrubros
            ══════════════════════════════════════════════════ */}
            <SeccionHeader titulo="III. Gastos y Egresos Operativos" />

            {gastos.rubros.map(rubro => {
              const todosCero = rubro.subrubros.every(s => s.es_cero);
              return (
                <>
                  {/* Cabecera de rubro */}
                  <tr key={`rubro-${rubro.rubro_id}`}
                      className="bg-kp-surface2/20 border-b border-kp-border/40">
                    <td className="px-5 py-2 text-sm font-bold text-kp-white"
                        style={{ paddingLeft: 28 }}>
                      {rubro.rubro}
                    </td>
                    <td className={[
                      'px-5 py-2 text-sm text-right tabular-nums font-bold',
                      todosCero ? 'text-kp-gray/40' : 'text-orange-300',
                    ].join(' ')}>
                      {todosCero ? '$ —' : fmtParen(rubro.total)}
                    </td>
                  </tr>

                  {/* Subrubros */}
                  {rubro.subrubros.map(sub => (
                    <Linea
                      key={sub.subrubro_id}
                      label={sub.subrubro}
                      valor={sub.monto}
                      nivel={2}
                      cero={sub.es_cero}
                      negativo={!sub.es_cero}
                    />
                  ))}
                </>
              );
            })}

            <Subtotal label="= Total Gastos Operativos" valor={-gastos.total_gastos} />
            <Separador />

            {/* ══════════════════════════════════════════════════
                III. RESULTADO
            ══════════════════════════════════════════════════ */}
            <SeccionHeader titulo="IV. Resultado del Período" />

            <tr className="border-b border-kp-border/30">
              <td className="px-5 py-1.5 text-sm text-kp-gray" style={{ paddingLeft: 28 }}>
                Utilidad Bruta
              </td>
              <td className="px-5 py-1.5 text-sm text-right tabular-nums text-kp-white">
                {fmt(costo_mercaderia.utilidad_bruta)}
              </td>
            </tr>
            <tr className="border-b border-kp-border/30">
              <td className="px-5 py-1.5 text-sm text-kp-gray italic" style={{ paddingLeft: 28 }}>
                (−) Total Gastos Operativos
              </td>
              <td className="px-5 py-1.5 text-sm text-right tabular-nums text-orange-300">
                {fmtParen(gastos.total_gastos)}
              </td>
            </tr>

            <tr><td colSpan={2} className="py-1" /></tr>

            {/* Resultado final — grande y coloreado */}
            <tr className={[
              'border-t-2 border-b-2',
              resultado.resultado_periodo >= 0
                ? 'border-emerald-700/50 bg-emerald-950/30'
                : 'border-red-700/50 bg-red-950/30',
            ].join(' ')}>
              <td className="px-5 py-4 text-base font-black text-kp-white">
                Resultado del Período
              </td>
              <td className={[
                'px-5 py-4 text-xl font-black text-right tabular-nums',
                resultado.resultado_periodo >= 0 ? 'text-emerald-400' : 'text-red-400',
              ].join(' ')}>
                {fmt(resultado.resultado_periodo)}
              </td>
            </tr>

            {/* Margen */}
            {ingresos.ventas_netas > 0 && (
              <tr className="border-b border-kp-border/30 bg-kp-surface2/20">
                <td className="px-5 py-2 text-xs text-kp-gray" style={{ paddingLeft: 28 }}>
                  Margen sobre ventas netas
                </td>
                <td className={[
                  'px-5 py-2 text-right text-sm font-bold tabular-nums',
                  resultado.margen_pct >= 0 ? 'text-emerald-400' : 'text-red-400',
                ].join(' ')}>
                  {resultado.margen_pct > 0 ? '+' : ''}{resultado.margen_pct}%
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* Resumen de cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Ventas Netas',
            value: fmt(ingresos.ventas_netas),
            color: 'text-kp-white',
          },
          {
            label: 'Utilidad Bruta',
            value: fmt(costo_mercaderia.utilidad_bruta),
            color: costo_mercaderia.utilidad_bruta >= 0 ? 'text-emerald-400' : 'text-red-400',
            sub: `${costo_mercaderia.margen_bruto_pct > 0 ? '+' : ''}${costo_mercaderia.margen_bruto_pct}% margen bruto`,
          },
          {
            label: 'Total Egresos',
            value: fmt(gastos.total_gastos),
            color: 'text-orange-300',
          },
          {
            label: 'Resultado',
            value: fmt(resultado.resultado_periodo),
            color: resultado.resultado_periodo >= 0 ? 'text-emerald-400' : 'text-red-400',
            sub: `${resultado.margen_pct > 0 ? '+' : ''}${resultado.margen_pct}% margen`,
          },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-kp-border bg-kp-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1">{c.label}</p>
            <p className={['text-2xl font-bold tabular-nums', c.color].join(' ')}>{c.value}</p>
            {c.sub && <p className="text-xs text-kp-gray mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

    </div>
  );
}
