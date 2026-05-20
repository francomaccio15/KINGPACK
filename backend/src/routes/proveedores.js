// TODO(fase-2): proteger con JWT
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/proveedores ─────────────────────────────────────────────────────
// ?q=      busca en razon_social o cuit
// ?activo= true (default) | false | all
// ?limit=  default 200
// ?offset= default 0
router.get('/', async (req, res, next) => {
  try {
    const { q, activo = 'true', limit = 200, offset = 0 } = req.query;

    const conditions = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (activo !== 'all') {
      conditions.push(`activo = $${idx++}`);
      params.push(activo !== 'false');
    }
    if (q && q.trim()) {
      conditions.push(`(razon_social ILIKE $${idx} OR cuit ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 200, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT id, razon_social, cuit, telefono, email, direccion, cond_pago, activo, created_at
        FROM proveedores
        WHERE ${where}
        ORDER BY razon_social
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM proveedores WHERE ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), proveedores: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/proveedores ────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { razon_social, cuit, telefono, email, direccion, cond_pago } = req.body;
    if (!razon_social) return res.status(400).json({ error: 'razon_social es requerido' });

    const { rows } = await pool.query(`
      INSERT INTO proveedores (razon_social, cuit, telefono, email, direccion, cond_pago)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, razon_social, cuit, activo, created_at
    `, [
      razon_social.trim(),
      cuit?.trim() || null,
      telefono?.trim() || null,
      email?.trim() || null,
      direccion?.trim() || null,
      cond_pago?.trim() || null,
    ]);

    res.status(201).json({ proveedor: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un proveedor con ese CUIT' });
    next(err);
  }
});

// ─── GET /api/proveedores/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM proveedores WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ proveedor: rows[0] });
  } catch (err) { next(err); }
});

// ─── PUT /api/proveedores/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const fields = ['razon_social', 'cuit', 'telefono', 'email', 'direccion', 'cond_pago', 'activo', 'cond_iva_id'];
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

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE proveedores SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'CUIT duplicado' });
    next(err);
  }
});

// ─── GET /api/proveedores/:id/cuenta-corriente ────────────────────────────────
// Movimientos de la cuenta corriente del proveedor con saldo acumulado
router.get('/:id/cuenta-corriente', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [{ rows: prov }, { rows: movs }, { rows: totales }] = await Promise.all([
      pool.query(`SELECT id, razon_social, cuit FROM proveedores WHERE id = $1 AND deleted_at IS NULL`, [id]),
      pool.query(`
        SELECT id, debe, haber, saldo, fecha, origen_tipo, origen_id, descripcion
        FROM cuentas_corrientes_proveedor
        WHERE proveedor_id = $1
        ORDER BY fecha DESC
        LIMIT $2 OFFSET $3
      `, [id, Math.min(parseInt(limit) || 50, 200), Math.max(parseInt(offset) || 0, 0)]),
      pool.query(`
        SELECT
          COALESCE(SUM(debe), 0)           AS total_debe,
          COALESCE(SUM(haber), 0)          AS total_haber,
          COALESCE(SUM(debe) - SUM(haber), 0) AS saldo_actual
        FROM cuentas_corrientes_proveedor
        WHERE proveedor_id = $1
      `, [id]),
    ]);

    if (!prov[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });

    res.json({
      proveedor: prov[0],
      movimientos: movs,
      totales: totales[0],
    });
  } catch (err) { next(err); }
});

// ─── GET /api/proveedores/:id/anticipos ──────────────────────────────────────
// Anticipos disponibles de un proveedor (para mostrar alerta en el formulario)
router.get('/:id/anticipos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      SELECT id, monto, fecha, descripcion, estado
      FROM anticipos_proveedor
      WHERE proveedor_id = $1 AND estado = 'disponible'
      ORDER BY fecha ASC
    `, [id]);

    const totalDisponible = rows.reduce((acc, r) => acc + parseFloat(r.monto), 0);
    res.json({ anticipos: rows, total_disponible: totalDisponible.toFixed(2) });
  } catch (err) { next(err); }
});

module.exports = router;
