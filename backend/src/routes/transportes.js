const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/transportes ─────────────────────────────────────────────────────
// ?q=      busca en razon_social o cuit
// ?activo= true (default) | false | all
// ?limit=  default 500  ?offset= default 0
router.get('/', async (req, res, next) => {
  try {
    const { q, activo = 'true', limit = 500, offset = 0 } = req.query;

    const conditions = ['t.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (activo !== 'all') {
      conditions.push(`t.activo = $${idx++}`);
      params.push(activo !== 'false');
    }
    if (q && q.trim()) {
      conditions.push(`(t.razon_social ILIKE $${idx} OR t.cuit ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 500, 1000));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          t.id, t.razon_social, t.cuit, t.telefono, t.email, t.direccion,
          t.activo, t.created_at, t.saldo_inicial,
          -- Saldo actual = saldo inicial + Σ debe − Σ haber (positivo = le debemos)
          t.saldo_inicial + COALESCE(m.mov, 0) AS saldo_actual
        FROM transportes t
        LEFT JOIN (
          SELECT transporte_id,
                 COALESCE(SUM(debe), 0) - COALESCE(SUM(haber), 0) AS mov
          FROM movimientos_transporte
          GROUP BY transporte_id
        ) m ON m.transporte_id = t.id
        WHERE ${where}
        ORDER BY t.razon_social
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM transportes t WHERE ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), transportes: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/transportes ────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { razon_social, cuit, telefono, email, direccion, saldo_inicial } = req.body;
    if (!razon_social || !razon_social.trim()) {
      return res.status(400).json({ error: 'La razón social es requerida' });
    }

    const { rows } = await pool.query(`
      INSERT INTO transportes (razon_social, cuit, telefono, email, direccion, saldo_inicial)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, razon_social, cuit, activo, created_at
    `, [
      razon_social.trim(),
      cuit?.trim() || null,
      telefono?.trim() || null,
      email?.trim() || null,
      direccion?.trim() || null,
      parseFloat(saldo_inicial) || 0,
    ]);

    res.status(201).json({ transporte: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un transporte con ese CUIT' });
    next(err);
  }
});

// ─── GET /api/transportes/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM transportes WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Transporte no encontrado' });
    res.json({ transporte: rows[0] });
  } catch (err) { next(err); }
});

// ─── PUT /api/transportes/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const fields = ['razon_social', 'cuit', 'telefono', 'email', 'direccion', 'activo', 'saldo_inicial'];
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
      `UPDATE transportes SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Transporte no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'CUIT duplicado' });
    next(err);
  }
});

// ─── GET /api/transportes/:id/movimientos ─────────────────────────────────────
// Historial de pedidos y pagos, con saldo acumulado y totales.
router.get('/:id/movimientos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const { rows: trs } = await pool.query(
      `SELECT id, razon_social, cuit, saldo_inicial FROM transportes WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!trs[0]) return res.status(404).json({ error: 'Transporte no encontrado' });
    const saldoInicial = parseFloat(trs[0].saldo_inicial) || 0;

    const [{ rows: movs }, { rows: totales }] = await Promise.all([
      // El saldo corre en orden cronológico (asc) y después se muestra al revés.
      pool.query(`
        SELECT * FROM (
          SELECT
            id, tipo, debe, haber, fecha, descripcion, medio_pago, created_at,
            $2::numeric + SUM(debe - haber) OVER (ORDER BY fecha ASC, created_at ASC, id ASC) AS saldo
          FROM movimientos_transporte
          WHERE transporte_id = $1
        ) x
        ORDER BY fecha DESC, created_at DESC, id DESC
        LIMIT $3 OFFSET $4
      `, [id, saldoInicial, Math.min(parseInt(limit) || 100, 500), Math.max(parseInt(offset) || 0, 0)]),
      pool.query(`
        SELECT COALESCE(SUM(debe), 0) AS total_debe,
               COALESCE(SUM(haber), 0) AS total_haber
        FROM movimientos_transporte WHERE transporte_id = $1
      `, [id]),
    ]);

    const totalDebe  = parseFloat(totales[0].total_debe) || 0;
    const totalHaber = parseFloat(totales[0].total_haber) || 0;
    const saldoActual = +(saldoInicial + totalDebe - totalHaber).toFixed(2);

    res.json({
      transporte: trs[0],
      movimientos: movs,
      totales: {
        saldo_inicial: saldoInicial.toFixed(2),
        total_debe:  totalDebe.toFixed(2),
        total_haber: totalHaber.toFixed(2),
        saldo_actual: saldoActual.toFixed(2),
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /api/transportes/:id/movimientos ────────────────────────────────────
// Body: { tipo: 'pedido'|'pago', monto, fecha?, descripcion?, medio_pago? }
//   pedido → cargo (debe): sube lo que le debemos.
//   pago   → abono (haber): baja lo que le debemos.
router.post('/:id/movimientos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, monto, fecha, descripcion, medio_pago } = req.body;

    if (!['pedido', 'pago'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido (pedido o pago)' });
    }
    const m = parseFloat(monto);
    if (!(m > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const { rows: trs } = await pool.query(
      `SELECT id FROM transportes WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    if (!trs[0]) return res.status(404).json({ error: 'Transporte no encontrado' });

    const debe  = tipo === 'pedido' ? m : 0;
    const haber = tipo === 'pago'   ? m : 0;

    const { rows } = await pool.query(`
      INSERT INTO movimientos_transporte
        (transporte_id, tipo, debe, haber, fecha, descripcion, medio_pago, created_by)
      VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6, $7, $8)
      RETURNING id
    `, [
      id, tipo, debe, haber,
      fecha || null,
      descripcion?.trim() || null,
      tipo === 'pago' ? (medio_pago?.trim() || null) : null,
      req.usuario?.id || null,
    ]);

    res.status(201).json({ id: rows[0].id });
  } catch (err) { next(err); }
});

// ─── DELETE /api/transportes/:id/movimientos/:movId ───────────────────────────
router.delete('/:id/movimientos/:movId', async (req, res, next) => {
  try {
    const { id, movId } = req.params;
    const { rowCount } = await pool.query(
      `DELETE FROM movimientos_transporte WHERE id = $1 AND transporte_id = $2`,
      [movId, id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
