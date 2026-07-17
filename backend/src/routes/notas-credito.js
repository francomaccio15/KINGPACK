const express = require('express');
const { pool } = require('../config/db');
const arca = require('../services/arca');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// ─── Solo admin puede crear / anular ─────────────────────────────────────────
// Lectura abierta a todos los roles autenticados

// SELECT base reutilizable
const SELECT_NC = `
  SELECT
    nc.id,
    nc.numero,
    nc.fecha,
    nc.estado,
    nc.motivo,
    nc.numero_referencia,
    nc.subtotal::float,
    nc.iva_pct::float,
    nc.iva_monto::float,
    nc.total::float,
    nc.forma_devolucion,
    nc.items,
    nc.cae,
    nc.created_at,
    nc.updated_at,
    nc.deleted_at,
    -- Cliente
    c.id           AS cliente_id,
    c.razon_social AS cliente_razon_social,
    c.cuit         AS cliente_cuit,
    c.direccion    AS cliente_direccion,
    ci.nombre      AS cliente_cond_iva,
    -- Tipo comprobante
    tc.descripcion AS tipo_comprobante,
    tc.letra       AS tipo_letra,
    tc.codigo_afip AS tipo_codigo_afip,
    -- Sucursal
    s.nombre        AS sucursal_nombre,
    s.cuit_sucursal AS sucursal_cuit,
    s.direccion     AS sucursal_direccion,
    s.telefono      AS sucursal_telefono,
    -- Emisor (usuario)
    u.nombre       AS emitida_por_nombre,
    -- Facturación original (opcional)
    nc.factura_id,
    f.numero       AS factura_numero,
    f.punto_venta  AS factura_punto_venta
  FROM notas_credito nc
  LEFT JOIN clientes c               ON c.id = nc.cliente_id
  LEFT JOIN cond_iva ci              ON ci.id = c.cond_iva_id
  LEFT JOIN tipos_comprobante tc     ON tc.id = nc.tipo_comprobante_id
  LEFT JOIN sucursales s            ON s.id = nc.sucursal_id
  LEFT JOIN usuarios u              ON u.id = nc.emitida_por
  LEFT JOIN facturaciones f         ON f.id = nc.factura_id
`;

// Helper: calcular saldo actual de un cliente dentro de una transacción
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

