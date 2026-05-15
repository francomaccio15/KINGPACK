const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// GET /api/listas-precios
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, tipo, descuento_base_pct, activo
        FROM listas_precios
       WHERE activo = true
       ORDER BY
         CASE tipo
           WHEN 'madre'           THEN 1
           WHEN 'publica'         THEN 2
           WHEN 'revendedor'      THEN 3
           WHEN 'cuenta_corriente'THEN 4
           ELSE 5
         END
    `);
    res.json({ listas: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
