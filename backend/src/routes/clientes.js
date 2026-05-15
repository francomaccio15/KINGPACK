// TODO(fase-2): proteger con JWT
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/clientes/cond-iva ───────────────────────────────────────────────
router.get('/cond-iva', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM cond_iva ORDER BY nombre');
    res.json({ cond_iva: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/clientes ────────────────────────────────────────────────────────
// ?q=           busca en razon_social o cuit
// ?activo=      true (default) | false | all
// ?limit=       default 200
// ?offset=      default 0
router.get('/', async (req, res, next) => {
  try {
    const { q, activo = 'true', sucursal_id, limit = 200, offset = 0 } = req.query;

    const conditions = ['c.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (activo !== 'all') {
      conditions.push(`c.activo = $${idx++}`);
      params.push(activo !== 'false');
    }
    if (q && q.trim()) {
      conditions.push(`(c.razon_social ILIKE $${idx} OR c.cuit ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }
    if (sucursal_id) {
      conditions.push(`c.sucursal_default_id = $${idx++}`);
      params.push(sucursal_id);
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];

    params.push(Math.min(parseInt(limit) || 200, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          c.id, c.razon_social, c.cuit, c.telefono, c.direccion, c.activo,
          c.limite_credito, c.descuento_adicional, c.saldo_inicial,
          ci.nombre                           AS cond_iva,
          lp.nombre                           AS lista_precio,
          lp.id                               AS lista_precio_id,
          suc.nombre                          AS sucursal_nombre,
          c.created_at,
          -- Saldo actual = saldo_inicial + debe - haber + correcciones
          c.saldo_inicial
            + COALESCE(SUM(cc.debe) - SUM(cc.haber), 0)
            + COALESCE(cs_agg.total_correcciones, 0)    AS saldo_actual
        FROM clientes c
        LEFT JOIN cond_iva ci        ON ci.id  = c.cond_iva_id
        LEFT JOIN listas_precios lp  ON lp.id  = c.lista_precio_id
        LEFT JOIN sucursales suc     ON suc.id = c.sucursal_default_id
        LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
        LEFT JOIN (
          SELECT cliente_id, SUM(monto) AS total_correcciones
            FROM correcciones_saldo_cliente GROUP BY cliente_id
        ) cs_agg ON cs_agg.cliente_id = c.id
        WHERE ${where}
        GROUP BY c.id, ci.nombre, lp.nombre, lp.id, suc.nombre, cs_agg.total_correcciones
        ORDER BY c.razon_social
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM clientes c WHERE ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), clientes: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/clientes ───────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      razon_social, cuit, cond_iva_id, telefono, direccion,
      sucursal_default_id, lista_precio_id,
      limite_credito = 0, descuento_adicional = 0, saldo_inicial = 0,
    } = req.body;

    if (!razon_social || !cond_iva_id) {
      return res.status(400).json({ error: 'razon_social y cond_iva_id son requeridos' });
    }

    const { rows } = await pool.query(`
      INSERT INTO clientes
        (razon_social, cuit, cond_iva_id, telefono, direccion,
         sucursal_default_id, lista_precio_id, limite_credito, descuento_adicional, saldo_inicial)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, razon_social, cuit, activo, created_at
    `, [
      razon_social.trim(),
      cuit?.trim() || null,
      cond_iva_id,
      telefono?.trim() || null,
      direccion?.trim() || null,
      sucursal_default_id || null,
      lista_precio_id || null,
      parseFloat(limite_credito) || 0,
      parseFloat(descuento_adicional) || 0,
      parseFloat(saldo_inicial) || 0,
    ]);

    res.status(201).json({ cliente: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un cliente con ese CUIT' });
    next(err);
  }
});

// ─── GET /api/clientes/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.*,
        ci.nombre                           AS cond_iva,
        lp.nombre                           AS lista_precio,
        suc.nombre                          AS sucursal_nombre,
        c.saldo_inicial
          + COALESCE(SUM(cc.debe) - SUM(cc.haber), 0)
          + COALESCE(cs_agg.total_correcciones, 0)    AS saldo_actual
      FROM clientes c
      LEFT JOIN cond_iva ci        ON ci.id  = c.cond_iva_id
      LEFT JOIN listas_precios lp  ON lp.id  = c.lista_precio_id
      LEFT JOIN sucursales suc     ON suc.id = c.sucursal_default_id
      LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
      LEFT JOIN (
        SELECT cliente_id, SUM(monto) AS total_correcciones
          FROM correcciones_saldo_cliente GROUP BY cliente_id
      ) cs_agg ON cs_agg.cliente_id = c.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, ci.nombre, lp.nombre, suc.nombre, cs_agg.total_correcciones
    `, [req.params.id]);

    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ cliente: rows[0] });
  } catch (err) { next(err); }
});

// ─── PUT /api/clientes/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const fields = ['razon_social','cuit','cond_iva_id','telefono','direccion',
                    'sucursal_default_id','lista_precio_id','limite_credito',
                    'descuento_adicional','activo'];
    const updates = [];
    const params  = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f] === '' ? null : req.body[f]);
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE clientes SET ${updates.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'CUIT duplicado' });
    next(err);
  }
});

