const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva, requireRol } = require('../middleware/auth');

const router = express.Router();

// "Mes anterior" para comparar = los MISMOS días del mes anterior (del 1 al día
// de hoy). Comparar el mes en curso a medias contra el mes anterior completo
// mostraba caídas que no existían (ej.: −16 % en ventas cuando venían +24 %).
const MES_ANT_DESDE = `date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date`;
const MES_ANT_HASTA = `(CURRENT_DATE - INTERVAL '1 month')::date`;

// Ventas sin IVA y costo de lo vendido de un período. El costo se estima con el
// costo ACTUAL de cada artículo (costo_base + % flete, sin IVA), igual que el
// Flujo de Fondos: el sistema no guarda el costo histórico de cada venta.
// Las ventas en unidades sueltas se pasan a bultos con unidades_por_bulto.
async function margenPeriodo(condFecha, sucId) {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(vi.cantidad * vi.precio_unitario_final) - SUM(vi.iva_monto), 0)::float AS neto,
           COALESCE(SUM(
             CASE WHEN vi.unidad_venta = 'unidad'
                  THEN vi.cantidad / GREATEST(a.unidades_por_bulto, 1)
                  ELSE vi.cantidad END
             * a.costo_base * (1 + COALESCE(a.costo_flete, 0) / 100)), 0)::float AS costo
      FROM venta_items vi
      JOIN ventas v    ON v.id = vi.venta_id
      JOIN articulos a ON a.id = vi.articulo_id
     WHERE v.deleted_at IS NULL AND v.estado NOT IN ('anulada', 'preventa')
       AND ${condFecha} ${sucId ? 'AND v.sucursal_id = $1' : ''}`, sucId ? [sucId] : []);
  return { neto: rows[0].neto, costo: rows[0].costo };
}

router.use(requireRol('administrador', 'supervisor'));

router.get('/', async (req, res, next) => {
  try {
    const sucId = sucursalEfectiva(req);
    const sf    = sucId ? 'AND sucursal_id = $1' : '';
    const p     = sucId ? [sucId] : [];

    const [
      ventasHoy, ventasAyer,
      ventasMes, ventasMesAnt,
      egresosHoy, egresosAyer,
      egresosMes, egresosMesAnt,
      stockBajo,
      pedidosPendientes,
      ventasMesDiario,
      ultimasVentas,
      chequesACobrar,
      chequesAPagar,
      ventasPorMedio,
      transaccionesHoy,
      cobrosPorCuentaHoy,
      cobrosPorCuentaMes,
      cajaFuerte,
      movimientosCajaFuerte,
      saldosBancarios,
    ] = await Promise.all([

      pool.query(`SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS monto
        FROM ventas WHERE deleted_at IS NULL AND estado NOT IN ('anulada','preventa')
        AND fecha::date = CURRENT_DATE ${sf}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS monto
        FROM ventas WHERE deleted_at IS NULL AND estado NOT IN ('anulada','preventa')
        AND fecha::date = CURRENT_DATE - 1 ${sf}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS monto
        FROM ventas WHERE deleted_at IS NULL AND estado NOT IN ('anulada','preventa')
        AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE) ${sf}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS monto
        FROM ventas WHERE deleted_at IS NULL AND estado NOT IN ('anulada','preventa')
        AND fecha::date BETWEEN ${MES_ANT_DESDE} AND ${MES_ANT_HASTA} ${sf}`, p),

      pool.query(`SELECT
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion = 'compra_mercaderia'),0)  AS mercaderia,
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion <> 'compra_mercaderia'),0) AS gastos
        FROM egresos WHERE deleted_at IS NULL AND fecha_emision = CURRENT_DATE ${sf}`, p),

      pool.query(`SELECT
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion = 'compra_mercaderia'),0)  AS mercaderia,
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion <> 'compra_mercaderia'),0) AS gastos
        FROM egresos WHERE deleted_at IS NULL AND fecha_emision = CURRENT_DATE - 1 ${sf}`, p),

      pool.query(`SELECT
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion = 'compra_mercaderia'),0)  AS mercaderia,
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion <> 'compra_mercaderia'),0) AS gastos
        FROM egresos WHERE deleted_at IS NULL
        AND date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE) ${sf}`, p),

      pool.query(`SELECT
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion = 'compra_mercaderia'),0)  AS mercaderia,
          COALESCE(SUM(total) FILTER (WHERE tipo_operacion <> 'compra_mercaderia'),0) AS gastos
        FROM egresos WHERE deleted_at IS NULL
        AND fecha_emision BETWEEN ${MES_ANT_DESDE} AND ${MES_ANT_HASTA} ${sf}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad
        FROM stock s JOIN articulos a ON a.id = s.articulo_id
        WHERE a.deleted_at IS NULL AND a.activo = TRUE AND s.cantidad <= s.stock_minimo
        ${sucId ? 'AND s.sucursal_id = $1' : ''}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad FROM pedidos_compra
        WHERE estado IN ('pendiente','confirmado')`),

      // Detalle diario del mes en curso (día 1 → hoy) con generate_series
      // para que los días sin ventas devuelvan 0.
      pool.query(`
        SELECT d.dia::text, COALESCE(v.cantidad,0)::int AS cantidad,
               COALESCE(v.monto,0)::float AS monto
        FROM (
          SELECT generate_series(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE, INTERVAL '1 day')::date AS dia
        ) d
        LEFT JOIN (
          SELECT fecha::date AS dia, COUNT(*) AS cantidad, SUM(total) AS monto
          FROM ventas
          WHERE deleted_at IS NULL AND estado NOT IN ('anulada','preventa')
            AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
            ${sucId ? 'AND sucursal_id = $1' : ''}
          GROUP BY fecha::date
        ) v ON v.dia = d.dia
        ORDER BY d.dia ASC
      `, p),

      pool.query(`
        SELECT v.id, v.numero, v.total::float, v.fecha, v.estado,
               c.razon_social AS cliente
        FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE v.deleted_at IS NULL AND v.estado NOT IN ('anulada','preventa') ${sf}
        ORDER BY v.fecha DESC LIMIT 5
      `, p),

      // Cheques a cobrar: cheques recibidos en ventas con vencimiento próximo
      pool.query(`
        SELECT vc.id, vc.banco, vc.numero_cheque,
               vc.fecha_vencimiento::text,
               vc.importe::float,
               (vc.fecha_vencimiento - CURRENT_DATE)::int AS dias,
               COALESCE(c.razon_social, 'Consumidor final') AS referencia
        FROM venta_cheques vc
        JOIN ventas v ON v.id = vc.venta_id AND v.deleted_at IS NULL
        LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE vc.fecha_vencimiento BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 30
        ORDER BY vc.fecha_vencimiento ASC
        LIMIT 20
      `),

      // Cheques a pagar: cheques emitidos en egresos con vencimiento próximo
      pool.query(`
        SELECT ec.id, ec.banco, ec.numero_cheque,
               ec.fecha_vencimiento::text,
               ec.importe::float,
               (ec.fecha_vencimiento - CURRENT_DATE)::int AS dias,
               COALESCE(p.razon_social, e.descripcion, 'Sin referencia') AS referencia
        FROM egreso_cheques ec
        JOIN egreso_pagos ep ON ep.id = ec.egreso_pago_id
        JOIN egresos e ON e.id = ep.egreso_id AND e.deleted_at IS NULL
        LEFT JOIN proveedores p ON p.id = e.proveedor_id
        WHERE ec.fecha_vencimiento BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 30
        ORDER BY ec.fecha_vencimiento ASC
        LIMIT 20
      `),

      // Desglose de cobros de hoy por medio de pago
      pool.query(`
        SELECT
          mp.nombre,
          COUNT(DISTINCT v.id)::int  AS cantidad,
          COALESCE(SUM(vp.monto),0)::float AS monto
        FROM venta_pagos vp
        JOIN ventas v ON v.id = vp.venta_id
          AND v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          AND v.fecha::date = CURRENT_DATE
          ${sucId ? 'AND v.sucursal_id = $1' : ''}
        JOIN medios_pago mp ON mp.id = vp.medio_pago_id
        GROUP BY mp.nombre
        ORDER BY monto DESC
      `, p),

      // Transacciones de hoy (últimas 25)
      pool.query(`
        SELECT
          v.id,
          v.numero,
          v.fecha,
          v.estado,
          v.total::float,
          COALESCE(c.razon_social, 'Consumidor final') AS cliente,
          STRING_AGG(mp.nombre, ' + ' ORDER BY mp.nombre) AS medios_pago
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN venta_pagos vp ON vp.venta_id = v.id
        LEFT JOIN medios_pago mp ON mp.id = vp.medio_pago_id
        WHERE v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          AND v.fecha::date = CURRENT_DATE
          ${sucId ? 'AND v.sucursal_id = $1' : ''}
        GROUP BY v.id, v.numero, v.fecha, v.estado, v.total, c.razon_social
        ORDER BY v.fecha DESC
        LIMIT 25
      `, p),

      // Cobros de HOY por cuenta bancaria destino
      pool.query(`
        SELECT
          vp.cuenta_destino,
          COUNT(DISTINCT v.id)::int       AS cantidad,
          COALESCE(SUM(vp.monto),0)::float AS monto
        FROM venta_pagos vp
        JOIN ventas v ON v.id = vp.venta_id
          AND v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          AND v.fecha::date = CURRENT_DATE
          ${sucId ? 'AND v.sucursal_id = $1' : ''}
        WHERE vp.cuenta_destino IS NOT NULL
        GROUP BY vp.cuenta_destino
        ORDER BY monto DESC
      `, p),

      // Cobros del MES por cuenta bancaria destino
      pool.query(`
        SELECT
          vp.cuenta_destino,
          COALESCE(SUM(vp.monto),0)::float AS monto_mes
        FROM venta_pagos vp
        JOIN ventas v ON v.id = vp.venta_id
          AND v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          AND date_trunc('month', v.fecha) = date_trunc('month', CURRENT_DATE)
          ${sucId ? 'AND v.sucursal_id = $1' : ''}
        WHERE vp.cuenta_destino IS NOT NULL
        GROUP BY vp.cuenta_destino
        ORDER BY monto_mes DESC
      `, p),

      // Caja fuerte: efectivo acumulado por sucursal (todas las sucursales activas)
      pool.query(`
        SELECT
          s.id           AS sucursal_id,
          s.nombre       AS sucursal_nombre,
          COALESCE(cf.saldo, 0)::float AS saldo,
          cf.updated_at
        FROM sucursales s
        LEFT JOIN caja_fuerte cf ON cf.sucursal_id = s.id
        WHERE s.activo = true ${sucId ? 'AND s.id = $1' : ''}
        ORDER BY s.nombre
      `, p),

      // Últimos movimientos del ledger de caja fuerte (mig 047). Es lo que
      // respalda el saldo de arriba: cada peso que entró o salió, con su origen.
      pool.query(`
        SELECT
          m.id, m.fecha, m.created_at, m.tipo, m.monto::float, m.concepto,
          m.origen_tipo, m.origen_id,
          s.nombre AS sucursal_nombre,
          u.nombre AS usuario_nombre
        FROM movimientos_caja_fuerte m
        JOIN sucursales s ON s.id = m.sucursal_id
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        ${sucId ? 'WHERE m.sucursal_id = $1' : ''}
        -- Por created_at, no por fecha: los pagos a proveedor guardan la fecha
        -- del comprobante (sin hora), así que ordenar por ella escondía un pago
        -- recién hecho debajo de movimientos anteriores del mismo día.
        ORDER BY m.created_at DESC
        LIMIT 15
      `, p),

      // Saldos actuales de las cuentas bancarias de la empresa (carga manual),
      // filtrados por la sucursal a la que está vinculada cada cuenta.
      pool.query(`
        SELECT id, nombre, banco, saldo::float, sucursal_id
        FROM cuentas_bancarias_empresa
        WHERE activo = true ${sucId ? 'AND sucursal_id = $1' : ''}
        ORDER BY nombre
      `, p),
    ]);

    const vh  = parseFloat(ventasHoy.rows[0].monto);
    const va  = parseFloat(ventasAyer.rows[0].monto);
    const vm  = parseFloat(ventasMes.rows[0].monto);
    const vma = parseFloat(ventasMesAnt.rows[0].monto);

    // Compras de mercadería: es stock que entra, NO el costo de lo vendido.
    // Antes se restaban como costo y un mes de reposición fuerte daba una
    // "pérdida" que no existía. Se informan aparte.
    const compH  = parseFloat(egresosHoy.rows[0].mercaderia);
    const compA  = parseFloat(egresosAyer.rows[0].mercaderia);
    const compM  = parseFloat(egresosMes.rows[0].mercaderia);
    const compMa = parseFloat(egresosMesAnt.rows[0].mercaderia);

    // Costo de lo vendido y ventas sin IVA por período.
    const [mH, mA, mM, mMa] = await Promise.all([
      margenPeriodo(`v.fecha::date = CURRENT_DATE`, sucId),
      margenPeriodo(`v.fecha::date = CURRENT_DATE - 1`, sucId),
      margenPeriodo(`date_trunc('month', v.fecha) = date_trunc('month', CURRENT_DATE)`, sucId),
      margenPeriodo(`v.fecha::date BETWEEN ${MES_ANT_DESDE} AND ${MES_ANT_HASTA}`, sucId),
    ]);
    const ch = mH.costo, ca = mA.costo, cm = mM.costo, cma = mMa.costo;
    const gh  = parseFloat(egresosHoy.rows[0].gastos);
    const ga  = parseFloat(egresosAyer.rows[0].gastos);
    const gm  = parseFloat(egresosMes.rows[0].gastos);
    const gma = parseFloat(egresosMesAnt.rows[0].gastos);

    // Resultado = ventas sin IVA − costo de lo vendido − gastos operativos.
    const resultado = (m, g) => parseFloat((m.neto - m.costo - g).toFixed(2));
    const pct = (m) => m.neto > 0 ? parseFloat(((m.neto - m.costo) / m.neto * 100).toFixed(1)) : null;

    res.json({
      ventas_hoy:      { cantidad: parseInt(ventasHoy.rows[0].cantidad),  monto: vh },
      ventas_ayer:     { cantidad: parseInt(ventasAyer.rows[0].cantidad), monto: va },
      ventas_mes:      { cantidad: parseInt(ventasMes.rows[0].cantidad),  monto: vm },
      ventas_mes_ant:  { cantidad: parseInt(ventasMesAnt.rows[0].cantidad), monto: vma },
      costo_mercaderia_hoy:     { monto: ch },
      costo_mercaderia_ayer:    { monto: ca },
      costo_mercaderia_mes:     { monto: cm },
      costo_mercaderia_mes_ant: { monto: cma },
      gastos_operativos_hoy:     { monto: gh },
      gastos_operativos_ayer:    { monto: ga },
      gastos_operativos_mes:     { monto: gm },
      gastos_operativos_mes_ant: { monto: gma },
      compras_mercaderia_hoy:     { monto: compH },
      compras_mercaderia_ayer:    { monto: compA },
      compras_mercaderia_mes:     { monto: compM },
      compras_mercaderia_mes_ant: { monto: compMa },
      ventas_netas_mes:     mM.neto,
      ventas_netas_mes_ant: mMa.neto,
      margen_bruto_pct_hoy: pct(mH),
      margen_bruto_pct_mes: pct(mM),
      margen_bruto_pct_mes_ant: pct(mMa),
      resultado_hoy:     resultado(mH, gh),
      resultado_ayer:    resultado(mA, ga),
      resultado_mes:     resultado(mM, gm),
      resultado_mes_ant: resultado(mMa, gma),
      stock_bajo:          parseInt(stockBajo.rows[0].cantidad),
      pedidos_pendientes:  parseInt(pedidosPendientes.rows[0].cantidad),
      ventas_mes_diario:   ventasMesDiario.rows,
      ultimas_ventas:      ultimasVentas.rows,
      cheques_a_cobrar:    chequesACobrar.rows,
      cheques_a_pagar:     chequesAPagar.rows,
      ventas_por_medio:       ventasPorMedio.rows,
      transacciones_hoy:      transaccionesHoy.rows,
      cobros_por_cuenta_hoy:  cobrosPorCuentaHoy.rows,
      cobros_por_cuenta_mes:  cobrosPorCuentaMes.rows,
      caja_fuerte:            cajaFuerte.rows,
      movimientos_caja_fuerte: movimientosCajaFuerte.rows,
      saldos_bancarios:       saldosBancarios.rows,
      // Caja única de la empresa (mig 061): solo para el administrador.
      caja_administrativa: req.usuario?.rol === 'administrador'
        ? (await pool.query(
            `SELECT saldo::float AS saldo, updated_at FROM caja_administrativa WHERE id = 1`
          )).rows[0] ?? null
        : null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
