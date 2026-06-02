const express = require('express');
const { pool } = require('../config/db');
const { requireRol, sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/empleados ───────────────────────────────────────────────────────
// ?q=            busca en nombre, dni o cargo
// ?activo=       true (default) | false | all
// ?sucursal_id=  filtra por sucursal (solo admin/supervisor)
// ?limit=        default 200, max 500
// ?offset=       default 0
router.get('/', async (req, res, next) => {
  try {
    const { q, activo = 'true', limit = 200, offset = 0 } = req.query;

    const conditions = ['e.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (activo !== 'all') {
      conditions.push(`e.activo = $${idx++}`);
      params.push(activo !== 'false');
    }

    if (q && q.trim()) {
      conditions.push(`(e.nombre ILIKE $${idx} OR e.dni ILIKE $${idx} OR e.cargo ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const sucId = sucursalEfectiva(req);
    if (sucId) {
      conditions.push(`e.sucursal_id = $${idx++}`);
      params.push(sucId);
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];

    params.push(Math.min(parseInt(limit) || 200, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          e.id, e.dni, e.nombre, e.cargo, e.email, e.telefono,
          e.fecha_ingreso, e.salario, e.activo, e.created_at, e.updated_at,
          s.id   AS sucursal_id,
          s.nombre AS sucursal_nombre
        FROM empleados e
        LEFT JOIN sucursales s ON s.id = e.sucursal_id
        WHERE ${where}
        ORDER BY e.nombre
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM empleados e WHERE ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), empleados: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/empleados ──────────────────────────────────────────────────────
router.post('/', requireRol('administrador', 'supervisor'), async (req, res, next) => {
  try {
    const {
      sucursal_id, dni, nombre, cargo, email,
      telefono, fecha_ingreso, salario,
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!sucursal_id) {
      return res.status(400).json({ error: 'La sucursal es requerida' });
    }

    const { rows } = await pool.query(`
      INSERT INTO empleados
        (sucursal_id, dni, nombre, cargo, email, telefono, fecha_ingreso, salario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, dni, nombre, cargo, email, telefono, fecha_ingreso, salario, activo, created_at
    `, [
      sucursal_id,
      dni?.trim()          || null,
      nombre.trim(),
      cargo?.trim()        || null,
      email?.trim()        || null,
      telefono?.trim()     || null,
      fecha_ingreso        || null,
      salario != null && salario !== '' ? parseFloat(salario) : null,
    ]);

    res.status(201).json({ empleado: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un empleado con ese DNI en esta sucursal' });
    next(err);
  }
});

// ─── GET /api/empleados/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.id, e.dni, e.nombre, e.cargo, e.email, e.telefono,
        e.fecha_ingreso, e.salario, e.activo, e.created_at, e.updated_at,
        s.id     AS sucursal_id,
        s.nombre AS sucursal_nombre
      FROM empleados e
      LEFT JOIN sucursales s ON s.id = e.sucursal_id
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json({ empleado: rows[0] });
  } catch (err) { next(err); }
});

// ─── PATCH /api/empleados/:id ─────────────────────────────────────────────────
router.patch('/:id', requireRol('administrador', 'supervisor'), async (req, res, next) => {
  try {
    const FIELDS = ['sucursal_id', 'dni', 'nombre', 'cargo', 'email', 'telefono', 'fecha_ingreso', 'salario', 'activo'];
    const updates = [];
    const params  = [];
    let idx = 1;

    for (const f of FIELDS) {
      if (req.body[f] === undefined) continue;
      updates.push(`${f} = $${idx++}`);
      let val = req.body[f];
      if (val === '') val = null;
      if (f === 'salario' && val !== null) val = parseFloat(val);
      params.push(val);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(req.params.id);
    const { rows } = await pool.query(`
      UPDATE empleados
         SET ${updates.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING id, dni, nombre, cargo, email, telefono, fecha_ingreso, salario, activo, updated_at
    `, params);

    if (!rows[0]) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json({ empleado: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un empleado con ese DNI en esta sucursal' });
    next(err);
  }
});

// ─── DELETE /api/empleados/:id — soft delete ──────────────────────────────────
router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`
      UPDATE empleados
         SET deleted_at = NOW(), activo = FALSE
       WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);

    if (rowCount === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