// ─── GET /api/clientes/:id/movimientos ───────────────────────────────────────
router.get('/:id/movimientos', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const [{ rows: movs }, { rows: corrs }, { rows: cliente }] = await Promise.all([
      pool.query(`
        SELECT id, debe, haber, saldo, fecha, origen_tipo, origen_id
          FROM cuentas_corrientes_cliente
         WHERE cliente_id = $1
         ORDER BY fecha DESC
         LIMIT $2 OFFSET $3
      `, [req.params.id, parseInt(limit), parseInt(offset)]),

      pool.query(`
        SELECT id, monto, motivo, fecha
          FROM correcciones_saldo_cliente
         WHERE cliente_id = $1
         ORDER BY fecha DESC
      `, [req.params.id]),

      pool.query(`
        SELECT saldo_inicial FROM clientes WHERE id = $1
      `, [req.params.id]),
    ]);

    res.json({
      saldo_inicial: parseFloat(cliente[0]?.saldo_inicial || 0),
      movimientos:   movs,
      correcciones:  corrs,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/clientes/:id/pagos ─────────────────────────────────────────────
router.post('/:id/pagos', async (req, res, next) => {
  try {
    const { monto, concepto } = req.body;
    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Saldo actual antes del pago
      const { rows: [saldoRow] } = await client.query(`
        SELECT c.saldo_inicial
               + COALESCE(SUM(cc.debe) - SUM(cc.haber), 0)
               + COALESCE(cs_agg.total_correcciones, 0) AS saldo_actual
          FROM clientes c
          LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
          LEFT JOIN (
            SELECT cliente_id, SUM(monto) AS total_correcciones
              FROM correcciones_saldo_cliente GROUP BY cliente_id
          ) cs_agg ON cs_agg.cliente_id = c.id
         WHERE c.id = $1 AND c.deleted_at IS NULL
         GROUP BY c.id, c.saldo_inicial, cs_agg.total_correcciones
      `, [req.params.id]);

      if (!saldoRow) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      const saldoAntes  = parseFloat(saldoRow.saldo_actual) || 0;
      const montoNum    = parseFloat(monto);
      const saldoDespues = saldoAntes - montoNum;

      const { rows: [mov] } = await client.query(`
        INSERT INTO cuentas_corrientes_cliente
          (cliente_id, debe, haber, saldo, origen_tipo)
        VALUES ($1, 0, $2, $3, 'pago')
        RETURNING id, haber, saldo, fecha
      `, [req.params.id, montoNum, saldoDespues]);

      // Si hay concepto, registrar corrección de texto
      if (concepto?.trim()) {
        await client.query(`
          INSERT INTO correcciones_saldo_cliente (cliente_id, monto, motivo)
          VALUES ($1, 0, $2)
        `, [req.params.id, concepto.trim()]);
      }

      await client.query('COMMIT');
      res.status(201).json({ movimiento: mov, saldo_nuevo: saldoDespues });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

module.exports = router;
