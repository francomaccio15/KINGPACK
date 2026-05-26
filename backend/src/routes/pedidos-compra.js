// TODO(fase-2): proteger con JWT
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/pedidos-compra ──────────────────────────────────────────────────
// ?q=           busca en razon_social del proveedor o nro de factura
// ?estado=      pendiente | recibido_parcial | recibido | cancelado
// ?proveedor_id=
// ?sucursal_id=
// ?fecha_desde= ISO date
// ?fecha_hasta= ISO date
// ?limit=       default 100
// ?offset=      default 0
router.get('/', async (req, res, next) => {
  try {
    const {
      q, estado, proveedor_id, sucursal_id, fecha_desde, fecha_hasta,
      limit = 100, offset = 0,
    } = req.query;

    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (estado) {
      conditions.push(`p.estado = $${idx++}`);
      params.push(estado);
    }
    if (proveedor_id) {
      conditions.push(`p.proveedor_id = $${idx++}`);
      params.push(proveedor_id);
    }
    if (sucursal_id) {
      conditions.push(`p.sucursal_id = $${idx++}`);
      params.push(sucursal_id);
    }
    if (fecha_desde) {
      conditions.push(`p.fecha_pedido >= $${idx++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`p.fecha_pedido < ($${idx++}::date + interval '1 day')`);
      params.push(fecha_hasta);
    }
    if (q && q.trim()) {
      conditions.push(`(pv.razon_social ILIKE $${idx} OR p.numero_factura_prov ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          p.id, p.fecha_pedido, p.estado, p.monto_total,
          p.numero_factura_prov, p.costo_flete_total, p.fecha_recepcion,
          p.egreso_id, p.stock_acreditado,
          pv.id           AS proveedor_id,
          pv.razon_social AS proveedor_nombre,
          s.nombre        AS sucursal_nombre,
          (SELECT COUNT(*) FROM pedido_items pi WHERE pi.pedido_id = p.id) AS items_count
        FROM pedidos_compra p
        LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
        LEFT JOIN sucursales s  ON s.id  = p.sucursal_id
        WHERE ${where}
        ORDER BY p.fecha_pedido DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`
        SELECT COUNT(*) FROM pedidos_compra p
        LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
        WHERE ${where}
      `, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), pedidos: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/pedidos-compra ─────────────────────────────────────────────────
// Body:
//   proveedor_id, sucursal_id,
//   numero_factura_prov (opcional), costo_flete_total (default 0),
//   items: [{ articulo_id, cantidad, precio_compra }]
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      proveedor_id, sucursal_id,
      numero_factura_prov, costo_flete_total = 0,
      items = [],
    } = req.body;

    if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id es requerido' });
    if (!sucursal_id)  return res.status(400).json({ error: 'sucursal_id es requerido' });
    if (items.length === 0) return res.status(400).json({ error: 'El pedido debe tener al menos un artículo' });

    await client.query('BEGIN');

    // Calcular monto total
    const flete = parseFloat(costo_flete_total) || 0;
    let monto_mercaderia = 0;
    for (const item of items) {
      monto_mercaderia += (parseFloat(item.precio_compra) || 0) * (parseFloat(item.cantidad) || 0);
    }
    const monto_total = monto_mercaderia + flete;

    // Distribuir flete proporcionalmente entre items
    const fleteUnitario = items.length > 0 ? flete / items.length : 0;

    const { rows: pedidoRows } = await client.query(`
      INSERT INTO pedidos_compra
        (proveedor_id, sucursal_id, numero_factura_prov, costo_flete_total, monto_total)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, fecha_pedido, estado, monto_total
    `, [
      proveedor_id,
      sucursal_id,
      numero_factura_prov?.trim() || null,
      flete.toFixed(2),
      monto_total.toFixed(2),
    ]);
    const pedido = pedidoRows[0];

    for (const item of items) {
      await client.query(`
        INSERT INTO pedido_items (pedido_id, articulo_id, cantidad, precio_compra, costo_flete_asignado)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        pedido.id,
        item.articulo_id,
        parseFloat(item.cantidad) || 1,
        parseFloat(item.precio_compra) || 0,
        fleteUnitario.toFixed(2),
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ pedido });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/pedidos-compra/:id ──────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [{ rows: pedidoRows }, { rows: itemRows }] = await Promise.all([
      pool.query(`
        SELECT
          p.id, p.fecha_pedido, p.estado, p.monto_total,
          p.numero_factura_prov, p.costo_flete_total, p.fecha_recepcion,
          p.egreso_id, p.stock_acreditado,
          pv.id           AS proveedor_id,
          pv.razon_social AS proveedor_nombre,
          pv.cuit         AS proveedor_cuit,
          pv.telefono     AS proveedor_telefono,
          pv.email        AS proveedor_email,
          s.nombre        AS sucursal_nombre,
          s.direccion     AS sucursal_direccion
        FROM pedidos_compra p
        LEFT JOIN proveedores pv ON pv.id = p.proveedor_id
        LEFT JOIN sucursales s  ON s.id  = p.sucursal_id
        WHERE p.id = $1
      `, [id]),
      pool.query(`
        SELECT
          pi.articulo_id, pi.cantidad, pi.precio_compra, pi.costo_flete_asignado,
          a.nombre  AS articulo_nombre,
          a.codigo  AS articulo_codigo,
          a.precio_madre
        FROM pedido_items pi
        JOIN articulos a ON a.id = pi.articulo_id
        WHERE pi.pedido_id = $1
        ORDER BY a.nombre
      `, [id]),
    ]);

    if (pedidoRows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

    res.json({ pedido: pedidoRows[0], items: itemRows });
  } catch (err) { next(err); }
});

// ─── PATCH /api/pedidos-compra/:id/confirmar-recepcion ───────────────────────
// Confirma que la mercadería llegó y acredita el stock en la sucursal correspondiente.
// Solo puede ejecutarse una vez (stock_acreditado es irreversible).
router.patch('/:id/confirmar-recepcion', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const { rows: pedidoRows } = await client.query(
      `SELECT id, estado, egreso_id, sucursal_id, stock_acreditado
       FROM pedidos_compra WHERE id = $1`,
      [id]
    );
    if (!pedidoRows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    const pedido = pedidoRows[0];

    if (pedido.stock_acreditado) {
      return res.status(400).json({ error: 'El stock ya fue acreditado para este pedido' });
    }
    if (pedido.estado === 'cancelado') {
      return res.status(400).json({ error: 'No se puede confirmar un pedido cancelado' });
    }

    await client.query('BEGIN');

    // Obtener ítems con la sucursal de imputación correcta
    let itemsToProcess = [];
    if (pedido.egreso_id) {
      // Pedido generado desde egreso: usar sucursal_imputacion_id de egreso_items
      const { rows } = await client.query(
        `SELECT articulo_id, cantidad, sucursal_imputacion_id AS sucursal_id
         FROM egreso_items
         WHERE egreso_id = $1 AND articulo_id IS NOT NULL`,
        [pedido.egreso_id]
      );
      itemsToProcess = rows;
    } else {
      // Pedido manual legacy: usar sucursal del pedido
      const { rows } = await client.query(
        `SELECT articulo_id, cantidad, $2::uuid AS sucursal_id
         FROM pedido_items WHERE pedido_id = $1`,
        [id, pedido.sucursal_id]
      );
      itemsToProcess = rows;
    }

    for (const item of itemsToProcess) {
      await client.query(`
        INSERT INTO stock (articulo_id, sucursal_id, cantidad, stock_minimo)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (articulo_id, sucursal_id)
        DO UPDATE SET cantidad = stock.cantidad + $3, ultima_actualizacion = NOW()
      `, [item.articulo_id, item.sucursal_id, item.cantidad]);

      await client.query(`
        INSERT INTO ajustes_stock (articulo_id, sucursal_id, cantidad_delta, motivo)
        VALUES ($1, $2, $3, $4)
      `, [item.articulo_id, item.sucursal_id, item.cantidad, `Recepción — pedido ${id}`]);
    }

    await client.query(`
      UPDATE pedidos_compra
      SET estado = 'recibido', stock_acreditado = TRUE,
          fecha_recepcion = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [id]);

    await client.query('COMMIT');
    res.json({ ok: true, items_acreditados: itemsToProcess.length });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/pedidos-compra/:id/estado ─────────────────────────────────────
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const validos = ['pendiente', 'recibido_parcial', 'recibido', 'cancelado'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const fechaRecepcion = estado === 'recibido' ? 'NOW()' : 'NULL';
    const { rows } = await pool.query(
      `UPDATE pedidos_compra
       SET estado = $1, fecha_recepcion = ${fechaRecepcion}, updated_at = NOW()
       WHERE id = $2
       RETURNING id, estado, fecha_recepcion`,
      [estado, id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ pedido: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
