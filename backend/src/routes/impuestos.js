const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────
const dateRange = (desde, hasta) => {
  const d = desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const h = hasta  || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  return { d, h };
};

// ─── GET /api/impuestos/libro-iva-ventas ──────────────────────────────────────
// Libro IVA Ventas: ventas confirmadas/facturadas con desglose por alícuota
// ?desde= &hasta= &sucursal_id=
router.get('/libro-iva-ventas', async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const { d, h } = dateRange(desde, hasta);
    const sucId = req.query.sucursal_id || sucursalEfectiva(req);

    const conditions = [
      `v.estado IN ('confirmada','facturada')`,
      `v.deleted_at IS NULL`,
      `v.fecha::date BETWEEN $1 AND $2`,
    ];
    const params = [d, h];
    let idx = 3;

    if (sucId) {
      conditions.push(`v.sucursal_id = $${idx++}`);
      params.push(sucId);
    }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        v.id,
        v.fecha::date                                AS fecha,
        v.numero,
        COALESCE(c.razon_social, 'Consumidor Final') AS cliente_nombre,
        COALESCE(c.cuit, '—')                        AS cliente_cuit,
        COALESCE(ci.nombre, '—')                     AS cond_iva,
        s.nombre                                     AS sucursal_nombre,

        -- Facturación (si existe)
        f.tipo_comprobante,
        f.punto_venta                                AS punto_venta,
        f.numero                                     AS factura_numero,
        f.cae,

        -- Neto gravado 21%
        COALESCE(SUM(vi.precio_unitario_final * vi.cantidad)
          FILTER (WHERE ai.porcentaje = 21), 0)      AS neto_21,
        -- IVA 21%
        COALESCE(SUM(vi.iva_monto)
          FILTER (WHERE ai.porcentaje = 21), 0)      AS iva_21,

        -- Neto gravado 10.5%
        COALESCE(SUM(vi.precio_unitario_final * vi.cantidad)
          FILTER (WHERE ai.porcentaje = 10.5), 0)    AS neto_105,
        -- IVA 10.5%
        COALESCE(SUM(vi.iva_monto)
          FILTER (WHERE ai.porcentaje = 10.5), 0)    AS iva_105,

        -- Exento / No gravado (IVA 0%)
        COALESCE(SUM(vi.precio_unitario_final * vi.cantidad)
          FILTER (WHERE ai.porcentaje = 0 OR ai.porcentaje IS NULL), 0) AS neto_exento,

        -- Total registrado en la venta
        v.total

      FROM ventas v
      LEFT JOIN clientes    c  ON c.id  = v.cliente_id
      LEFT JOIN cond_iva    ci ON ci.id = c.cond_iva_id
      LEFT JOIN sucursales  s  ON s.id  = v.sucursal_id
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN articulos   a  ON a.id  = vi.articulo_id
      LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
      LEFT JOIN LATERAL (
        SELECT tc.descripcion AS tipo_comprobante, f.punto_venta, f.numero, f.cae
          FROM facturaciones f
          LEFT JOIN tipos_comprobante tc ON tc.id = f.tipo_comprobante_id
         WHERE f.venta_id = v.id AND f.ok = true
         ORDER BY f.created_at DESC LIMIT 1
      ) f ON true
      WHERE ${where}
      GROUP BY
        v.id, v.fecha, v.numero, c.razon_social, c.cuit, ci.nombre,
        s.nombre, f.tipo_comprobante, f.punto_venta, f.numero, f.cae, v.total
      ORDER BY v.fecha DESC, v.numero DESC
    `, params);

    // Totales
    const totales = rows.reduce((acc, r) => ({
      neto_21:     acc.neto_21     + parseFloat(r.neto_21),
      iva_21:      acc.iva_21      + parseFloat(r.iva_21),
      neto_105:    acc.neto_105    + parseFloat(r.neto_105),
      iva_105:     acc.iva_105     + parseFloat(r.iva_105),
      neto_exento: acc.neto_exento + parseFloat(r.neto_exento),
      total:       acc.total       + parseFloat(r.total),
    }), { neto_21: 0, iva_21: 0, neto_105: 0, iva_105: 0, neto_exento: 0, total: 0 });

    res.json({ ventas: rows, totales, desde: d, hasta: h });
  } catch (err) { next(err); }
});

// ─── GET /api/impuestos/libro-iva-compras ─────────────────────────────────────
// Libro IVA Compras: egresos con comprobante y desglose fiscal
// ?desde= &hasta= &sucursal_id=
router.get('/libro-iva-compras', async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const { d, h } = dateRange(desde, hasta);
    const sucId = req.query.sucursal_id || sucursalEfectiva(req);

    const conditions = [
      `e.tipo_comprobante IS NOT NULL`,
      `e.tipo_comprobante != 'informal'`,
      `e.fecha_emision BETWEEN $1 AND $2`,
    ];
    const params = [d, h];
    let idx = 3;

    if (sucId) {
      conditions.push(`e.sucursal_id = $${idx++}`);
      params.push(sucId);
    }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.fecha_emision                              AS fecha,
        e.tipo_comprobante,
        e.punto_venta,
        e.numero_comprobante,
        COALESCE(pr.razon_social, 'Sin proveedor')   AS proveedor_nombre,
        COALESCE(pr.cuit, '—')                       AS proveedor_cuit,
        s.nombre                                     AS sucursal_nombre,
        e.tipo_operacion,
        e.descripcion,

        e.neto_gravado,
        e.neto_no_gravado,
        e.iva_21,
        e.iva_105,
        e.percepciones_ib,
        e.otros_impuestos,
        e.total,

        -- Señalar si no tiene CUIT (no computa crédito fiscal AFIP)
        (pr.cuit IS NULL OR pr.cuit = '') AS sin_cuit

      FROM egresos e
      LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
      LEFT JOIN sucursales  s  ON s.id  = e.sucursal_id
      WHERE ${where}
      ORDER BY e.fecha_emision DESC, e.numero_comprobante DESC
    `, params);

    const totales = rows.reduce((acc, r) => ({
      neto_gravado:    acc.neto_gravado    + parseFloat(r.neto_gravado    || 0),
      neto_no_gravado: acc.neto_no_gravado + parseFloat(r.neto_no_gravado || 0),
      iva_21:          acc.iva_21          + parseFloat(r.iva_21          || 0),
      iva_105:         acc.iva_105         + parseFloat(r.iva_105         || 0),
      percepciones_ib: acc.percepciones_ib + parseFloat(r.percepciones_ib || 0),
      otros_impuestos: acc.otros_impuestos + parseFloat(r.otros_impuestos || 0),
      total:           acc.total           + parseFloat(r.total           || 0),
    }), { neto_gravado: 0, neto_no_gravado: 0, iva_21: 0, iva_105: 0, percepciones_ib: 0, otros_impuestos: 0, total: 0 });

    // Crédito fiscal real (solo con CUIT)
    const creditoFiscalValido = rows
      .filter(r => !r.sin_cuit)
      .reduce((s, r) => s + parseFloat(r.iva_21 || 0) + parseFloat(r.iva_105 || 0), 0);

    res.json({ compras: rows, totales, credito_fiscal_valido: creditoFiscalValido, desde: d, hasta: h });
  } catch (err) { next(err); }
});

