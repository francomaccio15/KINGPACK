import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { card, cardCls, cn, sectionTitleCls, tableCls, theadRowCls, thCls, thNumCls, tdCls, tdNumCls, metaCls, errorCls } from '@/lib/ui';
import FiltrosFlujo from './FiltrosFlujo';

export const dynamic = 'force-dynamic';

// ─── Tipos (respuesta de GET /api/flujo-fondos) ──────────────────────────────
type PorMes = Record<string, number>;
interface Fila { concepto: string; valores: PorMes }
interface FilaProy extends Fila { base: number }
interface Mes { mes: string; etiqueta: string; parcial?: boolean; hasta_dia?: number | null }
interface Categoria { categoria: string; venta_neta: number; costo: number; margen: number; margen_pct: number; por_mes: PorMes }
interface Articulo { codigo: string; articulo: string; categoria: string; bultos: number; venta_neta: number; costo: number; margen: number; margen_pct: number }
interface FlujoData {
  periodo: { desde: string; hasta: string; meses: Mes[] };
  generado: string;
  flujo: {
    ingresos: Fila[]; egresos: Fila[];
    total_ingresos: PorMes; total_egresos: PorMes; neto: PorMes; acumulado: PorMes;
    ventas: { total: PorMes; a_cc: PorMes; cantidad: PorMes };
  };
  posicion: {
    disponibilidades: { tipo: string; nombre: string; monto: number }[];
    total_disponible: number; a_cobrar: number; deuda_proveedores: number; capital_trabajo: number;
    proveedores: {
      facturas_impagas: number; pagos_a_cuenta: number; a_pagar: number; a_favor: number;
      detalle: { proveedor: string; impago: number; a_cuenta: number; neto: number }[];
    };
  };
  proyeccion: {
    supuestos: { inflacion: number; crecimiento: number; base_meses: string[]; saldo_inicial: number };
    meses: Mes[]; ingresos: FilaProy[]; egresos: FilaProy[];
    neto: PorMes; inicio: PorMes; cierre: PorMes;
  };
  productos: { categorias: Categoria[]; top_articulos: Articulo[]; venta_neta_total: number; costo_total: number; margen_pct: number };
}

// ─── Formato ─────────────────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const money = (n: number) => (Math.round(n) === 0 ? '—' : ars.format(n));
const pct = (n: number) => `${(n * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const millones = (n: number) => `$${(n / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
const sum = (o: PorMes, meses: Mes[]) => meses.reduce((s, m) => s + (o[m.mes] || 0), 0);
const signo = (n: number) => (n < 0 ? 'text-rose-400' : n > 0 ? 'text-green-400' : 'text-kp-gray');

function mesActualAR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()).slice(0, 7);
}

interface PageProps { searchParams: { desde?: string; hasta?: string; inflacion?: string; crecimiento?: string } }

export default async function FlujoFondosPage({ searchParams }: PageProps) {
  requireAuth('/flujo-fondos');

  const qs = new URLSearchParams();
  for (const k of ['desde', 'hasta', 'inflacion', 'crecimiento'] as const) {
    if (searchParams[k]) qs.set(k, searchParams[k]!);
  }
  let data: FlujoData | null = null;
  let error: string | null = null;
  try {
    const res = await serverFetch(`/api/flujo-fondos?${qs.toString()}`, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok) error = body.error ?? 'No se pudo calcular el flujo de fondos';
    else data = body;
  } catch {
    error = 'No se pudo conectar con el servidor';
  }

  const mesMax = mesActualAR();

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Flujo de Fondos"
        subtitle="Dinero que efectivamente entró y salió de la empresa, mes a mes. Todas las sucursales."
      />

      <div className={card}>
        <FiltrosFlujo
          desde={data?.periodo.desde ?? searchParams.desde ?? mesMax}
          hasta={data?.periodo.hasta ?? searchParams.hasta ?? mesMax}
          inflacion={data?.proyeccion.supuestos.inflacion ?? 0.02}
          crecimiento={data?.proyeccion.supuestos.crecimiento ?? 0}
          mesMax={mesMax}
        />
      </div>

      {error && <p role="alert" className={errorCls}>{error}</p>}
      {data && <Contenido d={data} />}
    </div>
  );
}

