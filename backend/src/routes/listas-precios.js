const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// GET /api/listas-precios
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT lp.id, lp.nombre, lp.tipo, lp.descuento_base_pct, lp.activo,
             COUNT(lpi.articulo_id)::int AS articulos_count
        FROM listas_precios lp
        LEFT JOIN lista_precio_items lpi ON lpi.lista_id = lp.id
       WHERE lp.activo = true
       GROUP BY lp.id
       ORDER BY
         CASE lp.tipo
           WHEN 'madre'            THEN 1
           WHEN 'publica'          THEN 2
           WHEN 'revendedor'       THEN 3
           WHEN 'cuenta_corriente' THEN 4
           ELSE 5
         END
    `);
    res.json({ listas: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/listas-precios/:id
// Body: { descuento_base_pct: number (0-100) }
// Actualiza el descuento de la lista y lo aplica en cascada a todos sus
// articulos que usan metodo='descuento_sobre_madre'.
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const pct = parseFloat(req.body?.descuento_base_pct);

  if (isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'descuento_base_pct debe ser un número entre 0 y 100' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount: listRows } = await client.query(
      `UPDATE listas_precios SET descuento_base_pct = $1 WHERE id = $2 AND activo = true`,
      [pct, id]
    );

    if (listRows === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lista no encontrada' });
    }

    // Cascade: actualiza descuento_pct en todos los items de tipo descuento_sobre_madre.
    // El trigger fn_trg_recalcular_precio_item recalcula precio_efectivo automáticamente.
    const { rowCount: itemRows } = await client.query(
      `UPDATE lista_precio_items
          SET descuento_pct = $1
        WHERE lista_id = $2 AND metodo = 'descuento_sobre_madre'`,
      [pct, id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, articulos_actualizados: itemRows });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
