const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/categorias ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { activo = 'true' } = req.query;

    const conditions = [];
    if (activo !== 'all') conditions.push(`c.activo = ${activo !== 'false'}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.nombre,
        c.margen_default::float,
        c.activo,
        c.created_at,
        c.updated_at,
        COUNT(a.id)::int AS articulos_count
      FROM categorias c
      LEFT JOIN articulos a ON a.categoria_id = c.id AND a.deleted_at IS NULL
      ${where}
      GROUP BY c.id
      ORDER BY c.nombre
    `);
    res.json({ categorias: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/categorias — solo admin ───────────────────────────────────────
router.post('/', requireRol('administrador'), async (req, res, next) => {
  try {
    const { nombre, margen_default = 0 } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });

    const { rows } = await pool.query(`
      INSERT INTO categorias (nombre, margen_default)
      VALUES ($1, $2)
      RETURNING id, nombre, margen_default::float, activo, created_at, updated_at
    `, [nombre.trim(), parseFloat(margen_default) || 0]);

    res.status(201).json({ categoria: { ...rows[0], articulos_count: 0 } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    next(err);
  }
});

// ─── PATCH /api/categorias/:id — solo admin ───────────────────────────────────
router.patch('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const { nombre, margen_default, activo } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined) {
      if (!nombre.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      sets.push(`nombre = $${idx++}`);
      params.push(nombre.trim());
    }
    if (margen_default !== undefined) {
      sets.push(`margen_default = $${idx++}`);
      params.push(parseFloat(margen_default) || 0);
    }
    if (activo !== undefined) {
      sets.push(`activo = $${idx++}`);
      params.push(Boolean(activo));
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });

    params.push(req.params.id);
    const { rows } = await pool.query(`
      UPDATE categorias
         SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
      RETURNING id, nombre, margen_default::float, activo, created_at, updated_at
    `, params);

    if (!rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });

    // Obtener conteo actualizado
    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*)::int AS articulos_count FROM articulos WHERE categoria_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    res.json({ categoria: { ...rows[0], articulos_count: cnt[0].articulos_count } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    next(err);
  }
});

// ─── DELETE /api/categorias/:id — solo admin (soft delete) ───────────────────
router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    // No permitir eliminar si tiene artículos activos
    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM articulos WHERE categoria_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (cnt[0].n > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: tiene ${cnt[0].n} artículo${cnt[0].n !== 1 ? 's' : ''} asignado${cnt[0].n !== 1 ? 's' : ''}`
      });
    }

    const { rows } = await pool.query(
      `UPDATE categorias SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
