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
// ?fecha_desde=  ISO date  (default: primer día del mes)
// ?fecha_hasta=  ISO date  (default: hoy)
// ?rubro_id=     UUID      (opcional — filtra un rubro específico)
router.get('/gastos', async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta, rubro_id } = req.query;
    const hoy   = new Date().toISOString().slice(0, 10);
    const desde = fecha_desde || hoy.slice(0, 8) + '01';
    const hasta = fecha_hasta || hoy;

    const sucId = sucursalEfectiva(req);

    // Construir filtros reutilizables
    const condiciones = [`e.deleted_at IS NULL`, `e.fecha_emision::date BETWEEN $1 AND $2`];
    const params = [desde, hasta];
    let idx = 3;

    if (sucId) {
      condiciones.push(`e.sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (rubro_id) {
      condiciones.push(`rg.id = $${idx++}`);
      params.push(rubro_id);
    }

    const where = condiciones.join(' AND ');

    const [resumen, porRubro, porDia, porSucursal, rubrosDisp, detalle] = await Promise.all([

      // ── Resumen total ──────────────────────────────────────────────
      pool.query(`
        SELECT
          COUNT(e.id)::int                              AS cantidad_egresos,
          COALESCE(SUM(e.total), 0)::float              AS total_gastos,
          COALESCE(AVG(e.total), 0)::float              AS promedio,
          COALESCE(SUM(e.total) FILTER (
            WHERE e.estado_pago = 'pagado'), 0)::float  AS total_pagado,
          COALESCE(SUM(e.total) FILTER (
            WHERE e.estado_pago = 'pendiente'), 0)::float AS total_pendiente
        FROM egresos e
        LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
        LEFT JOIN rubros_gastos   rg ON rg.id = sg.rubro_id
        WHERE ${where}
      `, params),

      // ── Por rubro > subrubro ───────────────────────────────────────
      pool.query(`
        SELECT
          COALESCE(rg.nombre, 'Sin rubro')   AS rubro,
          rg.id                              AS rubro_id,
          COALESCE(sg.nombre, 'Sin subrubro') AS subrubro,
          sg.id                              AS subrubro_id,
          COUNT(e.id)::int                   AS cantidad,
          COALESCE(SUM(e.total), 0)::float   AS monto
        FROM egresos e
        LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
        LEFT JOIN rubros_gastos   rg ON rg.id = sg.rubro_id
        WHERE ${where}
        GROUP BY rg.id, rg.nombre, sg.id, sg.nombre
        ORDER BY monto DESC
      `, params),

      // ── Por día ───────────────────────────────────────────────────
      pool.query(`
        SELECT
          gs.dia::text AS dia,
          COALESCE(d.cantidad, 0)::int   AS cantidad,
          COALESCE(d.monto,    0)::float AS monto
        FROM generate_series($1::date, $2::date, '1 day') AS gs(dia)
        LEFT JOIN (
          SELECT
            e.fecha_emision::date AS dia,
            COUNT(e.id)::int      AS cantidad,
            SUM(e.total)::float   AS monto
          FROM egresos e
          LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
          LEFT JOIN rubros_gastos   rg ON rg.id = sg.rubro_id
          WHERE ${where}
          GROUP BY e.fecha_emision::date
        ) d ON gs.dia = d.dia
        ORDER BY gs.dia ASC
      `, params),

      // ── Por sucursal ──────────────────────────────────────────────
      sucId
        ? Promise.resolve({ rows: [] })
        : pool.query(`
            SELECT
              s.nombre                        AS sucursal,
              COUNT(e.id)::int                AS cantidad,
              COALESCE(SUM(e.total), 0)::float AS monto
            FROM egresos e
            JOIN sucursales s ON s.id = e.sucursal_id
            LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
            LEFT JOIN rubros_gastos   rg ON rg.id = sg.rubro_id
            WHERE ${where}
            GROUP BY s.nombre
            ORDER BY monto DESC
          `, params),

      // ── Rubros disponibles (para el filtro del frontend) ──────────
      pool.query(`SELECT id, nombre FROM rubros_gastos ORDER BY nombre`),

      // ── Detalle de egresos ─────────────────────────────────────────
      pool.query(`
        SELECT
          e.id,
          e.fecha_emision::text           AS fecha,
          COALESCE(rg.nombre, 'Sin rubro')    AS rubro,
          COALESCE(sg.nombre, 'Sin subrubro') AS subrubro,
          COALESCE(pr.razon_social, e.descripcion_general, '—') AS proveedor,
          e.descripcion_general           AS descripcion,
          e.total::float                  AS monto,
          e.estado_pago,
          s.nombre                        AS sucursal
        FROM egresos e
        LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
        LEFT JOIN rubros_gastos   rg ON rg.id = sg.rubro_id
        LEFT JOIN proveedores     pr ON pr.id = e.proveedor_id
        LEFT JOIN sucursales       s ON s.id  = e.sucursal_id
        WHERE ${where}
        ORDER BY e.fecha_emision DESC, e.total DESC
        LIMIT 300
      `, params),
    ]);

    // Agrupar subrubros bajo su rubro para la respuesta
    const rubroMap = {};
    for (const row of porRubro.rows) {
      const key = row.rubro_id ?? '__sin_rubro__';
      if (!rubroMap[key]) {
        rubroMap[key] = { rubro: row.rubro, rubro_id: row.rubro_id, monto: 0, cantidad: 0, subrubros: [] };
      }
      rubroMap[key].monto    += row.monto;
      rubroMap[key].cantidad += row.cantidad;
      rubroMap[key].subrubros.push({ subrubro: row.subrubro, subrubro_id: row.subrubro_id, monto: row.monto, cantidad: row.cantidad });
    }
    const totalGastos = resumen.rows[0].total_gastos || 1;
    const porRubroAgrupado = Object.values(rubroMap)
      .sort((a, b) => b.monto - a.monto)
      .map(r => ({ ...r, porcentaje: parseFloat(((r.monto / totalGastos) * 100).toFixed(1)) }));

    res.json({
      periodo:      { desde, hasta },
      resumen:      resumen.rows[0],
      por_rubro:    porRubroAgrupado,
      por_dia:      porDia.rows,
      por_sucursal: porSucursal.rows,
      rubros:       rubrosDisp.rows,
      detalle:      detalle.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
