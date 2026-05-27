const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard
// Devuelve métricas clave del día y del mes en curso
router.get('/', async (req, res, next) => {
  try {
    const sucId = sucursalEfectiva(req);
    const sucFilter = sucId ? 'AND sucursal_id = $1' : '';
    const params = sucId ? [sucId] : [];

    const [
      ventasHoy,
      ventasMes,
      egresosHoy,
      egresosMes,
      stockBajo,
      pedidosPendientes,
      ultimasVentas,
    ] = await Promise.all([

      // Ventas del día (total y cantidad)
      pool.query(`
        SELECT
          COUNT(*)                          AS cantidad,
          COALESCE(SUM(total), 0)           AS monto
        FROM ventas
        WHERE deleted_at IS NULL
          AND estado NOT IN ('anulada','preventa')
          AND fecha::date = CURRENT_DATE
          ${sucFilter}
      `, params),

      // Ventas del mes
      pool.query(`
        SELECT
          COUNT(*)                          AS cantidad,
          COALESCE(SUM(total), 0)           AS monto
        FROM ventas
        WHERE deleted_at IS NULL
          AND estado NOT IN ('anulada','preventa')
          AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
          ${sucFilter}
      `, params),

      // Egresos del día
      pool.query(`
        SELECT COALESCE(SUM(total), 0) AS monto
        FROM egresos
        WHERE deleted_at IS NULL
          AND fecha_emision = CURRENT_DATE
          ${sucFilter}
      `, params),

      // Egresos del mes
      pool.query(`
        SELECT COALESCE(SUM(total), 0) AS monto
        FROM egresos
        WHERE deleted_at IS NULL
          AND date_trunc('month', fecha_emision) = date_trunc('month', CURRENT_DATE)
          ${sucFilter}
      `, params),

      // Artículos con stock bajo (cantidad <= stock_minimo)
      pool.query(`
        SELECT COUNT(*) AS cantidad
        FROM stock s
        JOIN articulos a ON a.id = s.articulo_id
        WHERE a.deleted_at IS NULL
          AND a.activo = TRUE
          AND s.cantidad <= s.stock_minimo
          ${sucId ? 'AND s.sucursal_id = $1' : ''}
      `, params),

      // Pedidos a proveedor pendientes de recepción
      pool.query(`
        SELECT COUNT(*) AS cantidad
        FROM pedidos_compra
        WHERE estado IN ('pendiente','confirmado')
      `),

      // Últimas 5 ventas
      pool.query(`
        SELECT
          v.id, v.numero, v.total, v.fecha, v.estado,
          c.razon_social AS cliente
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          ${sucFilter}
        ORDER BY v.fecha DESC
        LIMIT 5
      `, params),

    ]);

    res.json({
      ventas_hoy: {
        cantidad: parseInt(ventasHoy.rows[0].cantidad),
        monto:    parseFloat(ventasHoy.rows[0].monto),
      },
      ventas_mes: {
        cantidad: parseInt(ventasMes.rows[0].cantidad),
        monto:    parseFloat(ventasMes.rows[0].monto),
      },
      egresos_hoy: {
        monto: parseFloat(egresosHoy.rows[0].monto),
      },
      egresos_mes: {
        monto: parseFloat(egresosMes.rows[0].monto),
      },
      resultado_hoy: parseFloat(ventasHoy.rows[0].monto) - parseFloat(egresosHoy.rows[0].monto),
      resultado_mes: parseFloat(ventasMes.rows[0].monto) - parseFloat(egresosMes.rows[0].monto),
      stock_bajo: parseInt(stockBajo.rows[0].cantidad),
      pedidos_pendientes: parseInt(pedidosPendientes.rows[0].cantidad),
      ultimas_ventas: ultimasVentas.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