// ─── Contenido ───────────────────────────────────────────────────────────────
function Contenido({ d }: { d: FlujoData }) {
  const meses = d.periodo.meses;
  const totIng = sum(d.flujo.total_ingresos, meses);
  const totEgr = sum(d.flujo.total_egresos, meses);
  const neto = totIng - totEgr;
  const retiros = d.flujo.egresos.find((f) => f.concepto === 'Retiros de los dueños');
  const operativo = neto + (retiros ? sum(retiros.valores, meses) : 0);
  const totVen = sum(d.flujo.ventas.total, meses);
  const pctCC = totVen ? sum(d.flujo.ventas.a_cc, meses) / totVen : 0;
  const peor = Math.min(...d.proyeccion.meses.map((m) => d.proyeccion.cierre[m.mes]));
  const etiqueta = (m: Mes) => (m.parcial ? `${m.etiqueta} (al ${String(m.hasta_dia).padStart(2, '0')})` : m.etiqueta);
  const maxAbs = Math.max(1, ...meses.map((m) => Math.abs(d.flujo.neto[m.mes])));

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total cobrado" valor={millones(totIng)} detalle={`${meses[0].etiqueta} a ${meses[meses.length - 1].etiqueta}`} />
        <Kpi label="Total pagado" valor={millones(totEgr)} detalle="Proveedores, gastos y retiros" />
        <Kpi label="Flujo neto" valor={millones(neto)} detalle={`Antes de retiros: ${millones(operativo)}`} tone={neto} />
        <Kpi label="Disponible hoy" valor={millones(d.posicion.total_disponible)} detalle="Bancos, cajas y cheques" />
        <Kpi label="A cobrar de clientes" valor={millones(d.posicion.a_cobrar)} detalle={`${pct(pctCC)} de las ventas va a CC`} />
        <Kpi label="Deuda neta con proveedores" valor={millones(d.posicion.deuda_proveedores)}
          detalle={`Debés ${millones(d.posicion.proveedores.a_pagar)} · a favor ${millones(d.posicion.proveedores.a_favor)}`} tone={-1} />
        <Kpi label="Capital de trabajo" valor={millones(d.posicion.capital_trabajo)} detalle="Disponible + a cobrar − deuda" tone={d.posicion.capital_trabajo} />
        <Kpi label="Margen bruto estimado" valor={pct(d.productos.margen_pct)} detalle="Sobre venta neta (sin IVA)" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 md:gap-6 items-start">
        {/* Neto por mes */}
        <div className={card}>
          <h3 className={cn(sectionTitleCls, 'mb-3')}>Flujo neto por mes</h3>
          <div className="space-y-2">
            {meses.map((m) => {
              const v = d.flujo.neto[m.mes];
              const w = `${(Math.abs(v) / maxAbs) * 50}%`;
              return (
                <div key={m.mes} className="grid grid-cols-[88px_1fr_120px] md:grid-cols-[120px_1fr_140px] items-center gap-2 text-sm">
                  <span className="text-kp-gray truncate">{etiqueta(m)}</span>
                  <div className="relative h-4 bg-kp-surface2 rounded">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-kp-border" />
                    <div className={cn('absolute inset-y-0 rounded', v < 0 ? 'bg-rose-500/70 right-1/2' : 'bg-green-500/70 left-1/2')} style={{ width: w }} />
                  </div>
                  <span className={cn('text-right tabular-nums', signo(v))}>{money(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Posición */}
        <div className={cn(cardCls, 'overflow-hidden')}>
          <h3 className={cn(sectionTitleCls, 'px-4 pt-4 pb-2')}>Posición al {d.generado.split('-').reverse().join('/')}</h3>
          <table className={tableCls}>
            <tbody>
              {d.posicion.disponibilidades.map((x) => (
                <tr key={x.nombre} className="border-t border-kp-border/50">
                  <td className={cn(tdCls, 'py-2 text-kp-gray')}>{x.nombre}</td>
                  <td className={cn(tdNumCls, 'py-2', signo(x.monto) === 'text-rose-400' && 'text-rose-400')}>{money(x.monto)}</td>
                </tr>
              ))}
              <FilaSimple label="Total disponible" valor={d.posicion.total_disponible} bold />
              <FilaSimple label="A cobrar de clientes" valor={d.posicion.a_cobrar} />
              <FilaSimple label="Facturas de proveedores impagas" valor={-d.posicion.proveedores.facturas_impagas} />
              <FilaSimple label="Pagos a cuenta sin imputar" valor={d.posicion.proveedores.pagos_a_cuenta} />
              <FilaSimple label="Capital de trabajo neto" valor={d.posicion.capital_trabajo} bold />
            </tbody>
          </table>
          <p className={cn(metaCls, 'px-4 py-3')}>No incluye el efectivo de las cajas diarias abiertas.</p>
        </div>

      </div>

      {/* Deuda por proveedor */}
      <Tabla
        titulo="Deuda con proveedores"
        primera="Proveedor"
        columnas={['Facturas impagas', 'Pagado a cuenta sin imputar', 'Neto']}
        pie="Neto positivo = lo que se le debe; negativo = saldo a favor (se le pagó de más o por adelantado). Imputando los pagos a cuenta desde Pago a Proveedores, las facturas dejan de figurar impagas."
      >
        {d.posicion.proveedores.detalle.map((p) => (
          <tr key={p.proveedor} className="border-t border-kp-border/50">
            <td className={cn(tdCls, 'py-2 sticky left-0 bg-kp-surface')}>{p.proveedor}</td>
            <td className={cn(tdNumCls, 'py-2 whitespace-nowrap')}>{money(p.impago)}</td>
            <td className={cn(tdNumCls, 'py-2 whitespace-nowrap text-kp-gray')}>{money(p.a_cuenta)}</td>
            <td className={cn(tdNumCls, 'py-2 whitespace-nowrap font-semibold', p.neto > 0.5 ? 'text-rose-400' : p.neto < -0.5 ? 'text-green-400' : 'text-kp-gray')}>
              {p.neto < -0.5 ? `a favor ${money(-p.neto)}` : money(p.neto)}
            </td>
          </tr>
        ))}
        <tr className="border-t-2 border-kp-border bg-kp-surface2 font-bold">
          <td className={cn(tdCls, 'py-2 sticky left-0 bg-kp-surface2')}>Deuda neta</td>
          <td className={cn(tdNumCls, 'py-2 whitespace-nowrap')}>{money(d.posicion.proveedores.facturas_impagas)}</td>
          <td className={cn(tdNumCls, 'py-2 whitespace-nowrap')}>{money(d.posicion.proveedores.pagos_a_cuenta)}</td>
          <td className={cn(tdNumCls, 'py-2 whitespace-nowrap text-rose-400')}>{money(d.posicion.deuda_proveedores)}</td>
        </tr>
        <tr className="border-t border-kp-border/50">
          <td colSpan={4} className={cn(tdCls, 'py-2', metaCls)}>
            Se debe {money(d.posicion.proveedores.a_pagar)} y hay {money(d.posicion.proveedores.a_favor)} de saldo a favor con otros proveedores.
          </td>
        </tr>
      </Tabla>

      {/* Flujo real */}
      <Tabla titulo="Flujo de fondos real" columnas={[...meses.map(etiqueta), 'Total']}>
        <Seccion texto="Ingresos" cols={meses.length + 2} />
        {d.flujo.ingresos.map((f) => <FilaMeses key={f.concepto} label={f.concepto} valores={f.valores} meses={meses} />)}
        <FilaMeses label="Total ingresos" valores={d.flujo.total_ingresos} meses={meses} total />
        <Seccion texto="Egresos" cols={meses.length + 2} />
        {d.flujo.egresos.map((f) => <FilaMeses key={f.concepto} label={f.concepto} valores={f.valores} meses={meses} />)}
        <FilaMeses label="Total egresos" valores={d.flujo.total_egresos} meses={meses} total />
        <FilaMeses label="Flujo neto del mes" valores={d.flujo.neto} meses={meses} total destacado />
        <FilaMeses label="Flujo neto acumulado" valores={d.flujo.acumulado} meses={meses} sinTotal />
        <Seccion texto="Referencia: ventas del mes (lo vendido, se cobre o no)" cols={meses.length + 2} />
        <FilaMeses label="Ventas del mes (con IVA)" valores={d.flujo.ventas.total} meses={meses} />
        <FilaMeses label="De las cuales, a cuenta corriente" valores={d.flujo.ventas.a_cc} meses={meses} />
      </Tabla>

      {/* Proyección */}
      <Tabla
        titulo={`Proyección (base: promedio ${d.proyeccion.supuestos.base_meses.join(', ')})`}
        columnas={['Base', ...d.proyeccion.meses.map((m) => m.etiqueta)]}
        pie={`Inflación ${pct(d.proyeccion.supuestos.inflacion)} y crecimiento ${pct(d.proyeccion.supuestos.crecimiento)} mensual. El mes en curso se lleva a mes completo.`}
      >
        <FilaProyeccion label="Ingresos" base={d.proyeccion.ingresos.reduce((s, f) => s + f.base, 0)}
          valores={sumaFilas(d.proyeccion.ingresos, d.proyeccion.meses)} meses={d.proyeccion.meses} />
        <FilaProyeccion label="Egresos" base={d.proyeccion.egresos.reduce((s, f) => s + f.base, 0)}
          valores={sumaFilas(d.proyeccion.egresos, d.proyeccion.meses)} meses={d.proyeccion.meses} />
        <FilaProyeccion label="Flujo neto" valores={d.proyeccion.neto} meses={d.proyeccion.meses} bold />
        <FilaProyeccion label="Disponible al cierre" valores={d.proyeccion.cierre} meses={d.proyeccion.meses} bold
          base={d.proyeccion.supuestos.saldo_inicial} />
        <tr><td colSpan={d.proyeccion.meses.length + 2} className={cn(tdCls, 'py-2', metaCls)}>
          Peor mes proyectado: <span className={cn('tabular-nums', signo(peor))}>{money(peor)}</span>. En la columna Base del disponible va el saldo de hoy.
        </td></tr>
      </Tabla>

      {/* Productos */}
      <Tabla titulo="Margen por categoría" columnas={['Venta neta', 'Costo estimado', 'Margen bruto', 'Margen %', 'Peso en ventas']}
        pie="Venta neta = sin IVA. El costo es el costo actual de cada artículo × (1 + flete%): el sistema no guarda el costo del día de cada venta.">
        {d.productos.categorias.map((c) => (
          <tr key={c.categoria} className="border-t border-kp-border/50">
            <td className={cn(tdCls, 'py-2')}>{c.categoria}</td>
            <td className={cn(tdNumCls, 'py-2')}>{money(c.venta_neta)}</td>
            <td className={cn(tdNumCls, 'py-2 text-kp-gray')}>{money(c.costo)}</td>
            <td className={cn(tdNumCls, 'py-2')}>{money(c.margen)}</td>
            <td className={cn(tdNumCls, 'py-2', c.margen_pct < 0.2 && 'text-amber-400')}>{pct(c.margen_pct)}</td>
            <td className={cn(tdNumCls, 'py-2 text-kp-gray')}>{pct(d.productos.venta_neta_total ? c.venta_neta / d.productos.venta_neta_total : 0)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-kp-border bg-kp-surface2 font-bold">
          <td className={cn(tdCls, 'py-2')}>Total</td>
          <td className={cn(tdNumCls, 'py-2')}>{money(d.productos.venta_neta_total)}</td>
          <td className={cn(tdNumCls, 'py-2')}>{money(d.productos.costo_total)}</td>
          <td className={cn(tdNumCls, 'py-2')}>{money(d.productos.venta_neta_total - d.productos.costo_total)}</td>
          <td className={cn(tdNumCls, 'py-2')}>{pct(d.productos.margen_pct)}</td>
          <td className={cn(tdNumCls, 'py-2')}>100,0%</td>
        </tr>
      </Tabla>

      <Tabla titulo={`Los ${d.productos.top_articulos.length} artículos que más venden`} columnas={['Categoría', 'Bultos', 'Venta neta', 'Margen bruto', 'Margen %']}>
        {d.productos.top_articulos.map((a) => (
          <tr key={a.codigo + a.articulo} className="border-t border-kp-border/50">
            <td className={cn(tdCls, 'py-2')}>
              <div className="max-w-[320px] truncate" title={a.articulo}>{a.articulo}</div>
              <div className={metaCls}>{a.codigo}</div>
            </td>
            <td className={cn(tdCls, 'py-2 text-kp-gray text-xs')}>{a.categoria}</td>
            <td className={cn(tdNumCls, 'py-2')}>{a.bultos.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</td>
            <td className={cn(tdNumCls, 'py-2')}>{money(a.venta_neta)}</td>
            <td className={cn(tdNumCls, 'py-2')}>{money(a.margen)}</td>
            <td className={cn(tdNumCls, 'py-2', a.margen_pct < 0.2 && 'text-amber-400')}>{pct(a.margen_pct)}</td>
          </tr>
        ))}
      </Tabla>

      <p className={metaCls}>
        Ingresos = cobros de contado de ventas + cobranzas de cuenta corriente. Egresos = pagos a proveedores (facturas y pagos a cuenta),
        gastos, sueldos, impuestos y retiros, en la fecha en que se pagaron. No incluye ventas anuladas, preventas ni pases internos entre cajas y bancos.
      </p>
    </>
  );
}

function sumaFilas(filas: Fila[], meses: Mes[]): PorMes {
  return Object.fromEntries(meses.map((m) => [m.mes, filas.reduce((s, f) => s + (f.valores[m.mes] || 0), 0)]));
}

// ─── Piezas ──────────────────────────────────────────────────────────────────
function Kpi({ label, valor, detalle, tone }: { label: string; valor: string; detalle: string; tone?: number }) {
  return (
    <div className={cn(cardCls, 'p-3 md:p-4')}>
      <p className={metaCls}>{label}</p>
      <p className={cn('text-lg md:text-2xl font-bold tabular-nums mt-1', tone === undefined ? 'text-kp-white' : signo(tone))}>{valor}</p>
      <p className={cn(metaCls, 'mt-1 opacity-80')}>{detalle}</p>
    </div>
  );
}

function Tabla({ titulo, columnas, children, pie, primera = 'Concepto' }: { titulo: string; columnas: string[]; children: React.ReactNode; pie?: string; primera?: string }) {
  return (
    <div className={cn(cardCls, 'overflow-hidden')}>
      <h3 className={cn(sectionTitleCls, 'px-4 pt-4 pb-2')}>{titulo}</h3>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead>
            <tr className={theadRowCls}>
              <th className={cn(thCls, 'sticky left-0 bg-kp-surface2 min-w-[220px]')}>{primera}</th>
              {columnas.map((c) => <th key={c} className={cn(thNumCls, 'whitespace-nowrap')}>{c}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {pie && <p className={cn(metaCls, 'px-4 py-3')}>{pie}</p>}
    </div>
  );
}

function Seccion({ texto, cols }: { texto: string; cols: number }) {
  return (
    <tr className="bg-kp-surface2/60">
      <td colSpan={cols} className={cn(tdCls, 'py-2 text-2xs font-bold uppercase tracking-widest text-kp-gray')}>{texto}</td>
    </tr>
  );
}

function FilaMeses({ label, valores, meses, total, destacado, sinTotal }: {
  label: string; valores: PorMes; meses: Mes[]; total?: boolean; destacado?: boolean; sinTotal?: boolean;
}) {
  const t = sum(valores, meses);
  return (
    <tr className={cn('border-t border-kp-border/50', total && 'font-bold', destacado && 'bg-kp-surface2')}>
      <td className={cn(tdCls, 'py-2 sticky left-0 bg-kp-surface', destacado && 'bg-kp-surface2', !total && 'pl-6 text-kp-gray')}>{label}</td>
      {meses.map((m) => (
        <td key={m.mes} className={cn(tdNumCls, 'py-2 whitespace-nowrap', destacado && signo(valores[m.mes]))}>{money(valores[m.mes] || 0)}</td>
      ))}
      <td className={cn(tdNumCls, 'py-2 whitespace-nowrap font-bold', destacado && signo(t))}>{sinTotal ? '' : money(t)}</td>
    </tr>
  );
}

function FilaProyeccion({ label, valores, meses, base, bold }: { label: string; valores: PorMes; meses: Mes[]; base?: number; bold?: boolean }) {
  return (
    <tr className={cn('border-t border-kp-border/50', bold && 'font-bold')}>
      <td className={cn(tdCls, 'py-2 sticky left-0 bg-kp-surface')}>{label}</td>
      <td className={cn(tdNumCls, 'py-2 whitespace-nowrap text-kp-gray')}>{base === undefined ? '' : money(base)}</td>
      {meses.map((m) => (
        <td key={m.mes} className={cn(tdNumCls, 'py-2 whitespace-nowrap', bold && signo(valores[m.mes]))}>{money(valores[m.mes])}</td>
      ))}
    </tr>
  );
}

function FilaSimple({ label, valor, bold }: { label: string; valor: number; bold?: boolean }) {
  return (
    <tr className={cn('border-t border-kp-border', bold && 'font-bold bg-kp-surface2')}>
      <td className={cn(tdCls, 'py-2')}>{label}</td>
      <td className={cn(tdNumCls, 'py-2', valor < 0 && 'text-rose-400')}>{money(valor)}</td>
    </tr>
  );
}
