const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva, requireRol } = require('../middleware/auth');

const router = express.Router();

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
        AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month') ${sf}`, p),

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
        AND date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month') ${sf}`, p),

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
          m.id, m.fecha, m.tipo, m.monto::float, m.concepto,
          m.origen_tipo, m.origen_id,
          s.nombre AS sucursal_nombre,
          u.nombre AS usuario_nombre
        FROM movimientos_caja_fuerte m
        JOIN sucursales s ON s.id = m.sucursal_id
        LEFT JOIN usuarios u ON u.id = m.usuario_id
        ${sucId ? 'WHERE m.sucursal_id = $1' : ''}
        ORDER BY m.fecha DESC, m.created_at DESC
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

    // Egresos divididos: costo de mercadería vs gastos operativos (no mercadería)
    const ch  = parseFloat(egresosHoy.rows[0].mercaderia);
    const ca  = parseFloat(egresosAyer.rows[0].mercaderia);
    const cm  = parseFloat(egresosMes.rows[0].mercaderia);
    const cma = parseFloat(egresosMesAnt.rows[0].mercaderia);
    const gh  = parseFloat(egresosHoy.rows[0].gastos);
    const ga  = parseFloat(egresosAyer.rows[0].gastos);
    const gm  = parseFloat(egresosMes.rows[0].gastos);
    const gma = parseFloat(egresosMesAnt.rows[0].gastos);

    // Egreso total (costo + gastos) usado para el resultado
    const eh = ch + gh, ea = ca + ga, em = cm + gm, ema = cma + gma;

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
      resultado_hoy:   parseFloat((vh - eh).toFixed(2)),
      resultado_ayer:  parseFloat((va - ea).toFixed(2)),
      resultado_mes:   parseFloat((vm - em).toFixed(2)),
      resultado_mes_ant: parseFloat((vma - ema).toFixed(2)),
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
    });
  } catch (err) { next(err); }
});

module.exports = router;
