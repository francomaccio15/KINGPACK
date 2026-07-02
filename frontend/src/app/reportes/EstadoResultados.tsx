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
interface Categoria {
  categoria_id: string;
  categoria:    string;
  orden:        number;
  seccion:      string;
  total:        number;
  rubros:       Rubro[];
}
interface ERData {
  cierre_pendiente: false;
  anio: number;
  mes:  number;
  periodo:  { desde: string; hasta: string };
  ingresos: {
    ventas_brutas:   number;
    descuentos:      number;
    notas_credito:   number;
    ventas_netas:    number;
    cantidad_ventas: number;
  };
  costo_mercaderia: {
    costo_bruto:      number;
    costo_devuelto:   number;
    costo_vendido:    number;
    utilidad_bruta:   number;
    margen_bruto_pct: number;
  };
  gastos: {
    categorias: Categoria[];
    total:      number;
  };
  utilidad_neta_producto: number;
  retiros: {
    categorias: Categoria[];
    total:      number;
  };
  resultado_acumulado: {
    acumulado_anterior: number;
    total:              number;
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
  const textCls = cero ? 'text-kp-gray/40' : 'text-kp-white';
  const valCls  = cero ? 'text-kp-gray/40' : negativo ? 'text-orange-300' : 'text-kp-white';

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

/** Cabecera de categoría de gasto (negrita, con total) */
function CategoriaHeader({ nombre, total }: { nombre: string; total: number }) {
  const cero = total === 0;
  return (
    <tr className="bg-kp-surface2/20 border-b border-kp-border/40">
      <td className="px-5 py-2 text-sm font-bold text-kp-white" style={{ paddingLeft: 28 }}>
        {nombre}
      </td>
      <td className={['px-5 py-2 text-sm text-right tabular-nums font-bold', cero ? 'text-kp-gray/40' : 'text-orange-300'].join(' ')}>
        {cero ? '$ —' : fmtParen(total)}
      </td>
    </tr>
  );
}

/** Fila de subtotal (bold, con fondo) */
function Subtotal({
  label, valor, grande = false
}: {
  label: string; valor: number; grande?: boolean;
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

function Separador() {
  return <tr><td colSpan={2} className="py-1" /></tr>;
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function EstadoResultados({
  data, fechaDesde, fechaHasta,
}: {
  data: ERData; fechaDesde: string; fechaHasta: string;
}) {
  const { ingresos, costo_mercaderia, gastos, retiros, resultado_acumulado } = data;
  const mismoPeriodo = fechaDesde.slice(0, 7) === fechaHasta.slice(0, 7);
  const tituloPeriodo = mismoPeriodo ? fmtMes(fechaDesde) : `${fechaDesde} — ${fechaHasta}`;

  return (
    <div className="flex flex-col gap-6">

      <FiltrosEstadoResultados fechaDesde={fechaDesde} fechaHasta={fechaHasta} />

      <div className="rounded-xl border border-kp-border overflow-hidden print:border-0 print:rounded-none" id="er-print">

        {/* Encabezado */}
        <div className="bg-kp-surface2 px-6 py-5 border-b border-kp-border flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-kp-gray mb-0.5">King Pack</p>
            <h2 className="text-xl font-black text-kp-white tracking-tight">Estado de Resultados</h2>
            <p className="text-sm text-kp-gray mt-0.5">{tituloPeriodo}</p>
          </div>
          <PrintButton />
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-kp-border">
              <th className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-kp-gray">Concepto</th>
              <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray w-48">Importe</th>
            </tr>
          </thead>

          <tbody>
            {/* ─── Ingreso por ventas ─── */}
            <SeccionHeader titulo="Ingreso por Ventas" />
            <Linea label={`Ventas brutas (${ingresos.cantidad_ventas} ventas)`} valor={ingresos.ventas_brutas} cero={ingresos.ventas_brutas === 0} />
            <Linea label="(−) Descuentos otorgados" valor={ingresos.descuentos} cero={ingresos.descuentos === 0} negativo={ingresos.descuentos > 0} italic />
            <Linea label="(−) Notas de crédito / Devoluciones" valor={ingresos.notas_credito} cero={ingresos.notas_credito === 0} negativo={ingresos.notas_credito > 0} italic />
            <Subtotal label="= Ingreso por ventas (neto)" valor={ingresos.ventas_netas} />
            <Separador />

            {/* ─── Costo de mercadería vendida → Utilidad bruta ─── */}
            <SeccionHeader titulo="Costo de Mercadería Vendida" />
            <Linea label="Costo de artículos vendidos" valor={costo_mercaderia.costo_bruto} cero={costo_mercaderia.costo_bruto === 0} negativo={costo_mercaderia.costo_bruto > 0} italic />
            {costo_mercaderia.costo_devuelto > 0 && (
              <Linea label="(+) Costo de artículos devueltos" valor={costo_mercaderia.costo_devuelto} nivel={1} italic />
            )}
            <Subtotal label="= Costo de mercadería vendida (neto de notas de crédito)" valor={-costo_mercaderia.costo_vendido} />
            <Subtotal label="= UTILIDAD BRUTA" valor={costo_mercaderia.utilidad_bruta} />
            <Separador />

            {/* ─── Gastos operativos por categoría ─── */}
            <SeccionHeader titulo="Gastos Operativos" />
            {gastos.categorias.map(cat => {
              const subsNoCero = cat.rubros.flatMap(r => r.subrubros.filter(s => !s.es_cero));
              return (
                <CategoriaBloque key={cat.categoria_id} cat={cat} subsNoCero={subsNoCero} />
              );
            })}
            <Subtotal label="= Total gastos operativos" valor={-gastos.total} />
            <Separador />

            {/* ─── Utilidad neta del producto ─── */}
            <Subtotal label="= UTILIDAD NETA DEL PRODUCTO" valor={data.utilidad_neta_producto} grande />
            <Separador />

            {/* ─── Retiros del período ─── */}
            <SeccionHeader titulo="Retiros del Período" />
            {retiros.categorias.flatMap(cat =>
              cat.rubros.flatMap(r => r.subrubros)
            ).map(s => (
              <Linea key={s.subrubro_id} label={s.subrubro} valor={s.monto} cero={s.es_cero} negativo={!s.es_cero} />
            ))}
            <Subtotal label="(−) Total retiros del período" valor={-retiros.total} />
            <Separador />

            {/* ─── Resultado acumulado ─── */}
            <SeccionHeader titulo="Resultado Acumulado" />
            <tr className="border-b border-kp-border/30">
              <td className="px-5 py-1.5 text-sm text-kp-gray" style={{ paddingLeft: 28 }}>Acumulado del mes anterior</td>
              <td className="px-5 py-1.5 text-sm text-right tabular-nums text-kp-white">{fmt(resultado_acumulado.acumulado_anterior)}</td>
            </tr>
            <tr className="border-b border-kp-border/30">
              <td className="px-5 py-1.5 text-sm text-kp-gray" style={{ paddingLeft: 28 }}>(+) Utilidad neta del producto</td>
              <td className="px-5 py-1.5 text-sm text-right tabular-nums text-kp-white">{fmt(data.utilidad_neta_producto)}</td>
            </tr>
            <tr className="border-b border-kp-border/30">
              <td className="px-5 py-1.5 text-sm text-kp-gray italic" style={{ paddingLeft: 28 }}>(−) Retiros del período</td>
              <td className="px-5 py-1.5 text-sm text-right tabular-nums text-orange-300">{fmtParen(retiros.total)}</td>
            </tr>
            <tr><td colSpan={2} className="py-1" /></tr>
            <tr className={[
              'border-t-2 border-b-2',
              resultado_acumulado.total >= 0 ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-red-700/50 bg-red-950/30',
            ].join(' ')}>
              <td className="px-5 py-4 text-base font-black text-kp-white">RESULTADO ACUMULADO</td>
              <td className={[
                'px-5 py-4 text-xl font-black text-right tabular-nums',
                resultado_acumulado.total >= 0 ? 'text-emerald-400' : 'text-red-400',
              ].join(' ')}>
                {fmt(resultado_acumulado.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ingreso por ventas', value: fmt(ingresos.ventas_netas), color: 'text-kp-white' },
          { label: 'Utilidad bruta', value: fmt(costo_mercaderia.utilidad_bruta),
            color: costo_mercaderia.utilidad_bruta >= 0 ? 'text-emerald-400' : 'text-red-400',
            sub: `${costo_mercaderia.margen_bruto_pct > 0 ? '+' : ''}${costo_mercaderia.margen_bruto_pct}% margen bruto` },
          { label: 'Utilidad neta del producto', value: fmt(data.utilidad_neta_producto),
            color: data.utilidad_neta_producto >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Resultado acumulado', value: fmt(resultado_acumulado.total),
            color: resultado_acumulado.total >= 0 ? 'text-emerald-400' : 'text-red-400' },
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

/** Bloque de una categoría de gasto: cabecera + subrubros con monto > 0 */
function CategoriaBloque({ cat, subsNoCero }: { cat: Categoria; subsNoCero: Subrubro[] }) {
  return (
    <>
      <CategoriaHeader nombre={cat.categoria} total={cat.total} />
      {subsNoCero.map(s => (
        <Linea key={s.subrubro_id} label={s.subrubro} valor={s.monto} nivel={2} negativo />
      ))}
    </>
  );
}
