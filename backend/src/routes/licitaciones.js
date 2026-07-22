const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();
const soloAdmin = requireRol('administrador');

// ─── GET /api/licitaciones ────────────────────────────────────────────────────
router.get('/', soloAdmin, async (req, res, next) => {
  try {
    const { q, estado, limit = '100', offset = '0' } = req.query;
    const params = [];
    const conds  = ['l.deleted_at IS NULL'];

    if (q) {
      params.push(`%${q}%`);
      conds.push(`(l.titulo ILIKE $${params.length} OR c.razon_social ILIKE $${params.length})`);
    }
    if (estado) {
      params.push(estado);
      conds.push(`l.estado = $${params.length}`);
    }

    const where = conds.map(c => `(${c})`).join(' AND ');
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const limitIdx  = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await pool.query(
      `SELECT
         l.id, l.numero, l.titulo, l.estado, l.created_at,
         c.razon_social AS cliente_nombre,
         u.nombre       AS creado_por,
         (SELECT COUNT(*) FROM licitacion_items li WHERE li.licitacion_id = l.id)::int AS items_count,
         (SELECT COALESCE(SUM(li.subtotal), 0) FROM licitacion_items li WHERE li.licitacion_id = l.id) AS total
       FROM licitaciones l
       LEFT JOIN clientes  c ON c.id = l.cliente_id
       LEFT JOIN usuarios  u ON u.id = l.created_by
       WHERE ${where}
       ORDER BY l.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const { rows: [cnt] } = await pool.query(
      `SELECT COUNT(*) AS total
       FROM licitaciones l
       LEFT JOIN clientes c ON c.id = l.cliente_id
       WHERE ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({ licitaciones: rows, count: parseInt(cnt.total, 10) });
  } catch (err) { next(err); }
});

// ─── POST /api/licitaciones ───────────────────────────────────────────────────
router.post('/', soloAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { titulo, cliente_id, observaciones, items = [] } = req.body;
    if (!items.length) return res.status(400).json({ error: 'La licitación debe tener al menos un artículo.' });

    await client.query('BEGIN');

    const { rows: [lic] } = await client.query(
      `INSERT INTO licitaciones (titulo, cliente_id, observaciones, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, numero`,
      [titulo?.trim() || null, cliente_id || null, observaciones?.trim() || null, req.usuario.id]
    );

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const subtotal = parseFloat(it.cantidad) * parseFloat(it.precio_licitacion);
      await client.query(
        `INSERT INTO licitacion_items
           (licitacion_id, articulo_id, codigo, nombre, cantidad, precio_madre_ref, precio_licitacion, subtotal, orden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          lic.id,
          it.articulo_id || null,
          it.codigo || null,
          it.nombre,
          parseFloat(it.cantidad),
          it.precio_madre_ref != null ? parseFloat(it.precio_madre_ref) : null,
          parseFloat(it.precio_licitacion),
          subtotal,
          i,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: lic.id, numero: lic.numero });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/licitaciones/:id ────────────────────────────────────────────────
router.get('/:id', soloAdmin, async (req, res, next) => {
  try {
    const { rows: [lic] } = await pool.query(
      `SELECT
         l.id, l.numero, l.titulo, l.estado, l.observaciones, l.created_at,
         l.cliente_id, l.venta_id,
         c.razon_social     AS cliente_nombre,
         c.cuit             AS cliente_cuit,
         c.direccion        AS cliente_direccion,
         ci.nombre          AS cliente_cond_iva,
         u.nombre           AS creado_por
       FROM licitaciones l
       LEFT JOIN clientes  c  ON c.id  = l.cliente_id
       LEFT JOIN cond_iva  ci ON ci.id = c.cond_iva_id
       LEFT JOIN usuarios  u  ON u.id  = l.created_by
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!lic) return res.status(404).json({ error: 'Licitación no encontrada' });

    const { rows: items } = await pool.query(
      `SELECT id, articulo_id, codigo, nombre, cantidad, precio_madre_ref, precio_licitacion, subtotal, orden
       FROM licitacion_items
       WHERE licitacion_id = $1
       ORDER BY orden ASC, id ASC`,
      [req.params.id]
    );

    res.json({ licitacion: lic, items });
  } catch (err) { next(err); }
});

