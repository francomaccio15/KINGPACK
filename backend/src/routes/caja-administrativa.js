const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');
const { fijarSaldoCajaAdministrativa } = require('../services/movimientos-caja-administrativa');

const router = express.Router();

// La Caja Administrativa la ve y la maneja solo el administrador.
router.use(requireRol('administrador'));

// ─── GET /api/caja-administrativa ─────────────────────────────────────────────
// Saldo, lo que lo compone y cuánto aportó cada sucursal con sus cierres.
router.get('/', async (req, res, next) => {
  try {
    const [{ rows: [caja] }, { rows: porSucursal }] = await Promise.all([
      pool.query(`
        SELECT COALESCE(ca.saldo, 0)::float         AS saldo,
               COALESCE(ca.saldo_inicial, 0)::float AS saldo_inicial,
               ca.updated_at,
               (SELECT COALESCE(SUM(monto), 0)::float FROM movimientos_caja_administrativa WHERE tipo = 'ingreso') AS ingresos,
               (SELECT COALESCE(SUM(monto), 0)::float FROM movimientos_caja_administrativa WHERE tipo = 'egreso')  AS egresos
          FROM (SELECT 1) x
          LEFT JOIN caja_administrativa ca ON ca.id = 1
      `),
      pool.query(`
        SELECT s.id AS sucursal_id, s.nombre AS sucursal_nombre,
               COALESCE(SUM(m.monto) FILTER (WHERE m.origen_tipo = 'cierre_caja'), 0)::float AS cierres,
               COUNT(m.id) FILTER (WHERE m.origen_tipo = 'cierre_caja')::int AS cantidad_cierres
          FROM sucursales s
          LEFT JOIN movimientos_caja_administrativa m ON m.sucursal_id = s.id
         WHERE s.activo = true
         GROUP BY s.id, s.nombre
         ORDER BY s.nombre
      `),
    ]);
    res.json({ caja, por_sucursal: porSucursal });
  } catch (err) { next(err); }
});

// ─── GET /api/caja-administrativa/movimientos ─────────────────────────────────
// ?sucursal_id= ?tipo=ingreso|egreso ?fecha_desde= ?fecha_hasta= ?limit= ?offset=
router.get('/movimientos', async (req, res, next) => {
  try {
    const { sucursal_id, tipo, fecha_desde, fecha_hasta, limit = 50, offset = 0 } = req.query;

    const cond = [];
    const params = [];
    if (sucursal_id) { params.push(sucursal_id); cond.push(`m.sucursal_id = $${params.length}`); }
    if (tipo === 'ingreso' || tipo === 'egreso') { params.push(tipo); cond.push(`m.tipo = $${params.length}`); }
    if (fecha_desde) { params.push(fecha_desde); cond.push(`m.fecha >= $${params.length}::date`); }
    if (fecha_hasta) { params.push(fecha_hasta); cond.push(`m.fecha < ($${params.length}::date + interval '1 day')`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 50, 200));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: [cnt] }] = await Promise.all([
      pool.query(`
        SELECT m.id, m.fecha, m.created_at, m.tipo, m.monto::float, m.concepto,
               m.origen_tipo, m.origen_id, m.sucursal_id,
               s.nombre AS sucursal_nombre, u.nombre AS usuario_nombre
          FROM movimientos_caja_administrativa m
          LEFT JOIN sucursales s ON s.id = m.sucursal_id
          LEFT JOIN usuarios   u ON u.id = m.usuario_id
          ${where}
         ORDER BY m.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      pool.query(`SELECT COUNT(*)::int AS n FROM movimientos_caja_administrativa m ${where}`, countParams),
    ]);

    res.json({ count: cnt.n, movimientos: rows });
  } catch (err) { next(err); }
});

// ─── PUT /api/caja-administrativa ─────────────────────────────────────────────
// Body: { saldo } — el efectivo realmente contado. Re-basa `saldo_inicial` para
// que el invariante siga valiendo y los movimientos se conserven.
router.put('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { saldo } = req.body;
    if (saldo === undefined || saldo === null || saldo === '') {
      return res.status(400).json({ error: 'saldo es requerido' });
    }
    const monto = parseFloat(saldo);
    if (!Number.isFinite(monto)) return res.status(400).json({ error: 'saldo debe ser un número' });
    if (monto < 0) return res.status(400).json({ error: 'El saldo no puede ser negativo' });

    await client.query('BEGIN');
    const resultado = await fijarSaldoCajaAdministrativa(client, monto);
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
