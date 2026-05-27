const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

const TIPOS_VALIDOS = ['general', 'pendiente', 'pedido', 'aviso'];

// SELECT helper — devuelve nota con datos de autor
const SELECT_NOTA = `
  SELECT n.id, n.contenido, n.tipo, n.resuelta,
         n.created_at, n.updated_at,
         u.id AS usuario_id, u.nombre AS autor, u.rol AS autor_rol
  FROM notas_equipo n
  JOIN usuarios u ON u.id = n.usuario_id
  WHERE n.deleted_at IS NULL
`;

// ─── GET /api/notas ───────────────────────────────────────────────────────────
// ?tipo=general|pendiente|pedido|aviso   filtra por tipo
// ?resuelta=true|false                   filtra por estado
router.get('/', async (req, res, next) => {
  try {
    const { tipo, resuelta } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (tipo && tipo !== 'all' && TIPOS_VALIDOS.includes(tipo)) {
      conditions.push(`n.tipo = $${idx++}`);
      params.push(tipo);
    }
    if (resuelta === 'true')  conditions.push('n.resuelta = true');
    if (resuelta === 'false') conditions.push('n.resuelta = false');

    const extra = conditions.length ? ' AND ' + conditions.join(' AND ') : '';

    const { rows } = await pool.query(
      `${SELECT_NOTA}${extra} ORDER BY n.resuelta ASC, n.created_at DESC`,
      params
    );

    res.json({ notas: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/notas ──────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { contenido, tipo = 'general' } = req.body;

    if (!contenido?.trim()) {
      return res.status(400).json({ error: 'El contenido es requerido' });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    const { rows } = await pool.query(
      `INSERT INTO notas_equipo (contenido, tipo, usuario_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [contenido.trim(), tipo, req.usuario.id]
    );

    const { rows: full } = await pool.query(
      `${SELECT_NOTA} AND n.id = $1`, [rows[0].id]
    );

    res.status(201).json({ nota: full[0] });
  } catch (err) { next(err); }
});

// ─── PATCH /api/notas/:id ─────────────────────────────────────────────────────
// Marcar resuelta: cualquier rol autenticado
// Editar contenido/tipo: solo administrador
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resuelta, contenido, tipo } = req.body;

    const { rows: exist } = await pool.query(
      'SELECT id FROM notas_equipo WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (exist.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });

    const updates = [];
    const params = [];
    let idx = 1;

    if (resuelta !== undefined) {
      updates.push(`resuelta = $${idx++}`);
      params.push(Boolean(resuelta));
    }

    if (contenido !== undefined || tipo !== undefined) {
      if (req.usuario.rol !== 'administrador') {
        return res.status(403).json({ error: 'Solo el administrador puede editar el contenido' });
      }
      if (contenido !== undefined) {
        if (!contenido.trim()) return res.status(400).json({ error: 'El contenido no puede estar vacío' });
        updates.push(`contenido = $${idx++}`);
        params.push(contenido.trim());
      }
      if (tipo !== undefined) {
        if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
        updates.push(`tipo = $${idx++}`);
        params.push(tipo);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.query(
      `UPDATE notas_equipo SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    const { rows: full } = await pool.query(
      `${SELECT_NOTA} AND n.id = $1`, [id]
    );

    res.json({ nota: full[0] });
  } catch (err) { next(err); }
});

// ─── DELETE /api/notas/:id — solo administrador ───────────────────────────────
router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'UPDATE notas_equipo SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
