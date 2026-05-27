const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

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
      ventas7Dias,
      ultimasVentas,
      chequesACobrar,
      chequesAPagar,
      ventasPorMedio,
      transaccionesHoy,
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

      pool.query(`SELECT COALESCE(SUM(total),0) AS monto
        FROM egresos WHERE deleted_at IS NULL AND fecha_emision = CURRENT_DATE ${sf}`, p),

      pool.query(`SELECT COALESCE(SUM(total),0) AS monto
        FROM egresos WHERE deleted_at IS NULL AND fecha_emision = CURRENT_DATE - 1 ${sf}`, p),

      pool.query(`SELECT COALESCE(SUM(total),0) AS monto
        FROM egresos WHERE deleted_at IS NULL
        AND date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE) ${sf}`, p),

      pool.query(`SELECT COALESCE(SUM(total),0) AS monto
        FROM egresos WHERE deleted_at IS NULL
        AND date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month') ${sf}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad
        FROM stock s JOIN articulos a ON a.id = s.articulo_id
        WHERE a.deleted_at IS NULL AND a.activo = TRUE AND s.cantidad <= s.stock_minimo
        ${sucId ? 'AND s.sucursal_id = $1' : ''}`, p),

      pool.query(`SELECT COUNT(*) AS cantidad FROM pedidos_compra
        WHERE estado IN ('pendiente','confirmado')`),

      // 7-day breakdown with generate_series so empty days return 0
      pool.query(`
        SELECT d.dia::text, COALESCE(v.cantidad,0)::int AS cantidad,
               COALESCE(v.monto,0)::float AS monto
        FROM (
          SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, INTERVAL '1 day')::date AS dia
        ) d
        LEFT JOIN (
          SELECT fecha::date AS dia, COUNT(*) AS cantidad, SUM(total) AS monto
          FROM ventas
          WHERE deleted_at IS NULL AND estado NOT IN ('anulada','preventa')
            AND fecha::date >= CURRENT_DATE - 6
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
    ]);

    const vh  = parseFloat(ventasHoy.rows[0].monto);
    const va  = parseFloat(ventasAyer.rows[0].monto);
    const vm  = parseFloat(ventasMes.rows[0].monto);
    const vma = parseFloat(ventasMesAnt.rows[0].monto);
    const eh  = parseFloat(egresosHoy.rows[0].monto);
    const ea  = parseFloat(egresosAyer.rows[0].monto);
    const em  = parseFloat(egresosMes.rows[0].monto);
    const ema = parseFloat(egresosMesAnt.rows[0].monto);

    res.json({
      ventas_hoy:      { cantidad: parseInt(ventasHoy.rows[0].cantidad),  monto: vh },
      ventas_ayer:     { cantidad: parseInt(ventasAyer.rows[0].cantidad), monto: va },
      ventas_mes:      { cantidad: parseInt(ventasMes.rows[0].cantidad),  monto: vm },
      ventas_mes_ant:  { cantidad: parseInt(ventasMesAnt.rows[0].cantidad), monto: vma },
      egresos_hoy:     { monto: eh },
      egresos_ayer:    { monto: ea },
      egresos_mes:     { monto: em },
      egresos_mes_ant: { monto: ema },
      resultado_hoy:   parseFloat((vh - eh).toFixed(2)),
      resultado_ayer:  parseFloat((va - ea).toFixed(2)),
      resultado_mes:   parseFloat((vm - em).toFixed(2)),
      resultado_mes_ant: parseFloat((vma - ema).toFixed(2)),
      stock_bajo:          parseInt(stockBajo.rows[0].cantidad),
      pedidos_pendientes:  parseInt(pedidosPendientes.rows[0].cantidad),
      ventas_7dias:        ventas7Dias.rows,
      ultimas_ventas:      ultimasVentas.rows,
      cheques_a_cobrar:    chequesACobrar.rows,
      cheques_a_pagar:     chequesAPagar.rows,
      ventas_por_medio:    ventasPorMedio.rows,
      transacciones_hoy:   transaccionesHoy.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
