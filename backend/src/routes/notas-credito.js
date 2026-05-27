const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// ─── Solo admin puede crear / anular ─────────────────────────────────────────
// Lectura abierta a todos los roles autenticados

// SELECT base reutilizable
const SELECT_NC = `
  SELECT
    nc.id,
    nc.numero,
    nc.fecha,
    nc.estado,
    nc.motivo,
    nc.numero_referencia,
    nc.subtotal::float,
    nc.iva_pct::float,
    nc.iva_monto::float,
    nc.total::float,
    nc.items,
    nc.cae,
    nc.created_at,
    nc.updated_at,
    nc.deleted_at,
    -- Cliente
    c.id           AS cliente_id,
    c.razon_social AS cliente_razon_social,
    c.cuit         AS cliente_cuit,
    c.direccion    AS cliente_direccion,
    -- Tipo comprobante
    tc.descripcion AS tipo_comprobante,
    tc.letra       AS tipo_letra,
    tc.codigo_afip AS tipo_codigo_afip,
    -- Sucursal
    s.nombre       AS sucursal_nombre,
    -- Emisor (usuario)
    u.nombre       AS emitida_por_nombre,
    -- Facturación original (opcional)
    nc.factura_id,
    f.numero       AS factura_numero,
    f.punto_venta  AS factura_punto_venta
  FROM notas_credito nc
  LEFT JOIN clientes c              ON c.id = nc.cliente_id
  LEFT JOIN tipos_comprobante tc    ON tc.id = nc.tipo_comprobante_id
  LEFT JOIN sucursales s            ON s.id = nc.sucursal_id
  LEFT JOIN usuarios u              ON u.id = nc.emitida_por
  LEFT JOIN facturaciones f         ON f.id = nc.factura_id
`;

// ─── GET /api/notas-credito ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q, estado, cliente_id, fecha_desde, fecha_hasta, limit = '50', offset = '0' } = req.query;

    const conditions = ['nc.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (estado)       { conditions.push(`nc.estado = $${idx++}`);    params.push(estado); }
    if (cliente_id)   { conditions.push(`nc.cliente_id = $${idx++}`); params.push(cliente_id); }
    if (fecha_desde)  { conditions.push(`nc.fecha >= $${idx++}`);    params.push(fecha_desde); }
    if (fecha_hasta)  { conditions.push(`nc.fecha <= $${idx++}`);    params.push(fecha_hasta + ' 23:59:59'); }
    if (q && q.trim()) {
      conditions.push(`(
        c.razon_social ILIKE $${idx}
        OR nc.motivo   ILIKE $${idx}
        OR nc.numero::text ILIKE $${idx}
        OR nc.numero_referencia ILIKE $${idx}
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];

    params.push(Math.min(parseInt(limit) || 50, 200));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `${SELECT_NC}
         WHERE ${where}
         ORDER BY nc.fecha DESC, nc.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM notas_credito nc
         LEFT JOIN clientes c ON c.id = nc.cliente_id
         WHERE ${where}`,
        countParams
      ),
    ]);

    res.json({ count: parseInt(countRows[0].count), notas: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/notas-credito/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_NC} WHERE nc.id = $1 AND nc.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nota de crédito no encontrada' });
    res.json({ nota: rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /api/notas-credito — solo admin ─────────────────────────────────────
router.post('/', requireRol('administrador'), async (req, res, next) => {
  try {
    const {
      cliente_id,
      sucursal_id,
      tipo_comprobante_id,
      numero_referencia,
      factura_id = null,
      motivo,
      items = [],
      subtotal,
      iva_pct = 21,
      iva_monto,
      total,
      fecha,
    } = req.body;

    if (!motivo?.trim())           return res.status(400).json({ error: 'El motivo es obligatorio' });
    if (!tipo_comprobante_id)      return res.status(400).json({ error: 'El tipo de comprobante es obligatorio' });
    if (total === undefined || total === null) return res.status(400).json({ error: 'El total es obligatorio' });

    // Calcular número correlativo para el tipo de comprobante
    const { rows: lastNum } = await pool.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS next_num
         FROM notas_credito
        WHERE tipo_comprobante_id = $1 AND deleted_at IS NULL`,
      [tipo_comprobante_id]
    );
    const numero = lastNum[0].next_num;

    const { rows } = await pool.query(
      `INSERT INTO notas_credito
         (factura_id, cliente_id, sucursal_id, tipo_comprobante_id,
          numero, numero_referencia, motivo, items,
          subtotal, iva_pct, iva_monto, total, estado, emitida_por, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'emitida',$13,$14)
       RETURNING id`,
      [
        factura_id || null,
        cliente_id || null,
        sucursal_id || null,
        tipo_comprobante_id,
        numero,
        numero_referencia || null,
        motivo.trim(),
        items.length ? JSON.stringify(items) : null,
        parseFloat(subtotal) || 0,
        parseFloat(iva_pct) || 21,
        parseFloat(iva_monto) || 0,
        parseFloat(total) || 0,
        req.usuario.id,
        fecha || new Date().toISOString(),
      ]
    );

    // Devolver la nota completa
    const { rows: full } = await pool.query(
      `${SELECT_NC} WHERE nc.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ nota: full[0] });
  } catch (err) { next(err); }
});

// ─── PATCH /api/notas-credito/:id/anular — solo admin ────────────────────────
router.patch('/:id/anular', requireRol('administrador'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE notas_credito
          SET estado = 'anulada', updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL AND estado != 'anulada'
        RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrada o ya anulada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
