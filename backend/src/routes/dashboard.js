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
    });
  } catch (err) { next(err); }
});

module.exports = router;
