const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva, requireRol } = require('../middleware/auth');
const router = express.Router();

router.use(requireRol('administrador', 'supervisor'));

// Primer día hábil del mes (saltea sábado y domingo). No contempla feriados.
function primerDiaHabil(anio, mes) {
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Último día del mes (YYYY-MM-DD).
function ultimoDiaMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}

// Categorías (gasto operativo + retiros) sin confirmar para el mes.
async function categoriasFaltantes(anio, mes) {
  const { rows } = await pool.query(`
    SELECT cr.nombre
    FROM categorias_resultado cr
    LEFT JOIN cierre_categoria cc
      ON  cc.categoria_resultado_id = cr.id
      AND cc.periodo_anio = $1 AND cc.periodo_mes = $2
    WHERE cr.seccion IN ('gasto_operativo', 'retiro')
      AND COALESCE(cc.confirmado, FALSE) = FALSE
    ORDER BY cr.orden ASC
  `, [anio, mes]);
  return rows.map((r) => r.nombre);
}

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
          COALESCE(pr.razon_social, e.descripcion, '—') AS proveedor,
          e.descripcion                   AS descripcion,
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

// ─── GET /api/reportes/estado-resultados ─────────────────────────────────────
// ?fecha_desde=  ISO date  (default: primer día del mes)
// ?fecha_hasta=  ISO date  (default: hoy)
router.get('/estado-resultados', async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    // El estado de resultados se calcula por mes. Acepta ?anio=&mes= (modo
    // mensual, default) o ?fecha_desde=&fecha_hasta= (rango custom histórico).
    let anio, mes, desde, hasta;
    if (req.query.fecha_desde || req.query.fecha_hasta) {
      desde = req.query.fecha_desde || hoy.slice(0, 8) + '01';
      hasta = req.query.fecha_hasta || hoy;
      anio  = parseInt(desde.slice(0, 4), 10);
      mes   = parseInt(desde.slice(5, 7), 10);
    } else {
      anio = parseInt(req.query.anio, 10) || parseInt(hoy.slice(0, 4), 10);
      mes  = parseInt(req.query.mes, 10)  || parseInt(hoy.slice(5, 7), 10);
      desde = primerDiaHabil(anio, mes);
      const esMesActual = anio === parseInt(hoy.slice(0, 4), 10) && mes === parseInt(hoy.slice(5, 7), 10);
      hasta = esMesActual ? hoy : ultimoDiaMes(anio, mes);
    }

    // ── Gate de cierre: el estado no se calcula hasta que todas las categorías
    //    operativas + retiros estén confirmadas para el mes ──────────────────
    const faltantes = await categoriasFaltantes(anio, mes);
    if (faltantes.length > 0) {
      return res.json({
        cierre_pendiente: true,
        anio, mes,
        periodo: { desde, hasta },
        faltantes,
      });
    }

    const sucId = sucursalEfectiva(req);
    const sucVenta   = sucId ? 'AND v.sucursal_id   = $3' : '';
    const sucEgreso  = sucId ? 'AND e.sucursal_id   = $3' : '';
    const sucNC      = sucId ? 'AND nc.sucursal_id  = $3' : '';
    const baseParams = sucId ? [desde, hasta, sucId] : [desde, hasta];

    const [ventasRes, ncRes, egresosRes, cogsRes, cogsDevRes, acumRes] = await Promise.all([

      // ── Ventas del período ────────────────────────────────────────
      pool.query(`
        SELECT
          COALESCE(SUM(v.total),            0)::float AS ventas_brutas,
          COALESCE(SUM(v.descuento_total),  0)::float AS descuentos,
          COUNT(v.id)::int                            AS cantidad_ventas
        FROM ventas v
        WHERE v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          AND v.fecha::date BETWEEN $1 AND $2
          ${sucVenta}
      `, baseParams),

      // ── Notas de crédito del período ──────────────────────────────
      pool.query(`
        SELECT COALESCE(SUM(nc.total), 0)::float AS total_nc
        FROM notas_credito nc
        WHERE nc.deleted_at IS NULL
          AND nc.fecha::date BETWEEN $1 AND $2
          ${sucNC}
      `, baseParams).catch(() => ({ rows: [{ total_nc: 0 }] })),

      // ── Egresos agrupados por categoría de resultado ──────────────
      // Se traen TODAS las categorías/rubros/subrubros (LEFT JOIN) para que
      // aparezcan aunque tengan $0. La categoría 'excluido' (Compras) no entra:
      // su costo va como COGS en la utilidad bruta.
      pool.query(`
        SELECT
          cr.id      AS cat_id,
          cr.nombre  AS categoria,
          cr.orden   AS cat_orden,
          cr.seccion AS seccion,
          rg.id      AS rubro_id,
          rg.nombre  AS rubro,
          rg.orden   AS rubro_orden,
          sg.id      AS subrubro_id,
          sg.nombre  AS subrubro,
          COALESCE(SUM(e.total), 0)::float AS monto,
          COUNT(e.id)::int                 AS cantidad
        FROM categorias_resultado cr
        JOIN rubros_gastos rg   ON rg.categoria_resultado_id = cr.id
        JOIN subrubro_gastos sg ON sg.rubro_id = rg.id
        LEFT JOIN egresos e
          ON  e.subrubro_gasto_id = sg.id
          AND e.deleted_at IS NULL
          AND e.fecha_emision::date BETWEEN $1 AND $2
          AND e.tipo_operacion <> 'compra_mercaderia'
          ${sucEgreso}
        WHERE cr.seccion <> 'excluido'
          AND sg.nombre <> 'Compra de mercadería'
        GROUP BY cr.id, cr.nombre, cr.orden, cr.seccion, rg.id, rg.nombre, rg.orden, sg.id, sg.nombre
        ORDER BY cr.orden ASC, rg.orden ASC, monto DESC, sg.nombre ASC
      `, baseParams),

      // ── Costo de mercadería vendida (COGS) del período ────────────
      // Σ cantidad × costo_base del artículo (neto, sin IVA ni flete). El flete
      // NO se incluye acá: se imputa aparte como gasto operativo en el subrubro
      // "Transporte de carga", así que sumarlo al COGS lo duplicaría.
      pool.query(`
        SELECT COALESCE(SUM(vi.cantidad * a.costo_base), 0)::float AS cogs
        FROM venta_items vi
        JOIN ventas v    ON v.id = vi.venta_id
        JOIN articulos a ON a.id = vi.articulo_id
        WHERE v.deleted_at IS NULL
          AND v.estado NOT IN ('anulada','preventa')
          AND v.fecha::date BETWEEN $1 AND $2
          ${sucVenta}
      `, baseParams),

      // ── Costo de los artículos DEVUELTOS (notas de crédito) ───────
      // Se resta del COGS: "costo de vendidos menos devueltos". Las NC guardan
      // los ítems en jsonb con articulo_id + cantidad.
      pool.query(`
        SELECT COALESCE(SUM((it->>'cantidad')::numeric * a.costo_base), 0)::float AS cogs_dev
        FROM notas_credito nc
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(nc.items, '[]'::jsonb)) it
        JOIN articulos a ON a.id = (it->>'articulo_id')::uuid
        WHERE nc.deleted_at IS NULL
          AND nc.fecha::date BETWEEN $1 AND $2
          AND (it->>'articulo_id') IS NOT NULL
          ${sucNC}
      `, baseParams).catch(() => ({ rows: [{ cogs_dev: 0 }] })),

      // ── Resultado acumulado del mes anterior (arrastre) ───────────
      pool.query(`
        SELECT COALESCE(resultado_acumulado, 0)::float AS acum_anterior
        FROM cierre_mensual
        WHERE (periodo_anio, periodo_mes) = ($1, $2)
      `, mes === 1 ? [anio - 1, 12] : [anio, mes - 1]),
    ]);

    const ventas_brutas  = parseFloat(ventasRes.rows[0].ventas_brutas)  || 0;
    const descuentos     = parseFloat(ventasRes.rows[0].descuentos)     || 0;
    const notas_credito  = parseFloat(ncRes.rows[0].total_nc)           || 0;
    const ventas_netas   = ventas_brutas - descuentos - notas_credito;

    // Agrupar subrubros → rubros → categorías
    const catMap = {};
    for (const row of egresosRes.rows) {
      const ck = row.cat_id;
      if (!catMap[ck]) {
        catMap[ck] = {
          categoria_id: row.cat_id,
          categoria:    row.categoria,
          orden:        row.cat_orden,
          seccion:      row.seccion,
          total:        0,
          rubros:       {},
        };
      }
      const cat = catMap[ck];
      cat.total += row.monto;
      if (!cat.rubros[row.rubro_id]) {
        cat.rubros[row.rubro_id] = {
          rubro_id:    row.rubro_id,
          rubro:       row.rubro,
          rubro_orden: row.rubro_orden,
          total:       0,
          subrubros:   [],
        };
      }
      cat.rubros[row.rubro_id].total += row.monto;
      cat.rubros[row.rubro_id].subrubros.push({
        subrubro_id: row.subrubro_id,
        subrubro:    row.subrubro,
        monto:       row.monto,
        cantidad:    row.cantidad,
        es_cero:     row.monto === 0,
      });
    }

    const categorias = Object.values(catMap)
      .map((c) => ({ ...c, rubros: Object.values(c.rubros).sort((a, b) => a.rubro_orden - b.rubro_orden) }))
      .sort((a, b) => a.orden - b.orden);

    const operativas = categorias.filter((c) => c.seccion === 'gasto_operativo');
    const retiros    = categorias.filter((c) => c.seccion === 'retiro');
    const gastos_operativos = operativas.reduce((s, c) => s + c.total, 0);
    const retiros_periodo   = retiros.reduce((s, c) => s + c.total, 0);

    // Costo de mercadería vendida (neto de devoluciones) → Utilidad bruta
    const costo_bruto    = parseFloat(cogsRes.rows[0].cogs)        || 0;
    const costo_devuelto = parseFloat(cogsDevRes.rows[0].cogs_dev) || 0;
    const costo_vendido  = costo_bruto - costo_devuelto;
    const utilidad_bruta = ventas_netas - costo_vendido;

    const utilidad_neta_producto = utilidad_bruta - gastos_operativos;

    const acum_anterior = parseFloat(acumRes.rows[0]?.acum_anterior) || 0;
    const resultado_acumulado = acum_anterior + utilidad_neta_producto - retiros_periodo;

    // Persistir el resultado acumulado del mes para el arrastre del mes siguiente.
    await pool.query(`
      INSERT INTO cierre_mensual (periodo_anio, periodo_mes, resultado_acumulado)
      VALUES ($1, $2, $3)
      ON CONFLICT (periodo_anio, periodo_mes)
      DO UPDATE SET resultado_acumulado = EXCLUDED.resultado_acumulado
    `, [anio, mes, resultado_acumulado]);

    res.json({
      cierre_pendiente: false,
      anio, mes,
      periodo: { desde, hasta },
      ingresos: {
        ventas_brutas,
        descuentos,
        notas_credito,
        ventas_netas,
        cantidad_ventas: ventasRes.rows[0].cantidad_ventas,
      },
      costo_mercaderia: {
        costo_bruto,
        costo_devuelto,
        costo_vendido,
        utilidad_bruta,
        margen_bruto_pct: ventas_netas > 0
          ? parseFloat(((utilidad_bruta / ventas_netas) * 100).toFixed(1))
          : 0,
      },
      gastos: {
        categorias: operativas,
        total: gastos_operativos,
      },
      utilidad_neta_producto,
      retiros: {
        categorias: retiros,
        total: retiros_periodo,
      },
      resultado_acumulado: {
        acumulado_anterior: acum_anterior,
        total: resultado_acumulado,
      },
    });
  } catch (err) { next(err); }
});

