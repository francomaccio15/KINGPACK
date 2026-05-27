const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// GET /api/sucursales
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, direccion, telefono, activo
        FROM sucursales
       WHERE activo = true
       ORDER BY nombre
    `);
    res.json({ sucursales: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
