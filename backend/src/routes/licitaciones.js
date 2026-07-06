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
         l.cliente_id,
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