// ─── Cierre mensual del estado de resultados ─────────────────────────────────
// GET /api/reportes/estado-resultados/cierre?anio=&mes=
// Devuelve el estado de confirmación de cada categoría del mes.
router.get('/estado-resultados/cierre', async (req, res, next) => {
  try {
    const hoy  = new Date().toISOString().slice(0, 10);
    const anio = parseInt(req.query.anio, 10) || parseInt(hoy.slice(0, 4), 10);
    const mes  = parseInt(req.query.mes, 10)  || parseInt(hoy.slice(5, 7), 10);
    const desde = primerDiaHabil(anio, mes);
    const esMesActual = anio === parseInt(hoy.slice(0, 4), 10) && mes === parseInt(hoy.slice(5, 7), 10);
    const hasta = esMesActual ? hoy : ultimoDiaMes(anio, mes);

    // Monto actual de cada categoría (Σ egresos del mes) + estado de confirmación
    const { rows } = await pool.query(`
      SELECT
        cr.id      AS categoria_id,
        cr.nombre  AS categoria,
        cr.orden,
        cr.seccion,
        COALESCE(SUM(e.total), 0)::float AS monto_actual,
        bool_or(cc.confirmado) AS confirmado
      FROM categorias_resultado cr
      LEFT JOIN rubros_gastos rg   ON rg.categoria_resultado_id = cr.id
      LEFT JOIN subrubro_gastos sg ON sg.rubro_id = rg.id
      LEFT JOIN egresos e
        ON  e.subrubro_gasto_id = sg.id
        AND e.deleted_at IS NULL
        AND e.fecha_emision::date BETWEEN $1 AND $2
        AND e.tipo_operacion <> 'compra_mercaderia'
      LEFT JOIN cierre_categoria cc
        ON  cc.categoria_resultado_id = cr.id
        AND cc.periodo_anio = $3 AND cc.periodo_mes = $4
      WHERE cr.seccion <> 'excluido'
      GROUP BY cr.id, cr.nombre, cr.orden, cr.seccion
      ORDER BY cr.orden ASC
    `, [desde, hasta, anio, mes]);

    const categorias = rows.map((r) => ({
      categoria_id: r.categoria_id,
      categoria:    r.categoria,
      orden:        r.orden,
      seccion:      r.seccion,
      monto_actual: r.monto_actual,
      confirmado:   r.confirmado === true,
    }));
    const faltantes = categorias.filter((c) => !c.confirmado);

    const cierre = await pool.query(
      `SELECT cerrado, resultado_acumulado FROM cierre_mensual WHERE periodo_anio = $1 AND periodo_mes = $2`,
      [anio, mes]
    );

    res.json({
      anio, mes,
      periodo: { desde, hasta },
      categorias,
      listo: faltantes.length === 0,
      faltantes: faltantes.map((c) => c.categoria),
      cerrado: cierre.rows[0]?.cerrado === true,
    });
  } catch (err) { next(err); }
});

