const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// GET /api/categorias
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, margen_default, activo
        FROM categorias
       WHERE activo = true
       ORDER BY nombre
    `);
    res.json({ categorias: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
