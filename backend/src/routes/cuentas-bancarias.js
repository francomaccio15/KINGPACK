const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/cuentas-bancarias ───────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { activo = 'true' } = req.query;
    const conditions = [];
    const params = [];

    if (activo !== 'all') {
      conditions.push(`activo = $1`);
      params.push(activo !== 'false');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, nombre, banco, titular, alias, cbu, activo FROM cuentas_bancarias_empresa ${where} ORDER BY nombre`,
      params
    );
    res.json({ cuentas: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/cuentas-bancarias ──────────────────────────────────────────────
// Body: { nombre, banco?, cbu? }
router.post('/', async (req, res, next) => {
  try {
    const { nombre, banco, cbu } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const { rows } = await pool.query(
      `INSERT INTO cuentas_bancarias_empresa (nombre, banco, cbu)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), banco?.trim() || null, cbu?.trim() || null]
    );
    res.status(201).json({ cuenta: rows[0] });
  } catch (err) { next(err); }
});

// ─── PUT /api/cuentas-bancarias/:id ──────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const fields = ['nombre', 'banco', 'cbu', 'activo'];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f] === '' ? null : req.body[f]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE cuentas_bancarias_empresa SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
