// TODO(fase-2): proteger con JWT — endpoint público temporal para validación inicial.
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.codigo, a.nombre, a.precio_madre, a.activo,
             c.nombre AS categoria
        FROM articulos a
        JOIN categorias c ON c.id = a.categoria_id
       WHERE a.deleted_at IS NULL
       ORDER BY a.nombre
       LIMIT 200
    `);
    res.json({ count: rows.length, articulos: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
