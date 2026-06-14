const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/rubros-gastos ───────────────────────────────────────────────────
// Retorna rubros con sus subrubros anidados
router.get('/', async (req, res, next) => {
  try {
    const [{ rows: rubros }, { rows: subrubros }] = await Promise.all([
      pool.query(`SELECT id, nombre, orden FROM rubros_gastos ORDER BY orden, nombre`),
      pool.query(`
        SELECT id, nombre, rubro_id, rubro AS rubro_texto
        FROM subrubro_gastos
        ORDER BY nombre
      `),
    ]);

    const rubrosMap = rubros.map(r => ({
      ...r,
      subrubros: subrubros.filter(s => s.rubro_id === r.id),
    }));

    // Subrubros sin rubro asignado (legado con campo rubro texto)
    const sinRubro = subrubros.filter(s => !s.rubro_id);

    res.json({ rubros: rubrosMap, sin_clasificar: sinRubro });
  } catch (err) { next(err); }
});

// ─── POST /api/rubros-gastos ──────────────────────────────────────────────────
// Body: { nombre, orden? }
router.post('/', async (req, res, next) => {
  try {
    const { nombre, orden = 0 } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const { rows } = await pool.query(
      `INSERT INTO rubros_gastos (nombre, orden) VALUES ($1, $2) RETURNING *`,
      [nombre.trim(), parseInt(orden) || 0]
    );
    res.status(201).json({ rubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un rubro con ese nombre' });
    next(err);
  }
});

// ─── POST /api/rubros-gastos/:id/subrubros ────────────────────────────────────
// Body: { nombre }
router.post('/:id/subrubros', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const rubroCheck = await pool.query(`SELECT id FROM rubros_gastos WHERE id = $1`, [id]);
    if (!rubroCheck.rows[0]) return res.status(404).json({ error: 'Rubro no encontrado' });

    const { rows: rubroRows } = await pool.query(`SELECT nombre FROM rubros_gastos WHERE id = $1`, [id]);

    const { rows } = await pool.query(
      `INSERT INTO subrubro_gastos (nombre, rubro, rubro_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), rubroRows[0].nombre, id]
    );
    res.status(201).json({ subrubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un subrubro con ese nombre' });
    next(err);
  }
});

// ─── PUT /api/rubros-gastos/:id ───────────────────────────────────────────────
// Body: { nombre?, orden? }
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, orden } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) {
      if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });
      updates.push(`nombre = $${idx++}`); params.push(nombre.trim());
    }
    if (orden !== undefined) { updates.push(`orden = $${idx++}`); params.push(parseInt(orden) || 0); }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE rubros_gastos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Rubro no encontrado' });

    // Mantener el campo texto legado de los subrubros en sincronía
    if (nombre !== undefined) {
      await pool.query(`UPDATE subrubro_gastos SET rubro = $1 WHERE rubro_id = $2`, [nombre.trim(), id]);
    }
    res.json({ rubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un rubro con ese nombre' });
    next(err);
  }
});

// ─── PUT /api/rubros-gastos/subrubros/:id ─────────────────────────────────────
// Body: { nombre }
router.put('/subrubros/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const { rows } = await pool.query(
      `UPDATE subrubro_gastos SET nombre = $1 WHERE id = $2 RETURNING *`,
      [nombre.trim(), id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Subrubro no encontrado' });
    res.json({ subrubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un subrubro con ese nombre' });
    next(err);
  }
});

module.exports = router;
