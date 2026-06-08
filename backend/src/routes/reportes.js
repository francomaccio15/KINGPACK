const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');
const router = express.Router();

// GET /api/reportes/ventas
// ?fecha_desde=  ISO date (default: first day of current month)
// ?fecha_hasta=  ISO date (default: today)
// ?sucursal_id=  (handled by sucursalEfectiva)
router.get('/ventas', async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;
    const hoy = new Date().toISOString().slice(0, 10);
    const primerDiaMes = hoy.slice(0, 8) + '01';
    const desde = fecha_desde || primerDiaMes;
    const hasta = fecha_hasta || hoy;

    const sucId = sucursalEfectiva(req);
    const sucFiltro = sucId ? 'AND v.sucursal_id = $3' : '';
    const baseParams = sucId ? [desde, hasta, sucId] : [desde, hasta];

    const [resumen, porDia, porMedioPago, topArticulos, porSucursal] = await Promise.all([
      // Resumen total del período
      pool.query(`
        SELECT
          COUNT(*)::int AS cantidad_ventas,
          COALESCE(SUM(v.total), 0)::float AS total_ventas,
          COALESCE(SUM(v.descuento_total), 0)::float AS total_descuentos,
          COALESCE(AVG(v.total), 0)::float AS ticket_promedio,
          COUNT(DISTINCT v.cliente_id) FILTER (WHERE v.cliente_id IS NOT NULL)::int AS clientes_distintos
        FROM ventas v
        WHERE v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada', 'preventa')
          AND v.fecha::date BETWEEN $1 AND $2
          ${sucFiltro}
      `, baseParams),

      // Ventas por día (incluye días sin ventas via generate_series)
      pool.query(`
        SELECT
          gs.dia::text AS dia,
          COALESCE(d.cantidad, 0)::int AS cantidad,
          COALESCE(d.monto, 0)::float AS monto
        FROM generate_series($1::date, $2::date, '1 day'::interval) AS gs(dia)
        LEFT JOIN (
          SELECT
            v.fecha::date AS dia,
            COUNT(*)::int AS cantidad,
            COALESCE(SUM(v.total), 0)::float AS monto
          FROM ventas v
          WHERE v.deleted_at IS NULL
            AND v.estado NOT IN ('anulada', 'preventa')
            AND v.fecha::date BETWEEN $1 AND $2
            ${sucFiltro}
          GROUP BY v.fecha::date
        ) d ON gs.dia = d.dia
        ORDER BY gs.dia ASC
      `, baseParams),

      // Por medio de pago
      pool.query(`
        SELECT
          mp.nombre,
          COUNT(DISTINCT v.id)::int AS cantidad_ventas,
          COALESCE(SUM(vp.monto), 0)::float AS monto
        FROM venta_pagos vp
        JOIN ventas v ON v.id = vp.venta_id
          AND v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada', 'preventa')
          AND v.fecha::date BETWEEN $1 AND $2
          ${sucFiltro}
        JOIN medios_pago mp ON mp.id = vp.medio_pago_id
        GROUP BY mp.nombre
        ORDER BY monto DESC
      `, baseParams),

      // Top 20 artículos más vendidos
      pool.query(`
        SELECT
          a.nombre,
          a.codigo,
          SUM(vi.cantidad)::float AS cantidad_total,
          COALESCE(SUM(vi.precio_unitario_final * vi.cantidad), 0)::float AS monto_total,
          COUNT(DISTINCT v.id)::int AS en_ventas
        FROM venta_items vi
        JOIN ventas v ON v.id = vi.venta_id
          AND v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada', 'preventa')
          AND v.fecha::date BETWEEN $1 AND $2
          ${sucFiltro}
        JOIN articulos a ON a.id = vi.articulo_id
        GROUP BY a.nombre, a.codigo
        ORDER BY monto_total DESC
        LIMIT 20
      `, baseParams),

      // Por sucursal (solo cuando no hay filtro de sucursal)
      sucId ? Promise.resolve({ rows: [] }) : pool.query(`
        SELECT
          s.nombre AS sucursal,
          COUNT(DISTINCT v.id)::int AS cantidad,
          COALESCE(SUM(v.total), 0)::float AS monto
        FROM ventas v
        JOIN sucursales s ON s.id = v.sucursal_id
        WHERE v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada', 'preventa')
          AND v.fecha::date BETWEEN $1 AND $2
        GROUP BY s.nombre
        ORDER BY monto DESC
      `, baseParams),
    ]);

    res.json({
      periodo: { desde, hasta },
      resumen: resumen.rows[0],
      por_dia: porDia.rows,
      por_medio_pago: porMedioPago.rows,
      top_articulos: topArticulos.rows,
      por_sucursal: porSucursal.rows,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/reportes/gastos ─────────────────────────────────────────────────
// ?fecha_desde= &fecha_hasta= &sucursal_id=
router.get('/gastos', async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;
    const hoy = new Date().toISOString().slice(0, 10);
    const primerDiaMes = hoy.slice(0, 8) + '01';
    const desde = fecha_desde || primerDiaMes;
    const hasta  = fecha_hasta || hoy;

    const sucId = sucursalEfectiva(req);
    const sucFiltro = sucId ? 'AND e.sucursal_id = $3' : '';
    const baseParams = sucId ? [desde, hasta, sucId] : [desde, hasta];

    const [resumen, porRubro, porDia, porTipo] = await Promise.all([

      // KPIs del período
      pool.query(`
        SELECT
          COUNT(*)::int               AS cantidad_egresos,
          COALESCE(SUM(e.total), 0)::float  AS total_gastos,
          COALESCE(AVG(e.total), 0)::float  AS promedio_egreso
        FROM egresos e
        WHERE e.fecha_emision BETWEEN $1 AND $2
          ${sucFiltro}
      `, baseParams),

      // Por rubro → subrubro
      pool.query(`
        SELECT
          COALESCE(rg.nombre, 'Sin clasificar')  AS rubro,
          COALESCE(sg.nombre, 'Sin subrubro')    AS subrubro,
          COUNT(*)::int                           AS cantidad,
          COALESCE(SUM(e.total), 0)::float        AS total,
          COALESCE(AVG(e.total), 0)::float        AS promedio,
          e.tipo_operacion
        FROM egresos e
        LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
        LEFT JOIN rubros_gastos   rg ON rg.id = sg.rubro_id
        WHERE e.fecha_emision BETWEEN $1 AND $2
          ${sucFiltro}
        GROUP BY rg.nombre, sg.nombre, e.tipo_operacion
        ORDER BY SUM(e.total) DESC
      `, baseParams),

      // Gastos por día
      pool.query(`
        SELECT
          gs.dia::text AS dia,
          COALESCE(d.cantidad, 0)::int AS cantidad,
          COALESCE(d.total, 0)::float  AS total
        FROM generate_series($1::date, $2::date, '1 day'::interval) AS gs(dia)
        LEFT JOIN (
          SELECT fecha_emision::date AS dia,
                 COUNT(*)::int AS cantidad,
                 SUM(total)::float AS total
          FROM egresos e
          WHERE e.fecha_emision BETWEEN $1 AND $2
            ${sucFiltro}
          GROUP BY fecha_emision::date
        ) d ON gs.dia = d.dia
        ORDER BY gs.dia ASC
      `, baseParams),

      // Por tipo de operación
      pool.query(`
        SELECT
          e.tipo_operacion,
          COUNT(*)::int            AS cantidad,
          SUM(e.total)::float      AS total
        FROM egresos e
        WHERE e.fecha_emision BETWEEN $1 AND $2
          ${sucFiltro}
        GROUP BY e.tipo_operacion
        ORDER BY total DESC
      `, baseParams),
    ]);

    res.json({
      periodo:  { desde, hasta },
      resumen:  resumen.rows[0],
      por_rubro: porRubro.rows,
      por_dia:   porDia.rows,
      por_tipo:  porTipo.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
