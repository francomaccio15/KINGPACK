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
    s.nombre        AS sucursal_nombre,
    s.cuit_sucursal AS sucursal_cuit,
    s.direccion     AS sucursal_direccion,
    s.telefono      AS sucursal_telefono,
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

// Helper: calcular saldo actual de un cliente dentro de una transacción
async function getSaldoActual(client, clienteId) {
  const { rows } = await client.query(`
    SELECT
      c.saldo_inicial
        + COALESCE(SUM(cc.debe) - SUM(cc.haber), 0)
        + COALESCE(cs_agg.total_correcciones, 0) AS saldo_actual
    FROM clientes c
    LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
    LEFT JOIN (
      SELECT cliente_id, SUM(monto) AS total_correcciones
        FROM correcciones_saldo_cliente GROUP BY cliente_id
    ) cs_agg ON cs_agg.cliente_id = c.id
    WHERE c.id = $1 AND c.deleted_at IS NULL
    GROUP BY c.id, c.saldo_inicial, cs_agg.total_correcciones
  `, [clienteId]);
  return parseFloat(rows[0]?.saldo_actual ?? '0');
}

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

// ─── POST /api/notas-credito — todos los roles autenticados ──────────────────
// Efectos colaterales (en transacción):
//   1. Restaura stock para ítems con articulo_id (devolución de mercadería)
//   2. Acredita la cuenta corriente del cliente (haber = total → saldo a favor)
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
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

    await client.query('BEGIN');

    // Número correlativo para el tipo de comprobante
    const { rows: lastNum } = await client.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS next_num
         FROM notas_credito
        WHERE tipo_comprobante_id = $1 AND deleted_at IS NULL`,
      [tipo_comprobante_id]
    );
    const numero = lastNum[0].next_num;

    // Insertar la nota de crédito
    const { rows } = await client.query(
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
    const ncId = rows[0].id;
    const totalNum = parseFloat(total) || 0;

    // ── 1. Restaurar stock para ítems con articulo_id ─────────────────────────
    const itemsConArticulo = items.filter(it => it.articulo_id && parseFloat(it.cantidad) > 0);
    if (itemsConArticulo.length > 0 && sucursal_id) {
      for (const item of itemsConArticulo) {
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3::numeric, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET
             cantidad = GREATEST(0, stock.cantidad + $3::numeric),
             ultima_actualizacion = NOW()`,
          [item.articulo_id, sucursal_id, parseFloat(item.cantidad)]
        );
      }
    }

    // ── 2. Acreditar cuenta corriente del cliente ─────────────────────────────
    if (cliente_id && totalNum > 0) {
      const saldoActual = await getSaldoActual(client, cliente_id);
      // haber = total NC → reduce deuda / genera saldo a favor (saldo negativo)
      const saldoDespues = parseFloat((saldoActual - totalNum).toFixed(2));

      await client.query(
        `INSERT INTO cuentas_corrientes_cliente
           (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
         VALUES ($1, 0, $2, $3, 'nota_credito', $4)`,
        [cliente_id, totalNum, saldoDespues, ncId]
      );
    }

    await client.query('COMMIT');

    // Devolver la nota completa
    const { rows: full } = await pool.query(
      `${SELECT_NC} WHERE nc.id = $1`,
      [ncId]
    );

    res.status(201).json({ nota: full[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/notas-credito/:id/anular — solo admin ────────────────────────
// Revierte en transacción:
//   1. Descuenta el stock que fue devuelto (vuelve a quitar la mercadería)
//   2. Inserta debe en CC del cliente para cancelar el haber original
router.patch('/:id/anular', requireRol('administrador'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener la NC y marcarla anulada
    const { rows } = await client.query(
      `UPDATE notas_credito
          SET estado = 'anulada', updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL AND estado != 'anulada'
        RETURNING id, cliente_id, sucursal_id, total, items`,
      [req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrada o ya anulada' });
    }
    const nc = rows[0];
    const totalNum = parseFloat(nc.total) || 0;
    const items = nc.items || [];

    // ── 1. Revertir stock (quitar lo que se había devuelto) ───────────────────
    const itemsConArticulo = items.filter(it => it.articulo_id && parseFloat(it.cantidad) > 0);
    if (itemsConArticulo.length > 0 && nc.sucursal_id) {
      for (const item of itemsConArticulo) {
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3::numeric, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET
             cantidad = GREATEST(0, stock.cantidad - $3::numeric),
             ultima_actualizacion = NOW()`,
          [item.articulo_id, nc.sucursal_id, parseFloat(item.cantidad)]
        );
      }
    }

    // ── 2. Revertir CC: insertar debe para cancelar el haber de la NC ─────────
    if (nc.cliente_id && totalNum > 0) {
      const saldoActual = await getSaldoActual(client, nc.cliente_id);
      // debe = total NC → revierte el haber; saldo sube (cliente vuelve a deber o pierde el crédito)
      const saldoDespues = parseFloat((saldoActual + totalNum).toFixed(2));

      await client.query(
        `INSERT INTO cuentas_corrientes_cliente
           (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
         VALUES ($1, $2, 0, $3, 'anulacion_nc', $4)`,
        [nc.cliente_id, totalNum, saldoDespues, nc.id]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── DELETE /api/notas-credito/:id — solo admin (soft delete) ────────────────
router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE notas_credito SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nota de crédito no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
