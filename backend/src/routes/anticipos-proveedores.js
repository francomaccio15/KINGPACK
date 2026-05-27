const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/anticipos-proveedores ──────────────────────────────────────────
// ?proveedor_id=   filtrar por proveedor
// ?estado=         disponible | vinculado | anulado | all (default: disponible)
router.get('/', async (req, res, next) => {
  try {
    const { proveedor_id, estado = 'disponible', limit = 100, offset = 0 } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (proveedor_id) { conditions.push(`a.proveedor_id = $${idx++}`); params.push(proveedor_id); }
    if (estado !== 'all') { conditions.push(`a.estado = $${idx++}`); params.push(estado); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const { rows } = await pool.query(`
      SELECT
        a.id, a.proveedor_id, a.monto, a.fecha, a.estado, a.descripcion, a.created_at,
        p.razon_social AS proveedor_nombre, p.cuit AS proveedor_cuit,
        a.egreso_vinculado_id
      FROM anticipos_proveedor a
      JOIN proveedores p ON p.id = a.proveedor_id
      ${where}
      ORDER BY a.fecha DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    res.json({ count: rows.length, anticipos: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/anticipos-proveedores ─────────────────────────────────────────
// Crea un anticipo independiente (sin pasar por el formulario de egresos).
// El flujo principal de anticipos usa POST /api/egresos con tipo='anticipo_proveedor'.
// Body: { proveedor_id, monto, fecha?, descripcion? }
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { proveedor_id, monto, fecha, descripcion } = req.body;
    if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id es requerido' });
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) return res.status(400).json({ error: 'monto debe ser mayor a 0' });

    await client.query('BEGIN');

    const { rows } = await client.query(`
      INSERT INTO anticipos_proveedor (proveedor_id, monto, fecha, descripcion)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [proveedor_id, montoNum, fecha || new Date().toISOString().split('T')[0], descripcion?.trim() || null]);
    const anticipo = rows[0];

    // Registrar en cuenta corriente (haber: pagamos por adelantado)
    const { rows: saldoRows } = await client.query(
      `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
       FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`, [proveedor_id]
    );
    const saldoPrev = parseFloat(saldoRows[0].saldo) || 0;

    await client.query(`
      INSERT INTO cuentas_corrientes_proveedor
        (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion)
      VALUES ($1, 0, $2, $3, 'anticipo', $4, $5)
    `, [proveedor_id, montoNum, +(saldoPrev - montoNum).toFixed(2),
        anticipo.id, `Anticipo — ${descripcion || ''}`.substring(0, 200)]);

    await client.query('COMMIT');
    res.status(201).json({ anticipo });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── POST /api/anticipos-proveedores/:id/vincular ─────────────────────────────
// Vincula manualmente un anticipo a un egreso existente
// Body: { egreso_id }
router.post('/:id/vincular', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { egreso_id } = req.body;
    if (!egreso_id) return res.status(400).json({ error: 'egreso_id es requerido' });

    const { rowCount } = await pool.query(`
      UPDATE anticipos_proveedor
      SET estado = 'vinculado', egreso_vinculado_id = $1
      WHERE id = $2 AND estado = 'disponible'
    `, [egreso_id, id]);

    if (rowCount === 0) {
      return res.status(409).json({ error: 'El anticipo no está disponible para vincular' });
    }

    // Actualizar el egreso con el anticipo_id
    await pool.query(
      `UPDATE egresos SET anticipo_id = $1, updated_at = NOW() WHERE id = $2`,
      [id, egreso_id]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── POST /api/anticipos-proveedores/:id/anular ───────────────────────────────
router.post('/:id/anular', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const { rows } = await client.query(
      `SELECT * FROM anticipos_proveedor WHERE id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Anticipo no encontrado' });
    if (rows[0].estado !== 'disponible') {
      return res.status(400).json({ error: 'Solo se pueden anular anticipos disponibles' });
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE anticipos_proveedor SET estado = 'anulado' WHERE id = $1`, [id]
    );

    // Reversión en cuenta corriente
    const anticipo = rows[0];
    const { rows: saldoRows } = await client.query(
      `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
       FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`, [anticipo.proveedor_id]
    );
    const saldoPrev = parseFloat(saldoRows[0].saldo) || 0;

    await client.query(`
      INSERT INTO cuentas_corrientes_proveedor
        (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion)
      VALUES ($1, $2, 0, $3, 'correccion', $4, 'Anulación de anticipo')
    `, [anticipo.proveedor_id, anticipo.monto, +(saldoPrev + anticipo.monto).toFixed(2), id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
