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

// POST /api/categorias
router.post('/', async (req, res, next) => {
  try {
    const { nombre, margen_default = 0 } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const { rows } = await pool.query(`
      INSERT INTO categorias (nombre, margen_default)
      VALUES ($1, $2)
      RETURNING id, nombre, margen_default, activo
    `, [nombre.trim(), parseFloat(margen_default) || 0]);
    res.status(201).json({ categoria: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    next(err);
  }
});

module.exports = router;