// POST /api/reportes/estado-resultados/cierre/confirmar { anio, mes, categoria_resultado_id }
// Confirma una categoría del mes (sirve también para confirmar $0).
router.post('/estado-resultados/cierre/confirmar', async (req, res, next) => {
  try {
    const { anio, mes, categoria_resultado_id } = req.body;
    if (!anio || !mes || !categoria_resultado_id) {
      return res.status(400).json({ error: 'anio, mes y categoria_resultado_id son obligatorios' });
    }
    const usuario_id = req.usuario?.id ?? null;
    await pool.query(`
      INSERT INTO cierre_categoria (periodo_anio, periodo_mes, categoria_resultado_id, confirmado, confirmado_por, confirmado_en)
      VALUES ($1, $2, $3, TRUE, $4, NOW())
      ON CONFLICT (periodo_anio, periodo_mes, categoria_resultado_id)
      DO UPDATE SET confirmado = TRUE, confirmado_por = $4, confirmado_en = NOW()
    `, [anio, mes, categoria_resultado_id, usuario_id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/reportes/estado-resultados/cierre/reabrir { anio, mes, categoria_resultado_id }
// Revierte la confirmación de una categoría (corrección).
router.post('/estado-resultados/cierre/reabrir', async (req, res, next) => {
  try {
    const { anio, mes, categoria_resultado_id } = req.body;
    if (!anio || !mes || !categoria_resultado_id) {
      return res.status(400).json({ error: 'anio, mes y categoria_resultado_id son obligatorios' });
    }
    await pool.query(`
      UPDATE cierre_categoria SET confirmado = FALSE, confirmado_en = NULL
      WHERE periodo_anio = $1 AND periodo_mes = $2 AND categoria_resultado_id = $3
    `, [anio, mes, categoria_resultado_id]);
    // Si el mes estaba cerrado, se reabre.
    await pool.query(
      `UPDATE cierre_mensual SET cerrado = FALSE WHERE periodo_anio = $1 AND periodo_mes = $2`,
      [anio, mes]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
