const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// Devolución de mercadería — documento NO fiscal para ventas sin factura.
// Lectura: todos los roles autenticados. Anular/eliminar: solo admin.

const SELECT_DEV = `
  SELECT
    d.id,
    d.numero,
    d.fecha,
    d.estado,
    d.motivo,
    d.numero_referencia,
    d.subtotal::float,
    d.total::float,
    d.forma_devolucion,
    d.items,
    d.created_at,
    d.updated_at,
    d.deleted_at,
    c.id           AS cliente_id,
    c.razon_social AS cliente_razon_social,
    c.cuit         AS cliente_cuit,
    c.direccion    AS cliente_direccion,
    s.nombre        AS sucursal_nombre,
    s.cuit_sucursal AS sucursal_cuit,
    s.direccion     AS sucursal_direccion,
    s.telefono      AS sucursal_telefono,
    u.nombre       AS emitida_por_nombre
  FROM devoluciones_mercaderia d
  LEFT JOIN clientes c    ON c.id = d.cliente_id
  LEFT JOIN sucursales s  ON s.id = d.sucursal_id
  LEFT JOIN usuarios u    ON u.id = d.emitida_por
`;

// Saldo actual del cliente dentro de una transacción
async function getSaldoActual(client, clienteId) {
  const { rows } = await client.query(`
    SELECT
      c.saldo_inicial
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
  `, [clienteId]);
  return parseFloat(rows[0]?.saldo_actual ?? '0');
}

