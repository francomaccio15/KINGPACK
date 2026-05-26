const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/caja/estado ─────────────────────────────────────────────────────
// Devuelve la caja abierta de cada sucursal (o null si no hay)
router.get('/estado', async (req, res, next) => {
  try {
    const sucId = sucursalEfectiva(req);
    const params = sucId ? [sucId] : [];
    const sucursFiltro = sucId ? `AND s.id = $1` : '';

    const { rows } = await pool.query(`
      SELECT
        s.id          AS sucursal_id,
        s.nombre      AS sucursal_nombre,
        c.id,
        c.fecha_apertura,
        c.saldo_inicial,
        c.estado,
        COALESCE(SUM(CASE WHEN m.tipo IN ('ingreso','venta') THEN m.monto ELSE 0 END), 0) AS total_ingresos,
        COALESCE(SUM(CASE WHEN m.tipo IN ('egreso','retiro') THEN m.monto ELSE 0 END), 0) AS total_egresos,
        COUNT(m.id) AS total_movimientos
      FROM sucursales s
      LEFT JOIN cajas c
        ON c.sucursal_id = s.id AND c.estado = 'abierta'
      LEFT JOIN movimientos_caja m
        ON m.caja_id = c.id
      WHERE s.activo = true ${sucursFiltro}
      GROUP BY s.id, s.nombre, c.id, c.fecha_apertura, c.saldo_inicial, c.estado
      ORDER BY s.nombre
    `, params);

    res.json({ sucursales: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/caja ────────────────────────────────────────────────────────────
// ?estado=     abierta | cerrada
// ?sucursal_id=
// ?fecha_desde= ISO date
// ?fecha_hasta= ISO date
// ?limit=       default 50
// ?offset=      default 0
router.get('/', async (req, res, next) => {
  try {
    const { estado, fecha_desde, fecha_hasta, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (estado) {
      conditions.push(`c.estado = $${idx++}`);
      params.push(estado);
    }
    const sucId = sucursalEfectiva(req);
    if (sucId) {
      conditions.push(`c.sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (fecha_desde) {
      conditions.push(`c.fecha_apertura >= $${idx++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`c.fecha_apertura < ($${idx++}::date + interval '1 day')`);
      params.push(fecha_hasta);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 50, 200));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          c.id, c.fecha_apertura, c.fecha_cierre, c.estado,
          c.saldo_inicial, c.saldo_final_sistema, c.saldo_final_real, c.diferencia,
          s.nombre AS sucursal_nombre,
          (SELECT COUNT(*) FROM movimientos_caja m WHERE m.caja_id = c.id) AS total_movimientos
        FROM cajas c
        LEFT JOIN sucursales s ON s.id = c.sucursal_id
        ${where}
        ORDER BY c.fecha_apertura DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM cajas c ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), cajas: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/caja/abrir ─────────────────────────────────────────────────────
// Body: sucursal_id, saldo_inicial
router.post('/abrir', async (req, res, next) => {
  try {
    const { sucursal_id, saldo_inicial = 0 } = req.body;
    if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido' });

    // Verificar que no haya caja abierta en esa sucursal
    const { rows: cajaAbierta } = await pool.query(
      `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta'`,
      [sucursal_id]
    );
    if (cajaAbierta.length > 0) {
      return res.status(409).json({ error: 'Ya existe una caja abierta en esa sucursal' });
    }

    const { rows } = await pool.query(`
      INSERT INTO cajas (sucursal_id, saldo_inicial)
      VALUES ($1, $2)
      RETURNING id, fecha_apertura, estado, saldo_inicial
    `, [sucursal_id, parseFloat(saldo_inicial) || 0]);

    res.status(201).json({ caja: rows[0] });
  } catch (err) { next(err); }
});

// ─── GET /api/caja/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [{ rows: cajaRows }, { rows: movRows }, { rows: mediosRows }] = await Promise.all([
      pool.query(`
        SELECT
          c.id, c.fecha_apertura, c.fecha_cierre, c.estado,
          c.saldo_inicial, c.saldo_final_sistema, c.saldo_final_real, c.diferencia,
          s.nombre AS sucursal_nombre,
          -- Totales calculados
          COALESCE(SUM(CASE WHEN m.tipo IN ('ingreso','venta') THEN m.monto ELSE 0 END), 0) AS total_ingresos,
          COALESCE(SUM(CASE WHEN m.tipo IN ('egreso','retiro') THEN m.monto ELSE 0 END), 0) AS total_egresos,
          COUNT(m.id) AS total_movimientos
        FROM cajas c
        LEFT JOIN sucursales s ON s.id = c.sucursal_id
        LEFT JOIN movimientos_caja m ON m.caja_id = c.id
        WHERE c.id = $1
        GROUP BY c.id, s.nombre
      `, [id]),
      pool.query(`
        SELECT
          m.id, m.tipo, m.concepto, m.monto, m.fecha,
          m.origen_tipo, m.origen_id,
          mp.nombre AS medio_pago
        FROM movimientos_caja m
        LEFT JOIN medios_pago mp ON mp.id = m.medio_pago_id
        WHERE m.caja_id = $1
        ORDER BY m.fecha DESC
      `, [id]),
      pool.query(
        `SELECT id, nombre FROM medios_pago WHERE activo = true ORDER BY nombre`
      ),
    ]);

    if (cajaRows.length === 0) return res.status(404).json({ error: 'Caja no encontrada' });

    res.json({ caja: cajaRows[0], movimientos: movRows, medios_pago: mediosRows });
  } catch (err) { next(err); }
});

// ─── POST /api/caja/:id/movimiento ───────────────────────────────────────────
// Body: tipo ('ingreso'|'egreso'|'retiro'), concepto, monto, medio_pago_id (opt)
router.post('/:id/movimiento', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, concepto, monto, medio_pago_id } = req.body;

    if (!['ingreso', 'egreso', 'retiro'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser ingreso, egreso o retiro' });
    }
    if (!concepto?.trim()) return res.status(400).json({ error: 'concepto es requerido' });
    if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ error: 'monto debe ser mayor a 0' });

    // Verificar que la caja esté abierta
    const { rows: cajaRows } = await pool.query(
      `SELECT id FROM cajas WHERE id = $1 AND estado = 'abierta'`,
      [id]
    );
    if (cajaRows.length === 0) return res.status(409).json({ error: 'La caja no está abierta' });

    const { rows } = await pool.query(`
      INSERT INTO movimientos_caja (caja_id, tipo, concepto, monto, medio_pago_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tipo, concepto, monto, fecha
    `, [id, tipo, concepto.trim(), parseFloat(monto), medio_pago_id || null]);

    res.status(201).json({ movimiento: rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /api/caja/:id/cerrar ────────────────────────────────────────────────
// Body: saldo_final_real
router.post('/:id/cerrar', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { saldo_final_real } = req.body;

    if (saldo_final_real === undefined || saldo_final_real === null) {
      return res.status(400).json({ error: 'saldo_final_real es requerido' });
    }

    await client.query('BEGIN');

    // Verificar que la caja esté abierta y calcular saldo sistema
    const { rows: cajaRows } = await client.query(`
      SELECT
        c.id, c.saldo_inicial,
        COALESCE(SUM(CASE WHEN m.tipo IN ('ingreso','venta') THEN m.monto ELSE 0 END), 0) AS total_ingresos,
        COALESCE(SUM(CASE WHEN m.tipo IN ('egreso','retiro') THEN m.monto ELSE 0 END), 0) AS total_egresos
      FROM cajas c
      LEFT JOIN movimientos_caja m ON m.caja_id = c.id
      WHERE c.id = $1 AND c.estado = 'abierta'
      GROUP BY c.id, c.saldo_inicial
    `, [id]);

    if (cajaRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La caja no está abierta' });
    }

    const caja = cajaRows[0];
    const saldoSistema = parseFloat(caja.saldo_inicial)
      + parseFloat(caja.total_ingresos)
      - parseFloat(caja.total_egresos);
    const saldoReal = parseFloat(saldo_final_real);
    const diferencia = saldoSistema - saldoReal;

    const { rows: updRows } = await client.query(`
      UPDATE cajas
      SET estado           = 'cerrada',
          fecha_cierre     = NOW(),
          saldo_final_sistema = $1,
          saldo_final_real    = $2,
          diferencia          = $3
      WHERE id = $4
      RETURNING id, estado, fecha_cierre, saldo_final_sistema, saldo_final_real, diferencia
    `, [saldoSistema.toFixed(2), saldoReal.toFixed(2), diferencia.toFixed(2), id]);

    await client.query('COMMIT');
    res.json({ caja: updRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