// ─── GET /api/notas-credito ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q, estado, cliente_id, fecha_desde, fecha_hasta, limit = '50', offset = '0' } = req.query;

    const conditions = ['nc.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (estado)       { conditions.push(`nc.estado = $${idx++}`);    params.push(estado); }
    if (cliente_id)   { conditions.push(`nc.cliente_id = $${idx++}`); params.push(cliente_id); }
    if (fecha_desde)  { conditions.push(`nc.fecha >= $${idx++}`);    params.push(fecha_desde); }
    if (fecha_hasta)  { conditions.push(`nc.fecha <= $${idx++}`);    params.push(fecha_hasta + ' 23:59:59'); }
    if (q && q.trim()) {
      conditions.push(`(
        c.razon_social ILIKE $${idx}
        OR nc.motivo   ILIKE $${idx}
        OR nc.numero::text ILIKE $${idx}
        OR nc.numero_referencia ILIKE $${idx}
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
        `${SELECT_NC}
         WHERE ${where}
         ORDER BY nc.fecha DESC, nc.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM notas_credito nc
         LEFT JOIN clientes c ON c.id = nc.cliente_id
         WHERE ${where}`,
        countParams
      ),
    ]);

    res.json({ count: parseInt(countRows[0].count), notas: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/notas-credito/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${SELECT_NC} WHERE nc.id = $1 AND nc.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nota de crédito no encontrada' });
    res.json({ nota: rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /api/notas-credito — todos los roles autenticados ──────────────────
// Efectos colaterales (en transacción):
//   1. Restaura stock para ítems con articulo_id (devolución de mercadería)
//   2. Acredita la cuenta corriente del cliente (haber = total → saldo a favor)
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      cliente_id,
      sucursal_id,
      tipo_comprobante_id,
      numero_referencia,
      factura_id = null,
      motivo,
      items = [],
      subtotal,
      iva_pct = 21,
      iva_monto,
      total,
      fecha,
      forma_devolucion = 'cuenta_corriente',
    } = req.body;

    if (!motivo?.trim())           return res.status(400).json({ error: 'El motivo es obligatorio' });
    if (!tipo_comprobante_id)      return res.status(400).json({ error: 'El tipo de comprobante es obligatorio' });
    if (total === undefined || total === null) return res.status(400).json({ error: 'El total es obligatorio' });

    const FORMAS_VALIDAS = ['cuenta_corriente', 'efectivo', 'transferencia'];
    const formaDev = FORMAS_VALIDAS.includes(forma_devolucion) ? forma_devolucion : 'cuenta_corriente';
    const totalNum = parseFloat(total) || 0;

    await client.query('BEGIN');

    // Para efectivo: descontar de la caja abierta de la sucursal (egreso).
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

    // ── Emisión ante ARCA/AFIP: se pide el CAE ANTES de insertar. Si ARCA
    // rechaza o falla, la nota de crédito no se crea (no puede existir sin CAE).
    const { rows: tcRows } = await client.query(
      `SELECT letra, codigo_afip FROM tipos_comprobante WHERE id = $1`,
      [tipo_comprobante_id]
    );
    if (!tcRows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tipo de comprobante inválido' });
    }
    const tipoComp = tcRows[0];

    let cuitDigits = '';
    if (cliente_id) {
      const { rows: clRows } = await client.query('SELECT cuit FROM clientes WHERE id = $1', [cliente_id]);
      cuitDigits = clRows[0]?.cuit ? String(clRows[0].cuit).replace(/\D/g, '') : '';
    }
    if (tipoComp.letra === 'A' && cuitDigits.length !== 11) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La Nota de Crédito A requiere un cliente con CUIT válido' });
    }

    let sucursalNombre = null;
    if (sucursal_id) {
      const { rows: sucRows } = await client.query('SELECT nombre FROM sucursales WHERE id = $1', [sucursal_id]);
      sucursalNombre = sucRows[0]?.nombre || null;
    }

    // Discrimina el IVA por ítem usando la alícuota real del artículo (igual que
    // /api/ventas/:id/facturar); los ítems sin articulo_id asumen 21%.
    const articuloIds = items.filter(it => it.articulo_id).map(it => it.articulo_id);
    let alicuotaPorArticulo = {};
    if (articuloIds.length) {
      const { rows: aliRows } = await client.query(`
        SELECT a.id, COALESCE(ai.porcentaje, 21)::float AS alicuota
          FROM articulos a
          LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
         WHERE a.id = ANY($1::uuid[])
      `, [articuloIds]);
      alicuotaPorArticulo = Object.fromEntries(aliRows.map(r => [r.id, r.alicuota]));
    }

    const gruposIva = {};
    for (const it of items) {
      const importe = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
      const alic = it.articulo_id ? (alicuotaPorArticulo[it.articulo_id] ?? 21) : 21;
      gruposIva[alic] = (gruposIva[alic] || 0) + importe;
    }
    const itemsArca = Object.entries(gruposIva).map(([alic, totalIncl]) => {
      const a = parseFloat(alic);
      return {
        descripcion:    `Neto gravado ${a}%`,
        cantidad:       1,
        precioUnitario: +(totalIncl / (1 + a / 100)).toFixed(2),
        alicuotaIva:    a,
      };
    });

    let resultadoArca;
    try {
      resultadoArca = await arca.generarFactura({
        puntoVenta:      arca.puntoVentaPara(sucursalNombre),
        tipoComprobante: tipoComp.codigo_afip,
        concepto:        arca.CONCEPTO.PRODUCTOS,
        cliente: tipoComp.letra === 'A'
          ? { tipoDoc: arca.TIPO_DOC.CUIT, nroDoc: cuitDigits }
          : { tipoDoc: arca.TIPO_DOC.SIN_IDENTIFICAR, nroDoc: 0 },
        items: itemsArca,
      });
    } catch (arcaErr) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: `ARCA rechazó la nota de crédito: ${arcaErr.message}` });
    }

    // Insertar la nota de crédito (numero = número oficial devuelto por ARCA)
    const { rows } = await client.query(
      `INSERT INTO notas_credito
         (factura_id, cliente_id, sucursal_id, tipo_comprobante_id,
          numero, numero_referencia, motivo, items,
          subtotal, iva_pct, iva_monto, total, estado, emitida_por, fecha, forma_devolucion,
          cae, respuesta_afip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'emitida',$13,$14,$15,$16,$17::jsonb)
       RETURNING id`,
      [
        factura_id || null,
        cliente_id || null,
        sucursal_id || null,
        tipo_comprobante_id,
        resultadoArca.nroComprobante,
        numero_referencia || null,
        motivo.trim(),
        items.length ? JSON.stringify(items) : null,
        parseFloat(subtotal) || 0,
        parseFloat(iva_pct) || 21,
        parseFloat(iva_monto) || 0,
        parseFloat(total) || 0,
        req.usuario.id,
        fecha || new Date().toISOString(),
        formaDev,
        resultadoArca.CAE,
        JSON.stringify(resultadoArca),
      ]
    );
    const ncId = rows[0].id;

    // ── 1. Restaurar stock para ítems con articulo_id ─────────────────────────
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

    // ── 2. Acreditar cuenta corriente del cliente ─────────────────────────────
    // Solo si la devolución es por cuenta corriente. Efectivo/transferencia es
    // una devolución física y no debe mover el saldo del cliente.
    if (cliente_id && totalNum > 0 && formaDev === 'cuenta_corriente') {
      const saldoActual = await getSaldoActual(client, cliente_id);
      // haber = total NC → reduce deuda / genera saldo a favor (saldo negativo)
      const saldoDespues = parseFloat((saldoActual - totalNum).toFixed(2));

      await client.query(
        `INSERT INTO cuentas_corrientes_cliente
           (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
         VALUES ($1, 0, $2, $3, 'nota_credito', $4)`,
        [cliente_id, totalNum, saldoDespues, ncId]
      );
    }

    // ── 3. Egreso de caja (efectivo): descontar la plata devuelta ─────────────
    if (formaDev === 'efectivo' && cajaId && totalNum > 0) {
      const concepto = `Nota de crédito #${resultadoArca.nroComprobante}` +
        (numero_referencia ? ` — ${numero_referencia}` : '');
      await client.query(
        `INSERT INTO movimientos_caja
           (caja_id, tipo, concepto, monto, origen_tipo, origen_id, usuario_id)
         VALUES ($1, 'egreso', $2, $3, 'nota_credito', $4, $5)`,
        [cajaId, concepto, totalNum, ncId, req.usuario.id]
      );
    }

    await client.query('COMMIT');

    // Devolver la nota completa
    const { rows: full } = await pool.query(
      `${SELECT_NC} WHERE nc.id = $1`,
      [ncId]
    );

    res.status(201).json({ nota: full[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── PATCH /api/notas-credito/:id/anular — solo admin ────────────────────────
// Revierte en transacción:
//   1. Descuenta el stock que fue devuelto (vuelve a quitar la mercadería)
//   2. Inserta debe en CC del cliente para cancelar el haber original
router.patch('/:id/anular', requireRol('administrador', 'cajero'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener la NC y marcarla anulada
    const { rows } = await client.query(
      `UPDATE notas_credito
          SET estado = 'anulada', updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL AND estado != 'anulada'
        RETURNING id, numero, numero_referencia, cliente_id, sucursal_id, total, items, forma_devolucion`,
      [req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrada o ya anulada' });
    }
    const nc = rows[0];
    const totalNum = parseFloat(nc.total) || 0;
    const items = nc.items || [];

    // ── 1. Revertir stock (quitar lo que se había devuelto) ───────────────────
    const itemsConArticulo = items.filter(it => it.articulo_id && parseFloat(it.cantidad) > 0);
    if (itemsConArticulo.length > 0 && nc.sucursal_id) {
      for (const item of itemsConArticulo) {
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3::numeric, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET
             cantidad = GREATEST(0, stock.cantidad - $3::numeric),
             ultima_actualizacion = NOW()`,
          [item.articulo_id, nc.sucursal_id, parseFloat(item.cantidad)]
        );
      }
    }

    // ── 2. Revertir CC: insertar debe para cancelar el haber de la NC ─────────
    // Solo si la NC había acreditado por cuenta corriente.
    if (nc.cliente_id && totalNum > 0 && nc.forma_devolucion === 'cuenta_corriente') {
      const saldoActual = await getSaldoActual(client, nc.cliente_id);
      // debe = total NC → revierte el haber; saldo sube (cliente vuelve a deber o pierde el crédito)
      const saldoDespues = parseFloat((saldoActual + totalNum).toFixed(2));

      await client.query(
        `INSERT INTO cuentas_corrientes_cliente
           (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
         VALUES ($1, $2, 0, $3, 'anulacion_nc', $4)`,
        [nc.cliente_id, totalNum, saldoDespues, nc.id]
      );
    }

    // ── 3. Revertir egreso de caja (efectivo) → ingreso compensatorio ─────────
    // Best-effort: si hay caja abierta en la sucursal, devuelve el efectivo.
    if (nc.forma_devolucion === 'efectivo' && nc.sucursal_id && totalNum > 0) {
      const { rows: cajaRows } = await client.query(
        `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
        [nc.sucursal_id]
      );
      if (cajaRows[0]) {
        const concepto = `Anulación nota de crédito #${nc.numero}` +
          (nc.numero_referencia ? ` — ${nc.numero_referencia}` : '');
        await client.query(
          `INSERT INTO movimientos_caja
             (caja_id, tipo, concepto, monto, origen_tipo, origen_id, usuario_id)
           VALUES ($1, 'ingreso', $2, $3, 'anulacion_nc', $4, $5)`,
          [cajaRows[0].id, concepto, totalNum, nc.id, req.usuario.id]
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

// ─── DELETE /api/notas-credito/:id — solo admin (soft delete) ────────────────
router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE notas_credito SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nota de crédito no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