// ─── GET /api/devoluciones ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q, estado, cliente_id, fecha_desde, fecha_hasta, limit = '50', offset = '0' } = req.query;

    const conditions = ['d.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (estado)      { conditions.push(`d.estado = $${idx++}`);     params.push(estado); }
    if (cliente_id)  { conditions.push(`d.cliente_id = $${idx++}`); params.push(cliente_id); }
    if (fecha_desde) { conditions.push(`d.fecha >= $${idx++}`);     params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`d.fecha <= $${idx++}`);     params.push(fecha_hasta + ' 23:59:59'); }
    if (q && q.trim()) {
      conditions.push(`(
        c.razon_social ILIKE $${idx}
        OR d.motivo ILIKE $${idx}
        OR d.numero::text ILIKE $${idx}
        OR d.numero_referencia ILIKE $${idx}
      )`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];

    params.push(Math.min(parseInt(limit) || 50, 200));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `${SELECT_DEV}
         WHERE ${where}
         ORDER BY d.fecha DESC, d.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM devoluciones_mercaderia d
         LEFT JOIN clientes c ON c.id = d.cliente_id
         WHERE ${where}`,
        countParams
      ),
    ]);

    res.json({ count: parseInt(countRows[0].count), devoluciones: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/devoluciones/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_DEV} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Devolución no encontrada' });
    res.json({ devolucion: rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /api/devoluciones — todos los roles autenticados ───────────────────
// Efectos colaterales (en transacción), según la forma de devolución:
//   - Siempre: restaura el stock de los ítems con articulo_id.
//   - cuenta_corriente: acredita el total al cliente (haber → saldo a favor).
//   - efectivo: registra un egreso en la caja abierta de la sucursal.
//   - transferencia: no mueve caja ni cuenta corriente (salida bancaria).
//   - cambio: solo restaura stock (sin devolución de dinero).
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      cliente_id,
      sucursal_id,
      numero_referencia,
      motivo,
      items = [],
      subtotal,
      total,
      fecha,
      forma_devolucion = 'efectivo',
    } = req.body;

    if (!motivo?.trim())                       return res.status(400).json({ error: 'El motivo es obligatorio' });
    if (total === undefined || total === null) return res.status(400).json({ error: 'El total es obligatorio' });

    const FORMAS_VALIDAS = ['efectivo', 'cuenta_corriente', 'transferencia', 'cambio'];
    const formaDev = FORMAS_VALIDAS.includes(forma_devolucion) ? forma_devolucion : 'efectivo';
    const totalNum = parseFloat(total) || 0;

    // Validaciones por forma
    if (formaDev === 'cuenta_corriente' && !cliente_id) {
      return res.status(400).json({ error: 'Se requiere un cliente para devolver a cuenta corriente' });
    }

    await client.query('BEGIN');

    // Para efectivo: necesitamos la caja abierta de la sucursal
    let cajaId = null;
    if (formaDev === 'efectivo' && totalNum > 0) {
      if (!sucursal_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Se requiere la sucursal para devolver en efectivo' });
      }
      const { rows: cajaRows } = await client.query(
        `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
        [sucursal_id]
      );
      if (!cajaRows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'La caja está cerrada. Abrí la caja para devolver en efectivo.' });
      }
      cajaId = cajaRows[0].id;
    }

    // Número correlativo global
    const { rows: lastNum } = await client.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS next_num
         FROM devoluciones_mercaderia WHERE deleted_at IS NULL`
    );
    const numero = lastNum[0].next_num;

    const { rows } = await client.query(
      `INSERT INTO devoluciones_mercaderia
         (numero, cliente_id, sucursal_id, numero_referencia, motivo, items,
          subtotal, total, estado, forma_devolucion, emitida_por, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'emitida',$9,$10,$11)
       RETURNING id`,
      [
        numero,
        cliente_id || null,
        sucursal_id || null,
        numero_referencia || null,
        motivo.trim(),
        items.length ? JSON.stringify(items) : null,
        parseFloat(subtotal) || 0,
        totalNum,
        formaDev,
        req.usuario.id,
        fecha || new Date().toISOString(),
      ]
    );
    const devId = rows[0].id;

    // ── 1. Restaurar stock ────────────────────────────────────────────────────
    const itemsConArticulo = items.filter(it => it.articulo_id && parseFloat(it.cantidad) > 0);
    if (itemsConArticulo.length > 0 && sucursal_id) {
      for (const item of itemsConArticulo) {
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3::numeric, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET
             cantidad = GREATEST(0, stock.cantidad + $3::numeric),
             ultima_actualizacion = NOW()`,
          [item.articulo_id, sucursal_id, parseFloat(item.cantidad)]
        );
      }
    }

    // ── 2. Cuenta corriente (saldo a favor) ───────────────────────────────────
    if (formaDev === 'cuenta_corriente' && cliente_id && totalNum > 0) {
      const saldoActual  = await getSaldoActual(client, cliente_id);
      const saldoDespues = parseFloat((saldoActual - totalNum).toFixed(2));
      await client.query(
        `INSERT INTO cuentas_corrientes_cliente
           (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
         VALUES ($1, 0, $2, $3, 'devolucion', $4)`,
        [cliente_id, totalNum, saldoDespues, devId]
      );
    }

    // ── 3. Egreso de caja (efectivo) ──────────────────────────────────────────
    if (formaDev === 'efectivo' && cajaId && totalNum > 0) {
      const concepto = `Devolución mercadería #${numero}` +
        (numero_referencia ? ` — ${numero_referencia}` : '');
      await client.query(
        `INSERT INTO movimientos_caja
           (caja_id, tipo, concepto, monto, origen_tipo, origen_id, usuario_id)
         VALUES ($1, 'egreso', $2, $3, 'devolucion', $4, $5)`,
        [cajaId, concepto, totalNum, devId, req.usuario.id]
      );
    }

    await client.query('COMMIT');

    const { rows: full } = await pool.query(`${SELECT_DEV} WHERE d.id = $1`, [devId]);
    res.status(201).json({ devolucion: full[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/devoluciones/:id/anular — solo admin ─────────────────────────
// Revierte: quita el stock devuelto, cancela el saldo a favor (CC) y, si fue en
// efectivo, registra un ingreso compensatorio en la caja abierta (best-effort).
router.patch('/:id/anular', requireRol('administrador'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE devoluciones_mercaderia
          SET estado = 'anulada', updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL AND estado != 'anulada'
        RETURNING id, numero, cliente_id, sucursal_id, total, items, forma_devolucion, numero_referencia`,
      [req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrada o ya anulada' });
    }
    const dev = rows[0];
    const totalNum = parseFloat(dev.total) || 0;
    const items = dev.items || [];

    // ── 1. Revertir stock (quitar lo que se había devuelto) ───────────────────
    const itemsConArticulo = items.filter(it => it.articulo_id && parseFloat(it.cantidad) > 0);
    if (itemsConArticulo.length > 0 && dev.sucursal_id) {
      for (const item of itemsConArticulo) {
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3::numeric, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET
             cantidad = GREATEST(0, stock.cantidad - $3::numeric),
             ultima_actualizacion = NOW()`,
          [item.articulo_id, dev.sucursal_id, parseFloat(item.cantidad)]
        );
      }
    }

    // ── 2. Revertir cuenta corriente ──────────────────────────────────────────
    if (dev.forma_devolucion === 'cuenta_corriente' && dev.cliente_id && totalNum > 0) {
      const saldoActual  = await getSaldoActual(client, dev.cliente_id);
      const saldoDespues = parseFloat((saldoActual + totalNum).toFixed(2));
      await client.query(
        `INSERT INTO cuentas_corrientes_cliente
           (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
         VALUES ($1, $2, 0, $3, 'anulacion_devolucion', $4)`,
        [dev.cliente_id, totalNum, saldoDespues, dev.id]
      );
    }

    // ── 3. Revertir egreso de caja (efectivo) → ingreso compensatorio ─────────
    // Best-effort: si hay una caja abierta en la sucursal, devuelve el efectivo.
    if (dev.forma_devolucion === 'efectivo' && dev.sucursal_id && totalNum > 0) {
      const { rows: cajaRows } = await client.query(
        `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
        [dev.sucursal_id]
      );
      if (cajaRows[0]) {
        const concepto = `Anulación devolución #${dev.numero}` +
          (dev.numero_referencia ? ` — ${dev.numero_referencia}` : '');
        await client.query(
          `INSERT INTO movimientos_caja
             (caja_id, tipo, concepto, monto, origen_tipo, origen_id, usuario_id)
           VALUES ($1, 'ingreso', $2, $3, 'anulacion_devolucion', $4, $5)`,
          [cajaRows[0].id, concepto, totalNum, dev.id, req.usuario.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── DELETE /api/devoluciones/:id — solo admin (soft delete) ─────────────────
router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE devoluciones_mercaderia SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Devolución no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
