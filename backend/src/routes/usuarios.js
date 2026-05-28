/**
 * /api/usuarios  —  CRUD de usuarios (solo administrador)
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router   = express.Router();
const soloAdmin = requireRol('administrador');

// ─── GET /api/usuarios ────────────────────────────────────────────────────────
router.get('/', soloAdmin, async (req, res, next) => {
  try {
    const { q, activo } = req.query;
    const params  = [];
    const conds   = ['u.deleted_at IS NULL'];
    let idx = 1;

    if (q?.trim()) {
      conds.push(`(u.nombre ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }
    if (activo !== undefined && activo !== '') {
      conds.push(`u.activo = $${idx}`);
      params.push(activo === 'true');
      idx++;
    }

    const where = conds.join(' AND ');
    const { rows } = await pool.query(`
      SELECT
        u.id, u.email, u.nombre, u.telefono, u.rol, u.activo,
        u.sucursal_default_id,
        s.nombre AS sucursal_nombre,
        u.created_at
      FROM usuarios u
      LEFT JOIN sucursales s ON s.id = u.sucursal_default_id
      WHERE ${where}
      ORDER BY u.nombre
    `, params);

    res.json({ usuarios: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/usuarios ───────────────────────────────────────────────────────
router.post('/', soloAdmin, async (req, res, next) => {
  try {
    const { email, password, nombre, telefono, rol, sucursal_default_id } = req.body;

    if (!email?.trim())    return res.status(400).json({ error: 'Email requerido' });
    if (!password?.trim()) return res.status(400).json({ error: 'Contraseña requerida' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    if (!nombre?.trim())   return res.status(400).json({ error: 'Nombre requerido' });

    const roles = ['administrador', 'supervisor', 'cajero', 'vendedor'];
    if (!roles.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    const emailNorm = email.toLowerCase().trim();
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(`
      INSERT INTO usuarios (email, password_hash, nombre, telefono, rol, sucursal_default_id, activo)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, email, nombre, telefono, rol, sucursal_default_id, activo, created_at
    `, [emailNorm, hash, nombre.trim(), telefono?.trim() || null, rol, sucursal_default_id || null]);

    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    next(err);
  }
});

// ─── PATCH /api/usuarios/:id ──────────────────────────────────────────────────
router.patch('/:id', soloAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, rol, sucursal_default_id, activo } = req.body;

    const roles = ['administrador', 'supervisor', 'cajero', 'vendedor'];
    if (rol && !roles.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    // Evitar que el admin se baje el rol a sí mismo
    if (req.usuario.id === id && rol && rol !== 'administrador') {
      return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
    }
    if (req.usuario.id === id && activo === false) {
      return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });
    }

    const sets   = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)             { sets.push(`nombre = $${idx++}`);              params.push(nombre.trim()); }
    if (telefono !== undefined)           { sets.push(`telefono = $${idx++}`);            params.push(telefono?.trim() || null); }
    if (rol !== undefined)                { sets.push(`rol = $${idx++}`);                 params.push(rol); }
    if (sucursal_default_id !== undefined){ sets.push(`sucursal_default_id = $${idx++}`); params.push(sucursal_default_id || null); }
    if (activo !== undefined)             { sets.push(`activo = $${idx++}`);              params.push(Boolean(activo)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });

    params.push(id);
    const { rows } = await pool.query(`
      UPDATE usuarios SET ${sets.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING id, email, nombre, telefono, rol, sucursal_default_id, activo
    `, params);

    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ usuario: rows[0] });
  } catch (err) { next(err); }
});

// ─── PATCH /api/usuarios/:id/password ────────────────────────────────────────
router.patch('/:id/password', soloAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password?.trim()) return res.status(400).json({ error: 'Contraseña requerida' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await pool.query(
      `UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [hash, id]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── DELETE /api/usuarios/:id ─────────────────────────────────────────────────
router.delete('/:id', soloAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.usuario.id === id) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
    }

    const { rowCount } = await pool.query(
      `UPDATE usuarios SET deleted_at = NOW(), activo = FALSE WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