// ─── PUT /api/licitaciones/:id ────────────────────────────────────────────────
router.put('/:id', soloAdmin, async (req, res, next) => {
  try {
    const { titulo, observaciones, estado } = req.body;
    const ESTADOS = ['borrador', 'enviada'];
    if (estado && !ESTADOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}` });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE licitaciones
       SET titulo        = COALESCE($1, titulo),
           observaciones = COALESCE($2, observaciones),
           estado        = COALESCE($3, estado)
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id`,
      [titulo?.trim() || null, observaciones?.trim() || null, estado || null, req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Licitación no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── POST /api/licitaciones/:id/adjudicar ────────────────────────────────────
router.post('/:id/adjudicar', soloAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { sucursal_id } = req.body;
    if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido' });

    await client.query('BEGIN');

    // Verificar licitación: debe existir, estar 'enviada' y no haber sido adjudicada
    const { rows: [lic] } = await client.query(
      `SELECT id, numero, cliente_id, estado, venta_id
       FROM licitaciones
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [req.params.id]
    );
    if (!lic) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Licitación no encontrada' });
    }
    if (lic.estado !== 'enviada') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Solo se pueden adjudicar licitaciones en estado "enviada"' });
    }
    if (lic.venta_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta licitación ya fue adjudicada' });
    }

    // Verificar sucursal
    const { rows: [suc] } = await client.query(
      `SELECT id FROM sucursales WHERE id = $1`,
      [sucursal_id]
    );
    if (!suc) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sucursal no válida' });
    }

    // Obtener items con datos del artículo (IVA)
    const { rows: items } = await client.query(
      `SELECT li.articulo_id, li.nombre, li.cantidad,
              li.precio_licitacion,
              COALESCE(ai.porcentaje, 0) AS iva_pct
       FROM licitacion_items li
       JOIN articulos a ON a.id = li.articulo_id
       LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
       WHERE li.licitacion_id = $1
       ORDER BY li.orden ASC, li.id ASC`,
      [lic.id]
    );
    if (!items.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La licitación no tiene artículos' });
    }

    // Calcular totales
    let subtotalVenta = 0;
    const itemsCalc = items.map(it => {
      const precio   = parseFloat(it.precio_licitacion);
      const cantidad = parseFloat(it.cantidad);
      const iva_monto = parseFloat((precio * parseFloat(it.iva_pct) / 100).toFixed(2));
      subtotalVenta += precio * cantidad;
      return { ...it, precio, cantidad, iva_monto };
    });
    const total = parseFloat(subtotalVenta.toFixed(2));

    // Número de venta secuencial por sucursal
    const { rows: numRows } = await client.query(
      `SELECT numero FROM ventas WHERE sucursal_id = $1
       ORDER BY numero DESC LIMIT 1 FOR UPDATE`,
      [sucursal_id]
    );
    const numero = (numRows[0]?.numero ?? 0) + 1;

    // Crear venta confirmada
    const { rows: [venta] } = await client.query(`
      INSERT INTO ventas
        (numero, sucursal_id, cliente_id, vendedor_id, lista_precio_id,
         estado, observaciones, subtotal, descuento_total, total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, numero, fecha, estado, total
    `, [
      numero,
      sucursal_id,
      lic.cliente_id || null,
      req.usuario.id,
      null,
      'confirmada',
      `Licitación #${lic.numero}`,
      total.toFixed(2),
      '0.00',
      total.toFixed(2),
    ]);

    // Descontar stock
    for (const it of itemsCalc) {
      const { rows: stockRows } = await client.query(
        `SELECT cantidad FROM stock
         WHERE articulo_id = $1 AND sucursal_id = $2
         FOR UPDATE`,
        [it.articulo_id, sucursal_id]
      );
      const stockActual = parseFloat(stockRows[0]?.cantidad ?? 0);
      if (stockActual < it.cantidad) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Stock insuficiente para "${it.nombre}"`,
          detalle: { articulo_id: it.articulo_id, nombre: it.nombre, disponible: stockActual, solicitado: it.cantidad },
        });
      }
      await client.query(
        `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (articulo_id, sucursal_id)
         DO UPDATE SET cantidad = EXCLUDED.cantidad, ultima_actualizacion = NOW()`,
        [it.articulo_id, sucursal_id, parseFloat((stockActual - it.cantidad).toFixed(3))]
      );
    }

    // Insertar items de la venta
    for (const it of itemsCalc) {
      await client.query(`
        INSERT INTO venta_items
          (venta_id, articulo_id, cantidad, precio_lista, precio_madre, descuento_pct, precio_unitario_final, iva_monto)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [venta.id, it.articulo_id, it.cantidad, it.precio, it.precio, 0, it.precio, it.iva_monto]);
    }

    // Vincular venta a la licitación y marcarla adjudicada
    await client.query(
      `UPDATE licitaciones SET estado = 'adjudicada', venta_id = $1 WHERE id = $2`,
      [venta.id, lic.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ venta_id: venta.id, venta_numero: venta.numero });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── DELETE /api/licitaciones/:id ─────────────────────────────────────────────
router.delete('/:id', soloAdmin, async (req, res, next) => {
  try {
    const { rows: [deleted] } = await pool.query(
      `UPDATE licitaciones SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id]
    );
    if (!deleted) return res.status(404).json({ error: 'Licitación no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