// ─── GET /api/impuestos/posicion-iva ─────────────────────────────────────────
// Posición IVA mensual: Débito Fiscal vs Crédito Fiscal, saldo, YTD
// ?anio=  (default: año actual)
// ?sucursal_id=
router.get('/posicion-iva', async (req, res, next) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const sucId = req.query.sucursal_id || sucursalEfectiva(req);

    const desdeAnio = `${anio}-01-01`;
    const hastaAnio = `${anio}-12-31`;

    const sucFiltroV = sucId ? `AND v.sucursal_id = $3` : '';
    const sucFiltroE = sucId ? `AND e.sucursal_id = $3` : '';
    const params = sucId ? [desdeAnio, hastaAnio, sucId] : [desdeAnio, hastaAnio];

    // Débito Fiscal por mes (IVA ventas confirmadas/facturadas)
    const { rows: debitoRows } = await pool.query(`
      SELECT
        DATE_TRUNC('month', v.fecha)::date   AS mes,
        COALESCE(SUM(vi.iva_monto), 0)       AS debito_total,
        COALESCE(SUM(vi.iva_monto) FILTER (WHERE ai.porcentaje = 21),   0) AS debito_21,
        COALESCE(SUM(vi.iva_monto) FILTER (WHERE ai.porcentaje = 10.5), 0) AS debito_105,
        COALESCE(SUM(vi.precio_unitario_final * vi.cantidad), 0) AS neto_ventas,
        COUNT(DISTINCT v.id)                 AS cant_ventas
      FROM ventas v
      LEFT JOIN venta_items  vi ON vi.venta_id = v.id
      LEFT JOIN articulos    a  ON a.id = vi.articulo_id
      LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
      WHERE v.estado IN ('confirmada','facturada')
        AND v.deleted_at IS NULL
        AND v.fecha BETWEEN $1 AND $2
        ${sucFiltroV}
      GROUP BY DATE_TRUNC('month', v.fecha)
      ORDER BY mes
    `, params);

    // Crédito Fiscal por mes (IVA egresos con CUIT)
    const { rows: creditoRows } = await pool.query(`
      SELECT
        DATE_TRUNC('month', e.fecha_emision)::date AS mes,
        COALESCE(SUM(e.iva_21 + e.iva_105), 0)    AS credito_total,
        COALESCE(SUM(e.iva_21), 0)                 AS credito_21,
        COALESCE(SUM(e.iva_105), 0)                AS credito_105,
        COALESCE(SUM(e.neto_gravado), 0)           AS neto_compras,
        COUNT(*)                                   AS cant_compras
      FROM egresos e
      LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
      WHERE e.tipo_comprobante IS NOT NULL
        AND e.tipo_comprobante != 'informal'
        AND e.fecha_emision BETWEEN $1 AND $2
        AND (pr.cuit IS NOT NULL AND pr.cuit != '')
        ${sucFiltroE}
      GROUP BY DATE_TRUNC('month', e.fecha_emision)
      ORDER BY mes
    `, params);

    // Combinar por mes
    const mesesSet = new Set([
      ...debitoRows.map(r => r.mes?.toISOString?.().slice(0, 7) ?? ''),
      ...creditoRows.map(r => r.mes?.toISOString?.().slice(0, 7) ?? ''),
    ]);
    const meses = [...mesesSet].filter(Boolean).sort();

    const debitoMap  = Object.fromEntries(debitoRows.map(r => [r.mes?.toISOString?.().slice(0, 7), r]));
    const creditoMap = Object.fromEntries(creditoRows.map(r => [r.mes?.toISOString?.().slice(0, 7), r]));

    let saldoAcumulado = 0;
    const posicion = meses.map(mes => {
      const d = debitoMap[mes]  || {};
      const c = creditoMap[mes] || {};
      const debito  = parseFloat(d.debito_total  || 0);
      const credito = parseFloat(c.credito_total || 0);
      const saldo   = parseFloat((debito - credito).toFixed(2));
      saldoAcumulado = parseFloat((saldoAcumulado + saldo).toFixed(2));

      return {
        mes,
        debito_fiscal:    debito,
        debito_21:        parseFloat(d.debito_21   || 0),
        debito_105:       parseFloat(d.debito_105  || 0),
        credito_fiscal:   credito,
        credito_21:       parseFloat(c.credito_21  || 0),
        credito_105:      parseFloat(c.credito_105 || 0),
        saldo_mes:        saldo,
        saldo_acumulado:  saldoAcumulado,
        neto_ventas:      parseFloat(d.neto_ventas  || 0),
        neto_compras:     parseFloat(c.neto_compras || 0),
        cant_ventas:      parseInt(d.cant_ventas    || 0),
        cant_compras:     parseInt(c.cant_compras   || 0),
        estado:           saldo > 0 ? 'a_pagar' : saldo < 0 ? 'saldo_favor' : 'neutro',
      };
    });

    // YTD y métricas globales
    const ytd = posicion.reduce((acc, p) => ({
      debito:  acc.debito  + p.debito_fiscal,
      credito: acc.credito + p.credito_fiscal,
      saldo:   acc.saldo   + p.saldo_mes,
    }), { debito: 0, credito: 0, saldo: 0 });

    // Proyección: promedio móvil últimos 3 meses
    const ultimos3 = posicion.slice(-3);
    const proyeccion = ultimos3.length
      ? parseFloat((ultimos3.reduce((s, p) => s + p.saldo_mes, 0) / ultimos3.length).toFixed(2))
      : 0;

    res.json({
      posicion,
      ytd: {
        debito_fiscal:  parseFloat(ytd.debito.toFixed(2)),
        credito_fiscal: parseFloat(ytd.credito.toFixed(2)),
        saldo_neto:     parseFloat(ytd.saldo.toFixed(2)),
      },
      proyeccion_proximo_mes: proyeccion,
      anio,
    });
  } catch (err) { next(err); }
});

module.exports = router;
