const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

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
        SELECT
          proveedores.id, razon_social, cuit, telefono, email, direccion, cond_pago,
          activo, created_at,
          saldo_inicial_facturado, saldo_inicial_no_facturado,
          -- Saldo en tiempo real por concepto = saldo inicial + Σ debe − Σ haber
          saldo_inicial_facturado    + COALESCE(cc.mov_fact, 0)   AS saldo_facturado,
          saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0) AS saldo_no_facturado
        FROM proveedores
        LEFT JOIN (
          SELECT proveedor_id,
            COALESCE(SUM(debe) FILTER (WHERE facturado), 0)
              - COALESCE(SUM(haber) FILTER (WHERE facturado), 0)     AS mov_fact,
            COALESCE(SUM(debe) FILTER (WHERE NOT facturado), 0)
              - COALESCE(SUM(haber) FILTER (WHERE NOT facturado), 0) AS mov_nofact
          FROM cuentas_corrientes_proveedor
          GROUP BY proveedor_id
        ) cc ON cc.proveedor_id = proveedores.id
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
    const {
      razon_social, cuit, telefono, email, direccion, cond_pago,
      saldo_inicial_facturado, saldo_inicial_no_facturado,
    } = req.body;
    if (!razon_social) return res.status(400).json({ error: 'razon_social es requerido' });

    const { rows } = await pool.query(`
      INSERT INTO proveedores
        (razon_social, cuit, telefono, email, direccion, cond_pago,
         saldo_inicial_facturado, saldo_inicial_no_facturado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, razon_social, cuit, activo, created_at
    `, [
      razon_social.trim(),
      cuit?.trim() || null,
      telefono?.trim() || null,
      email?.trim() || null,
      direccion?.trim() || null,
      cond_pago?.trim() || null,
      parseFloat(saldo_inicial_facturado) || 0,
      parseFloat(saldo_inicial_no_facturado) || 0,
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
    const fields = ['razon_social', 'cuit', 'telefono', 'email', 'direccion', 'cond_pago', 'activo', 'cond_iva_id', 'saldo_inicial_facturado', 'saldo_inicial_no_facturado'];
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
      pool.query(`SELECT id, razon_social, cuit, saldo_inicial_facturado, saldo_inicial_no_facturado FROM proveedores WHERE id = $1 AND deleted_at IS NULL`, [id]),
      pool.query(`
        SELECT id, debe, haber, saldo, fecha, origen_tipo, origen_id, descripcion, facturado
        FROM cuentas_corrientes_proveedor
        WHERE proveedor_id = $1
        ORDER BY fecha DESC
        LIMIT $2 OFFSET $3
      `, [id, Math.min(parseInt(limit) || 50, 200), Math.max(parseInt(offset) || 0, 0)]),
      pool.query(`
        SELECT
          COALESCE(SUM(debe), 0)  AS total_debe,
          COALESCE(SUM(haber), 0) AS total_haber,
          COALESCE(SUM(debe) FILTER (WHERE facturado), 0)
            - COALESCE(SUM(haber) FILTER (WHERE facturado), 0)     AS neto_facturado,
          COALESCE(SUM(debe) FILTER (WHERE NOT facturado), 0)
            - COALESCE(SUM(haber) FILTER (WHERE NOT facturado), 0) AS neto_no_facturado
        FROM cuentas_corrientes_proveedor
        WHERE proveedor_id = $1
      `, [id]),
    ]);

    if (!prov[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });

    // Saldo real por concepto = saldo inicial + (Σ debe − Σ haber). Positivo = le debemos.
    const iniFact   = parseFloat(prov[0].saldo_inicial_facturado) || 0;
    const iniNoFact = parseFloat(prov[0].saldo_inicial_no_facturado) || 0;
    const saldoFacturado   = +(iniFact   + (parseFloat(totales[0].neto_facturado)   || 0)).toFixed(2);
    const saldoNoFacturado = +(iniNoFact + (parseFloat(totales[0].neto_no_facturado) || 0)).toFixed(2);

    res.json({
      proveedor: prov[0],
      movimientos: movs,
      totales: {
        total_debe: totales[0].total_debe,
        total_haber: totales[0].total_haber,
        saldo_inicial_facturado: iniFact.toFixed(2),
        saldo_inicial_no_facturado: iniNoFact.toFixed(2),
        saldo_facturado: saldoFacturado.toFixed(2),
        saldo_no_facturado: saldoNoFacturado.toFixed(2),
        saldo_actual: (saldoFacturado + saldoNoFacturado).toFixed(2),
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /api/proveedores/:id/ajuste-cc ──────────────────────────────────────
// Ajuste manual de saldo de la cuenta corriente (solo administrador).
// El saldo es derivado (saldo_inicial + Σdebe − Σhaber), así que no se "edita"
// un número: se registra un movimiento de corrección que lleva el saldo del
// concepto (facturado / no facturado) al valor objetivo, sin tocar el historial.
router.post('/:id/ajuste-cc', requireRol('administrador'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { facturado, saldo_objetivo, motivo } = req.body;

    const esFacturado = !!facturado;
    const objetivo = parseFloat(saldo_objetivo);
    if (!Number.isFinite(objetivo)) {
      return res.status(400).json({ error: 'saldo_objetivo debe ser un número' });
    }

    await client.query('BEGIN');

    // Proveedor + saldo inicial del concepto
    const { rows: prov } = await client.query(
      `SELECT id, saldo_inicial_facturado, saldo_inicial_no_facturado
       FROM proveedores WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!prov[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const ini = parseFloat(
      esFacturado ? prov[0].saldo_inicial_facturado : prov[0].saldo_inicial_no_facturado
    ) || 0;

    // Saldo actual del concepto = saldo inicial + Σdebe − Σhaber (filtrado)
    const { rows: netoRows } = await client.query(
      `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS neto
       FROM cuentas_corrientes_proveedor
       WHERE proveedor_id = $1 AND facturado = $2`,
      [id, esFacturado]
    );
    const saldoActual = +(ini + (parseFloat(netoRows[0].neto) || 0)).toFixed(2);
    const delta = +(objetivo - saldoActual).toFixed(2);

    if (Math.abs(delta) < 0.005) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El saldo ya es igual al valor indicado; no hay nada que ajustar.' });
    }

    // delta > 0 ⇒ subir la deuda (debe); delta < 0 ⇒ bajarla (haber)
    const debe  = delta > 0 ? delta : 0;
    const haber = delta < 0 ? -delta : 0;

    // Saldo running global (mismo criterio que el resto de los movimientos)
    const { rows: glob } = await client.query(
      `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
       FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`,
      [id]
    );
    const saldoPrev = parseFloat(glob[0].saldo) || 0;

    const descripcion = `Ajuste manual de saldo${motivo && motivo.trim() ? ` — ${motivo.trim()}` : ''}`.substring(0, 200);

    await client.query(`
      INSERT INTO cuentas_corrientes_proveedor
        (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
      VALUES ($1, $2, $3, $4, 'correccion', $5, $6, $7)
    `, [id, debe, haber, +(saldoPrev + debe - haber).toFixed(2), id, descripcion, esFacturado]);

    await client.query('COMMIT');
    res.status(201).json({ ok: true, saldo_anterior: saldoActual, saldo_nuevo: objetivo, delta });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
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
