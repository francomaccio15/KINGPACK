const { pool } = require('../config/db');

// Flujo de fondos: dinero que efectivamente entró y salió de la empresa, mes a
// mes, más la posición de hoy, una proyección y el margen por producto.
// Es a nivel empresa (todas las sucursales): cobranzas de CC y pagos a
// proveedores no se imputan a una sucursal.

const TZ = 'America/Argentina/Buenos_Aires';

const MEDIOS_CONTADO = ['Efectivo', 'Transferencia', 'QR', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Mercado Pago', 'Cheque'];

const EGRESOS = [
  'Pago a proveedores de mercadería',
  'Pagos a cuenta / anticipos a proveedores',
  'Sueldos, jornales y honorarios',
  'Alquileres',
  'Servicios y gastos de administración',
  'Fletes, logística y otros gastos operativos',
  'Impuestos',
  'Gastos bancarios y créditos',
  'Devoluciones de dinero a clientes',
  'Retiros de los dueños',
];

// categorias_resultado.nombre → concepto del flujo
const CATEGORIA_A_CONCEPTO = {
  'COMPRAS': 'Pago a proveedores de mercadería',
  'SUELDOS, JORNALES Y HONORARIOS': 'Sueldos, jornales y honorarios',
  'ALQUILERES': 'Alquileres',
  'SERVICIOS': 'Servicios y gastos de administración',
  'OTROS GASTOS OPERATIVOS': 'Fletes, logística y otros gastos operativos',
  'IMPUESTOS': 'Impuestos',
  'FINANCIEROS': 'Gastos bancarios y créditos',
  'RETIROS DEL PERÍODO': 'Retiros de los dueños',
};
const conceptoDeCategoria = (cat) => CATEGORIA_A_CONCEPTO[cat] || 'Fletes, logística y otros gastos operativos';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const etiquetaMes = (ym) => `${MESES_CORTOS[parseInt(ym.slice(5, 7), 10) - 1]}-${ym.slice(2, 4)}`;

function sumarMes(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function rangoMeses(desde, hasta) {
  const out = [];
  for (let m = desde; m <= hasta && out.length < 60; m = sumarMes(m, 1)) out.push(m);
  return out;
}

// Fecha de hoy en Argentina (YYYY-MM-DD).
function hoyAR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

const num = (v) => parseFloat(v) || 0;
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Valida y normaliza los parámetros. Devuelve { error } si algo no cierra.
 * desde/hasta: YYYY-MM · inflacion/crecimiento: fracción mensual (0.02 = 2%).
 */
async function normalizarParams(q) {
  const hoy = hoyAR();
  const mesHoy = hoy.slice(0, 7);
  let desde = q.desde;
  if (!desde) {
    const { rows } = await pool.query(
      `SELECT to_char(MIN(fecha AT TIME ZONE '${TZ}'), 'YYYY-MM') AS m FROM ventas WHERE deleted_at IS NULL`
    );
    desde = rows[0].m || mesHoy;
  }
  const hasta = q.hasta || mesHoy;
  if (!RE_MES.test(desde) || !RE_MES.test(hasta)) return { error: 'Período inválido: usar formato AAAA-MM' };
  if (desde > hasta) return { error: 'El mes "desde" no puede ser posterior al mes "hasta"' };
  if (hasta > mesHoy) return { error: 'El mes "hasta" no puede ser futuro' };
  if (rangoMeses(desde, hasta).length > 36) return { error: 'El período no puede superar 36 meses' };

  const inflacion   = q.inflacion   !== undefined && q.inflacion   !== '' ? Number(q.inflacion)   : 0.02;
  const crecimiento = q.crecimiento !== undefined && q.crecimiento !== '' ? Number(q.crecimiento) : 0;
  if (!Number.isFinite(inflacion) || inflacion < -0.5 || inflacion > 1) return { error: 'Inflación mensual inválida' };
  if (!Number.isFinite(crecimiento) || crecimiento < -0.5 || crecimiento > 1) return { error: 'Crecimiento mensual inválido' };

  return { desde, hasta, inflacion, crecimiento, hoy };
}

// Deuda por proveedor: el saldo de su cuenta corriente (saldo inicial + Σ debe −
// Σ haber), por concepto facturado / no facturado. Es el mismo número que la
// pestaña Proveedores, así que incluye saldos iniciales y ajustes manuales; los
// pagos (también los pagos a cuenta y con cheque) ya están restados como haber.
// neto > 0 = se le debe; neto < 0 = saldo a favor. La usa también /proveedores.
async function deudaPorProveedor() {
  const { rows } = await pool.query(`
      SELECT p.id AS proveedor_id, p.razon_social AS proveedor, p.activo,
             p.saldo_inicial_facturado    + COALESCE(cc.mov_fact, 0)   AS facturado,
             p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0) AS no_facturado
      FROM proveedores p
      LEFT JOIN (
        SELECT proveedor_id,
          COALESCE(SUM(debe) FILTER (WHERE facturado), 0)
            - COALESCE(SUM(haber) FILTER (WHERE facturado), 0)     AS mov_fact,
          COALESCE(SUM(debe) FILTER (WHERE NOT facturado), 0)
            - COALESCE(SUM(haber) FILTER (WHERE NOT facturado), 0) AS mov_nofact
        FROM cuentas_corrientes_proveedor
        GROUP BY proveedor_id
      ) cc ON cc.proveedor_id = p.id
      WHERE p.deleted_at IS NULL`);
  const detalle = rows
    .map((r) => ({
      proveedor_id: r.proveedor_id,
      proveedor: r.activo ? r.proveedor : `${r.proveedor} (inactivo)`,
      facturado: num(r.facturado),
      no_facturado: num(r.no_facturado),
      neto: num(r.facturado) + num(r.no_facturado),
    }))
    .filter((r) => Math.round(r.neto) !== 0 || Math.round(r.facturado) !== 0)
    .sort((a, b) => b.neto - a.neto);
  return {
    facturado: detalle.reduce((s, r) => s + r.facturado, 0),
    no_facturado: detalle.reduce((s, r) => s + r.no_facturado, 0),
    a_pagar: detalle.reduce((s, r) => s + Math.max(r.neto, 0), 0),
    a_favor: detalle.reduce((s, r) => s + Math.max(-r.neto, 0), 0),
    deuda_neta: detalle.reduce((s, r) => s + r.neto, 0),
    detalle,
  };
}

async function calcularFlujo({ desde, hasta, inflacion, crecimiento, hoy }) {
  const meses = rangoMeses(desde, hasta);
  const ini = `${desde}-01`;
  const fin = `${sumarMes(hasta, 1)}-01`; // exclusivo
  const p = [ini, fin];
  const mesTz = (col) => `to_char(${col} AT TIME ZONE '${TZ}', 'YYYY-MM')`;
  const enRango = (col) => `(${col} AT TIME ZONE '${TZ}') >= $1::date AND (${col} AT TIME ZONE '${TZ}') < $2::date`;

  const [cobrosContado, cobrosCC, pagosEgresos, gastosCaja, anticipos, devoluciones, ventas, productos, posicion, deudaProv] = await Promise.all([
    pool.query(`
      SELECT ${mesTz('v.fecha')} AS mes, m.nombre AS medio, SUM(vp.monto) AS monto
      FROM venta_pagos vp
      JOIN ventas v ON v.id = vp.venta_id
      JOIN medios_pago m ON m.id = vp.medio_pago_id
      WHERE v.deleted_at IS NULL AND v.estado IN ('confirmada', 'facturada')
        AND m.nombre NOT IN ('Cuenta Corriente', 'Saldo a favor')
        AND ${enRango('v.fecha')}
      GROUP BY 1, 2`, p),
    pool.query(`
      SELECT ${mesTz('c.fecha')} AS mes, SUM(c.haber) AS monto
      FROM cuentas_corrientes_cliente c
      WHERE c.origen_tipo = 'pago' AND ${enRango('c.fecha')}
      GROUP BY 1`, p),
    // Pagos imputados a facturas/gastos (incluye los que salen de un pago a proveedor)
    pool.query(`
      SELECT ${mesTz('ep.fecha_pago')} AS mes, cr.nombre AS categoria, SUM(ep.monto) AS monto
      FROM egreso_pagos ep
      JOIN egresos e ON e.id = ep.egreso_id
      JOIN medios_pago m ON m.id = ep.medio_pago_id
      LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
      LEFT JOIN rubros_gastos r ON r.id = sg.rubro_id
      LEFT JOIN categorias_resultado cr ON cr.id = r.categoria_resultado_id
      WHERE e.deleted_at IS NULL AND m.nombre <> 'ERROR REDONDEO'
        AND ${enRango('ep.fecha_pago')}
      GROUP BY 1, 2`, p),
    // Gastos manuales pagados desde la caja diaria
    pool.query(`
      SELECT ${mesTz('mc.fecha')} AS mes, cr.nombre AS categoria, SUM(mc.monto) AS monto
      FROM movimientos_caja mc
      JOIN egresos e ON e.id = mc.egreso_id
      LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
      LEFT JOIN rubros_gastos r ON r.id = sg.rubro_id
      LEFT JOIN categorias_resultado cr ON cr.id = r.categoria_resultado_id
      WHERE e.deleted_at IS NULL AND mc.tipo = 'egreso' AND ${enRango('mc.fecha')}
      GROUP BY 1, 2`, p),
    // Parte de los pagos a proveedor que todavía no se imputó a ninguna factura
    pool.query(`
      SELECT to_char(pp.fecha, 'YYYY-MM') AS mes, SUM(pp.monto - COALESCE(a.aplicado, 0)) AS monto
      FROM pagos_proveedor pp
      LEFT JOIN (SELECT pago_proveedor_id, SUM(monto) AS aplicado FROM egreso_pagos
                 WHERE pago_proveedor_id IS NOT NULL GROUP BY 1) a ON a.pago_proveedor_id = pp.id
      WHERE NOT pp.anulado AND pp.fecha >= $1::date AND pp.fecha < $2::date
      GROUP BY 1`, p),
    pool.query(`
      SELECT ${mesTz('fecha')} AS mes, SUM(monto) AS monto
      FROM movimientos_caja
      WHERE tipo = 'egreso' AND origen_tipo = 'nota_credito' AND egreso_id IS NULL AND ${enRango('fecha')}
      GROUP BY 1`, p),
    pool.query(`
      SELECT ${mesTz('v.fecha')} AS mes, COUNT(*) AS cantidad, SUM(v.total) AS total,
             SUM(COALESCE(cc.monto, 0)) AS a_cc
      FROM ventas v
      LEFT JOIN LATERAL (
        SELECT SUM(vp.monto) AS monto FROM venta_pagos vp JOIN medios_pago m ON m.id = vp.medio_pago_id
        WHERE vp.venta_id = v.id AND m.nombre = 'Cuenta Corriente'
      ) cc ON TRUE
      WHERE v.deleted_at IS NULL AND v.estado IN ('confirmada', 'facturada') AND ${enRango('v.fecha')}
      GROUP BY 1`, p),
    // Costo = costo actual del artículo × (1 + flete%), sin IVA. Las líneas por
    // unidad se pasan a bultos para usar el costo del bulto.
    pool.query(`
      SELECT ${mesTz('v.fecha')} AS mes, COALESCE(c.nombre, 'Sin categoría') AS categoria,
             a.codigo, a.nombre AS articulo,
             SUM(CASE WHEN vi.unidad_venta = 'unidad' THEN vi.cantidad / GREATEST(a.unidades_por_bulto, 1) ELSE vi.cantidad END) AS bultos,
             SUM(vi.cantidad * vi.precio_unitario_final) AS venta_iva,
             SUM(vi.iva_monto) AS iva,
             SUM(CASE WHEN vi.unidad_venta = 'unidad' THEN vi.cantidad / GREATEST(a.unidades_por_bulto, 1) ELSE vi.cantidad END
                 * a.costo_base * (1 + COALESCE(a.costo_flete, 0) / 100)) AS costo
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN articulos a ON a.id = vi.articulo_id
      LEFT JOIN categorias c ON c.id = a.categoria_id
      WHERE v.deleted_at IS NULL AND v.estado IN ('confirmada', 'facturada') AND ${enRango('v.fecha')}
      GROUP BY 1, 2, 3, 4`, p),
    pool.query(`
      SELECT 'banco' AS tipo, 'Banco — ' || nombre AS nombre, saldo AS monto FROM cuentas_bancarias_empresa WHERE activo
      UNION ALL
      SELECT 'caja_fuerte', 'Caja fuerte ' || COALESCE(s.nombre, ''), cf.saldo FROM caja_fuerte cf LEFT JOIN sucursales s ON s.id = cf.sucursal_id
      UNION ALL
      SELECT 'caja_adm', 'Caja Administrativa', saldo FROM caja_administrativa
      UNION ALL
      SELECT 'cheques', 'Cheques de terceros en cartera', COALESCE(SUM(importe), 0) FROM cheques_manuales
        WHERE deleted_at IS NULL AND tipo = 'recibido' AND estado = 'en_cartera'
      UNION ALL
      SELECT 'cc_clientes', 'Saldo a cobrar de clientes (cuenta corriente)', COALESCE(SUM(saldo) FILTER (WHERE saldo > 0), 0)
        FROM (SELECT DISTINCT ON (cliente_id) saldo FROM cuentas_corrientes_cliente ORDER BY cliente_id, fecha DESC, id DESC) ult`),
    deudaPorProveedor(),
  ]);

  const vacio = () => Object.fromEntries(meses.map((m) => [m, 0]));
  const fila = (concepto) => ({ concepto, valores: vacio() });

  // ── Ingresos ──
  const porMedio = {};
  for (const r of cobrosContado.rows) {
    const k = MEDIOS_CONTADO.includes(r.medio) ? r.medio : 'Otros medios';
    porMedio[k] ??= fila(`Cobros de contado — ${k}`);
    porMedio[k].valores[r.mes] += num(r.monto);
  }
  const ingresos = [...MEDIOS_CONTADO, 'Otros medios'].filter((k) => porMedio[k]).map((k) => porMedio[k]);
  const cc = fila('Cobranzas de cuenta corriente');
  for (const r of cobrosCC.rows) cc.valores[r.mes] += num(r.monto);
  ingresos.push(cc);

  // ── Egresos ──
  const egr = Object.fromEntries(EGRESOS.map((c) => [c, fila(c)]));
  for (const r of [...pagosEgresos.rows, ...gastosCaja.rows]) egr[conceptoDeCategoria(r.categoria)].valores[r.mes] += num(r.monto);
  for (const r of anticipos.rows) egr['Pagos a cuenta / anticipos a proveedores'].valores[r.mes] += num(r.monto);
  for (const r of devoluciones.rows) egr['Devoluciones de dinero a clientes'].valores[r.mes] += num(r.monto);
  const egresos = EGRESOS.map((c) => egr[c]);

  const sumaFilas = (filas) => {
    const t = vacio();
    for (const f of filas) for (const m of meses) t[m] += f.valores[m];
    return t;
  };
  const totalIngresos = sumaFilas(ingresos);
  const totalEgresos  = sumaFilas(egresos);
  const neto = vacio();
  const acumulado = vacio();
  let acc = 0;
  for (const m of meses) { neto[m] = totalIngresos[m] - totalEgresos[m]; acc += neto[m]; acumulado[m] = acc; }

  const ventasMes = { total: vacio(), a_cc: vacio(), cantidad: vacio() };
  for (const r of ventas.rows) {
    ventasMes.total[r.mes] = num(r.total);
    ventasMes.a_cc[r.mes] = num(r.a_cc);
    ventasMes.cantidad[r.mes] = parseInt(r.cantidad, 10);
  }

  // ── Posición ──
  const pos = posicion.rows.map((r) => ({ tipo: r.tipo, nombre: r.nombre, monto: num(r.monto) }));
  const disponibilidades = pos.filter((r) => ['banco', 'caja_fuerte', 'caja_adm', 'cheques'].includes(r.tipo));
  const totalDisponible = disponibilidades.reduce((s, r) => s + r.monto, 0);
  const aCobrar = pos.find((r) => r.tipo === 'cc_clientes')?.monto ?? 0;
  const proveedores = deudaProv;
  // Neta: lo que se debe menos lo que los proveedores nos deben (saldo a favor).
  const deudaProveedores = proveedores.deuda_neta;

  // ── Proyección ──
  // Base = promedio de los últimos 3 meses del período (o los que haya). Si el
  // último es el mes en curso, se lleva a mes completo por los días con datos.
  const mesHoy = hoy.slice(0, 7);
  const diaHoy = parseInt(hoy.slice(8, 10), 10);
  const baseMeses = meses.slice(-3);
  const factorMes = (m) => {
    if (m !== mesHoy) return 1;
    const [y, mm] = m.split('-').map(Number);
    return new Date(Date.UTC(y, mm, 0)).getUTCDate() / diaHoy;
  };
  const base = (f) => baseMeses.reduce((s, m) => s + f.valores[m] * factorMes(m), 0) / baseMeses.length;
  const mesesProy = Array.from({ length: 6 }, (_, i) => sumarMes(hasta, i + 1));
  const proyectar = (f) => {
    const b = base(f);
    return { concepto: f.concepto, base: b, valores: Object.fromEntries(mesesProy.map((m, i) => [m, b * ((1 + inflacion) * (1 + crecimiento)) ** (i + 1)])) };
  };
  const pIng = ingresos.map(proyectar);
  const pEgr = egresos.map(proyectar);
  const pNeto = {}, pInicio = {}, pCierre = {};
  let saldo = totalDisponible;
  for (const m of mesesProy) {
    pNeto[m] = pIng.reduce((s, f) => s + f.valores[m], 0) - pEgr.reduce((s, f) => s + f.valores[m], 0);
    pInicio[m] = saldo; saldo += pNeto[m]; pCierre[m] = saldo;
  }

  // ── Productos ──
  const cats = {};
  const arts = {};
  const catMes = {};
  for (const r of productos.rows) {
    const v = num(r.venta_iva), i = num(r.iva), c = num(r.costo);
    cats[r.categoria] ??= { categoria: r.categoria, venta_iva: 0, iva: 0, costo: 0 };
    Object.assign(cats[r.categoria], { venta_iva: cats[r.categoria].venta_iva + v, iva: cats[r.categoria].iva + i, costo: cats[r.categoria].costo + c });
    catMes[r.categoria] ??= vacio();
    catMes[r.categoria][r.mes] += v;
    const k = r.codigo || r.articulo;
    arts[k] ??= { codigo: r.codigo, articulo: r.articulo, categoria: r.categoria, bultos: 0, venta_iva: 0, iva: 0, costo: 0 };
    arts[k].bultos += num(r.bultos); arts[k].venta_iva += v; arts[k].iva += i; arts[k].costo += c;
  }
  const conMargen = (x) => {
    const venta_neta = x.venta_iva - x.iva;
    const margen = venta_neta - x.costo;
    return { ...x, venta_neta, margen, margen_pct: venta_neta ? margen / venta_neta : 0 };
  };
  const categorias = Object.values(cats).map(conMargen).sort((a, b) => b.venta_neta - a.venta_neta)
    .map((c) => ({ ...c, por_mes: catMes[c.categoria] }));
  const ventaNetaTotal = categorias.reduce((s, c) => s + c.venta_neta, 0);
  const costoTotal = categorias.reduce((s, c) => s + c.costo, 0);
  const topArticulos = Object.values(arts).map(conMargen).sort((a, b) => b.venta_neta - a.venta_neta).slice(0, 30);

  return {
    periodo: { desde, hasta, meses: meses.map((m) => ({ mes: m, etiqueta: etiquetaMes(m), parcial: m === mesHoy, hasta_dia: m === mesHoy ? diaHoy : null })) },
    generado: hoy,
    flujo: { ingresos, egresos, total_ingresos: totalIngresos, total_egresos: totalEgresos, neto, acumulado, ventas: ventasMes },
    posicion: {
      disponibilidades, total_disponible: totalDisponible,
      a_cobrar: aCobrar, deuda_proveedores: deudaProveedores, proveedores,
      capital_trabajo: totalDisponible + aCobrar - deudaProveedores,
    },
    proyeccion: {
      supuestos: { inflacion, crecimiento, base_meses: baseMeses.map(etiquetaMes), saldo_inicial: totalDisponible },
      meses: mesesProy.map((m) => ({ mes: m, etiqueta: etiquetaMes(m) })),
      ingresos: pIng, egresos: pEgr, neto: pNeto, inicio: pInicio, cierre: pCierre,
    },
    productos: {
      categorias, top_articulos: topArticulos,
      venta_neta_total: ventaNetaTotal, costo_total: costoTotal,
      margen_pct: ventaNetaTotal ? (ventaNetaTotal - costoTotal) / ventaNetaTotal : 0,
    },
  };
}

module.exports = { normalizarParams, calcularFlujo, deudaPorProveedor, EGRESOS };
