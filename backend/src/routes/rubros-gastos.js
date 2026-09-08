const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/rubros-gastos ───────────────────────────────────────────────────
// Retorna rubros con sus subrubros anidados.
// Query opcional: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (+ sucursal_id vía toggle)
// → agrega el total y la cantidad de egresos por subrubro/rubro en ese período.
// Usa los MISMOS filtros que el estado de resultados (deleted_at IS NULL,
// tipo_operacion <> 'compra_mercaderia') para que los montos reconcilien.
router.get('/', async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const conFechas = Boolean(desde && hasta);

    // Filtro de sucursal coherente con el resto del sistema (cajero fijo, admin
    // por query/cookie inyectada). null = todas las sucursales.
    const sucId = sucursalEfectiva(req);

    // Traer totales por subrubro solo si se pidió un rango de fechas.
    let totalesPromise = Promise.resolve({ rows: [] });
    if (conFechas) {
      const sucEgreso  = sucId ? 'AND e.sucursal_id = $3' : '';
      const params     = sucId ? [desde, hasta, sucId] : [desde, hasta];
      totalesPromise = pool.query(`
        SELECT
          sg.id                            AS subrubro_id,
          COALESCE(SUM(e.total), 0)::float AS total,
          COUNT(e.id)::int                 AS cantidad
        FROM subrubro_gastos sg
        LEFT JOIN egresos e
          ON  e.subrubro_gasto_id = sg.id
          AND e.deleted_at IS NULL
          AND e.fecha_emision::date BETWEEN $1 AND $2
          AND e.tipo_operacion <> 'compra_mercaderia'
          ${sucEgreso}
        GROUP BY sg.id
      `, params);
    }

    const [{ rows: rubros }, { rows: subrubros }, { rows: totales }] = await Promise.all([
      pool.query(`
        SELECT rg.id, rg.nombre, rg.orden,
               rg.categoria_resultado_id,
               cr.nombre  AS categoria_nombre,
               cr.seccion AS categoria_seccion
        FROM rubros_gastos rg
        LEFT JOIN categorias_resultado cr ON cr.id = rg.categoria_resultado_id
        ORDER BY rg.orden, rg.nombre
      `),
      pool.query(`
        SELECT id, nombre, rubro_id, rubro AS rubro_texto
        FROM subrubro_gastos
        ORDER BY nombre
      `),
      totalesPromise,
    ]);

    const totalMap = new Map(totales.map(t => [t.subrubro_id, t]));
    const conMonto = (s) => {
      if (!conFechas) return s;
      const t = totalMap.get(s.id);
      return { ...s, total: t ? t.total : 0, cantidad: t ? t.cantidad : 0 };
    };

    const rubrosMap = rubros.map(r => {
      const subs = subrubros.filter(s => s.rubro_id === r.id).map(conMonto);
      const total = conFechas ? subs.reduce((a, s) => a + s.total, 0) : undefined;
      const cantidad = conFechas ? subs.reduce((a, s) => a + s.cantidad, 0) : undefined;
      return { ...r, subrubros: subs, ...(conFechas ? { total, cantidad } : {}) };
    });

    // Subrubros sin rubro asignado (legado con campo rubro texto)
    const sinRubro = subrubros.filter(s => !s.rubro_id).map(conMonto);

    const totalGeneral = conFechas
      ? rubrosMap.reduce((a, r) => a + (r.total || 0), 0)
      : undefined;

    res.json({
      rubros: rubrosMap,
      sin_clasificar: sinRubro,
      ...(conFechas ? { periodo: { desde, hasta }, total_general: totalGeneral } : {}),
    });
  } catch (err) { next(err); }
});

// ─── POST /api/rubros-gastos ──────────────────────────────────────────────────
// Body: { nombre, orden? }
router.post('/', async (req, res, next) => {
  try {
    const { nombre, orden = 0 } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const { rows } = await pool.query(
      `INSERT INTO rubros_gastos (nombre, orden) VALUES ($1, $2) RETURNING *`,
      [nombre.trim(), parseInt(orden) || 0]
    );
    res.status(201).json({ rubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un rubro con ese nombre' });
    next(err);
  }
});

// ─── POST /api/rubros-gastos/:id/subrubros ────────────────────────────────────
// Body: { nombre }
router.post('/:id/subrubros', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const rubroCheck = await pool.query(`SELECT id FROM rubros_gastos WHERE id = $1`, [id]);
    if (!rubroCheck.rows[0]) return res.status(404).json({ error: 'Rubro no encontrado' });

    const { rows: rubroRows } = await pool.query(`SELECT nombre FROM rubros_gastos WHERE id = $1`, [id]);

    const { rows } = await pool.query(
      `INSERT INTO subrubro_gastos (nombre, rubro, rubro_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), rubroRows[0].nombre, id]
    );
    res.status(201).json({ subrubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un subrubro con ese nombre' });
    next(err);
  }
});

// ─── PUT /api/rubros-gastos/:id ───────────────────────────────────────────────
// Body: { nombre?, orden? }
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, orden } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) {
      if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });
      updates.push(`nombre = $${idx++}`); params.push(nombre.trim());
    }
    if (orden !== undefined) { updates.push(`orden = $${idx++}`); params.push(parseInt(orden) || 0); }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE rubros_gastos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Rubro no encontrado' });

    // Mantener el campo texto legado de los subrubros en sincronía
    if (nombre !== undefined) {
      await pool.query(`UPDATE subrubro_gastos SET rubro = $1 WHERE rubro_id = $2`, [nombre.trim(), id]);
    }
    res.json({ rubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un rubro con ese nombre' });
    next(err);
  }
});

// ─── PUT /api/rubros-gastos/subrubros/:id ─────────────────────────────────────
// Body: { nombre }
router.put('/subrubros/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    const { rows } = await pool.query(
      `UPDATE subrubro_gastos SET nombre = $1 WHERE id = $2 RETURNING *`,
      [nombre.trim(), id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Subrubro no encontrado' });
    res.json({ subrubro: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un subrubro con ese nombre' });
    next(err);
  }
});

module.exports = router;
