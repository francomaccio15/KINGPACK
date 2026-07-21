const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');
const { fijarSaldoCajaFuerte } = require('../services/movimientos-caja-fuerte');

const router = express.Router();

// El efectivo de la caja fuerte lo maneja solo el administrador.
router.use(requireRol('administrador'));

// ─── GET /api/caja-fuerte ─────────────────────────────────────────────────────
// Una fila por sucursal con el saldo y lo que lo compone.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id   AS sucursal_id,
        s.nombre AS sucursal_nombre,
        COALESCE(cf.saldo, 0)::float         AS saldo,
        COALESCE(cf.saldo_inicial, 0)::float AS saldo_inicial,
        cf.updated_at,
        COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0)::float AS ingresos,
        COALESCE(SUM(CASE WHEN m.tipo = 'egreso'  THEN m.monto ELSE 0 END), 0)::float AS egresos
      FROM sucursales s
      LEFT JOIN caja_fuerte cf ON cf.sucursal_id = s.id
      LEFT JOIN movimientos_caja_fuerte m ON m.sucursal_id = s.id
      WHERE s.activo = true
      GROUP BY s.id, s.nombre, cf.saldo, cf.saldo_inicial, cf.updated_at
      ORDER BY s.nombre
    `);
    res.json({ cajas: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/caja-fuerte/:sucursalId/movimientos ─────────────────────────────
// El detalle que respalda el saldo: cada peso que entró o salió.
router.get('/:sucursalId/movimientos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.id, m.fecha, m.created_at, m.tipo, m.monto::float, m.concepto,
             m.origen_tipo, u.nombre AS usuario_nombre
        FROM movimientos_caja_fuerte m
        LEFT JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.sucursal_id = $1
       ORDER BY m.created_at DESC
       LIMIT 50
    `, [req.params.sucursalId]);
    res.json({ movimientos: rows });
  } catch (err) { next(err); }
});

// ─── PUT /api/caja-fuerte/:sucursalId ─────────────────────────────────────────
// Body: { saldo } — el efectivo realmente contado.
//
// `saldo` es derivado del ledger, así que NO se escribe a secas: el helper
// re-basa `saldo_inicial` para que siga valiendo
//   saldo = saldo_inicial + Σingresos − Σegresos
// y los movimientos ya registrados se conserven.
router.put('/:sucursalId', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { saldo } = req.body;
    if (saldo === undefined || saldo === null || saldo === '') {
      return res.status(400).json({ error: 'saldo es requerido' });
    }
    const monto = parseFloat(saldo);
    if (!Number.isFinite(monto)) {
      return res.status(400).json({ error: 'saldo debe ser un número' });
    }
    if (monto < 0) {
      return res.status(400).json({ error: 'El saldo no puede ser negativo' });
    }

    const { rows: suc } = await client.query(
      `SELECT id FROM sucursales WHERE id = $1 AND activo = true`, [req.params.sucursalId]
    );
    if (!suc[0]) return res.status(404).json({ error: 'Sucursal no encontrada' });

    await client.query('BEGIN');
    const resultado = await fijarSaldoCajaFuerte(client, req.params.sucursalId, monto);
    await client.query('COMMIT');

    res.json({ ok: true, ...resultado });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
