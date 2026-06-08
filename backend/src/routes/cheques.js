const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

const ESTADOS_RECIBIDO = ['en_cartera', 'depositado', 'acreditado', 'endosado', 'rechazado', 'anulado'];
const ESTADOS_EMITIDO  = ['emitido', 'presentado', 'debitado', 'rechazado', 'anulado'];

// Transiciones válidas
const TRANSICIONES = {
  recibido: {
    en_cartera: ['depositado', 'endosado', 'rechazado', 'anulado'],
    depositado:  ['acreditado', 'rechazado'],
    acreditado:  [],
    endosado:    [],
    rechazado:   ['anulado'],
    anulado:     [],
  },
  emitido: {
    emitido:    ['presentado', 'debitado', 'rechazado', 'anulado'],
    presentado: ['debitado', 'rechazado'],
    debitado:   [],
    rechazado:  ['anulado'],
    anulado:    [],
  },
};

// ─── GET /api/cheques/resumen ─────────────────────────────────────────────────
router.get('/resumen', async (req, res, next) => {
  try {
    const sucId = sucursalEfectiva(req);
    const sucFiltro = sucId ? `AND sucursal_id = $1` : '';
    const params = sucId ? [sucId] : [];
    const hoy = new Date().toISOString().slice(0, 10);

    const sql = `
      SELECT
        -- Recibidos en cartera
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
        ), 0) AS recibidos_en_cartera,

        -- Recibidos por vencer en 7 días
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
            AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        ), 0) AS recibidos_por_vencer_7d,

        -- Recibidos vencidos sin depositar
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
            AND fecha_vencimiento < CURRENT_DATE
        ), 0) AS recibidos_vencidos,

        COUNT(*) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
            AND fecha_vencimiento < CURRENT_DATE
        ) AS recibidos_vencidos_cant,

        -- Recibidos rechazados este mes
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'rechazado'
            AND fecha_estado >= DATE_TRUNC('month', CURRENT_DATE)
        ), 0) AS recibidos_rechazados_mes,

        -- Emitidos comprometidos
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'emitido' AND estado IN ('emitido','presentado')
        ), 0) AS emitidos_comprometidos,

        -- Emitidos a vencer en 7 días
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'emitido' AND estado IN ('emitido','presentado')
            AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        ), 0) AS emitidos_por_vencer_7d,

        -- Emitidos rechazados (crítico)
        COUNT(*) FILTER (
          WHERE tipo = 'emitido' AND estado = 'rechazado'
        ) AS emitidos_rechazados_cant,

        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'emitido' AND estado = 'rechazado'
        ), 0) AS emitidos_rechazados_monto

      FROM vw_cheques
      WHERE 1=1 ${sucFiltro}
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── GET /api/cheques ─────────────────────────────────────────────────────────
// ?tipo=          recibido | emitido
// ?estado=        en_cartera | depositado | …
// ?banco=         texto libre
// ?fecha_venc_desde= ISO date
// ?fecha_venc_hasta= ISO date
// ?limit=         default 100
// ?offset=        default 0
router.get('/', async (req, res, next) => {
  try {
    const {
      tipo, estado, banco,
      fecha_venc_desde, fecha_venc_hasta,
      limit = 100, offset = 0,
    } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    const sucId = sucursalEfectiva(req);
    if (sucId) {
      conditions.push(`sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (tipo && ['recibido','emitido'].includes(tipo)) {
      conditions.push(`tipo = $${idx++}`);
      params.push(tipo);
    }
    if (estado) {
      conditions.push(`estado = $${idx++}`);
      params.push(estado);
    }
    if (banco) {
      conditions.push(`LOWER(banco) LIKE $${idx++}`);
      params.push(`%${banco.toLowerCase()}%`);
    }
    if (fecha_venc_desde) {
      conditions.push(`fecha_vencimiento >= $${idx++}`);
      params.push(fecha_venc_desde);
    }
    if (fecha_venc_hasta) {
      conditions.push(`fecha_vencimiento <= $${idx++}`);
      params.push(fecha_venc_hasta);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          tipo, id, banco, numero_cheque,
          fecha_emision, fecha_vencimiento,
          importe, estado, fecha_estado, observaciones,
          origen_id, origen_tipo, origen_nombre,
          sucursal_id, sucursal_nombre,
          CASE
            WHEN fecha_vencimiento < CURRENT_DATE AND estado NOT IN ('acreditado','debitado','rechazado','anulado')
            THEN true ELSE false
          END AS vencido
        FROM vw_cheques
        ${where}
        ORDER BY fecha_vencimiento ASC, importe DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM vw_cheques ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), cheques: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/cheques/:tipo/:id ───────────────────────────────────────────────
router.get('/:tipo/:id', async (req, res, next) => {
  try {
    const { tipo, id } = req.params;
    if (!['recibido','emitido'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser recibido o emitido' });
    }

    const [{ rows: chequeRows }, { rows: historialRows }] = await Promise.all([
      pool.query(
        `SELECT *, CASE
            WHEN fecha_vencimiento < CURRENT_DATE AND estado NOT IN ('acreditado','debitado','rechazado','anulado')
            THEN true ELSE false
         END AS vencido
         FROM vw_cheques WHERE tipo = $1 AND id = $2`,
        [tipo, id]
      ),
      pool.query(
        `SELECT h.*, u.nombre AS usuario_nombre
         FROM cheque_historial_estados h
         LEFT JOIN usuarios u ON u.id = h.usuario_id
         WHERE h.cheque_tipo = $1 AND h.cheque_id = $2
         ORDER BY h.created_at DESC`,
        [tipo, id]
      ),
    ]);

    if (chequeRows.length === 0) return res.status(404).json({ error: 'Cheque no encontrado' });
    res.json({ cheque: chequeRows[0], historial: historialRows });
  } catch (err) { next(err); }
});

// ─── PATCH /api/cheques/:tipo/:id/estado ──────────────────────────────────────
// Body: { estado_nuevo, observacion, fecha_estado }
router.patch('/:tipo/:id/estado', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { tipo, id } = req.params;
    const { estado_nuevo, observacion, fecha_estado } = req.body;

    if (!['recibido','emitido'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser recibido o emitido' });
    }

    const estadosValidos = tipo === 'recibido' ? ESTADOS_RECIBIDO : ESTADOS_EMITIDO;
    if (!estadosValidos.includes(estado_nuevo)) {
      return res.status(400).json({ error: `Estado inválido: ${estado_nuevo}` });
    }

    await client.query('BEGIN');

    // Obtener estado actual
    const tabla = tipo === 'recibido' ? 'venta_cheques' : 'egreso_cheques';
    const { rows: actual } = await client.query(
      `SELECT id, estado FROM ${tabla} WHERE id = $1`,
      [id]
    );
    if (actual.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cheque no encontrado' });
    }

    const estadoActual = actual[0].estado;

    // Verificar transición válida
    const transicionesValidas = TRANSICIONES[tipo][estadoActual] || [];
    if (!transicionesValidas.includes(estado_nuevo)) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: `Transición inválida: ${estadoActual} → ${estado_nuevo}`,
        transiciones_validas: transicionesValidas,
      });
    }

    const fechaEstado = fecha_estado || new Date().toISOString().slice(0, 10);
    const usuario_id = req.usuario?.id ?? null;

    // Actualizar estado
    await client.query(
      `UPDATE ${tabla}
       SET estado = $1, fecha_estado = $2, observaciones = COALESCE($3, observaciones)
       WHERE id = $4`,
      [estado_nuevo, fechaEstado, observacion || null, id]
    );

    // Registrar en historial
    await client.query(
      `INSERT INTO cheque_historial_estados
         (cheque_tipo, cheque_id, estado_anterior, estado_nuevo, observacion, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tipo, id, estadoActual, estado_nuevo, observacion || null, usuario_id]
    );

    // ── Efecto en Caja ─────────────────────────────────────────────────────────
    // Cheque RECIBIDO rechazado → reversal en caja (el ingreso original queda anulado)
    if (tipo === 'recibido' && estado_nuevo === 'rechazado') {
      const { rows: chequeInfo } = await client.query(`
        SELECT vc.banco, vc.numero_cheque, vc.importe,
               v.numero AS venta_numero, v.sucursal_id,
               cl.razon_social AS cliente_nombre
          FROM venta_cheques vc
          JOIN ventas v    ON v.id  = vc.venta_id
          LEFT JOIN clientes cl ON cl.id = v.cliente_id
         WHERE vc.id = $1
      `, [id]);

      if (chequeInfo[0]) {
        const ch = chequeInfo[0];
        const { rows: cajaRows } = await client.query(
          `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
          [ch.sucursal_id]
        );
        if (cajaRows[0]) {
          const motivo = observacion?.trim()
            ? ` (${observacion.trim()})`
            : '';
          await client.query(`
            INSERT INTO movimientos_caja (caja_id, tipo, concepto, monto, medio_pago_id)
            SELECT $1, 'egreso',
                   $2,
                   $3,
                   mp.id
              FROM medios_pago mp
             WHERE LOWER(mp.nombre) LIKE '%cheque%' LIMIT 1
          `, [
            cajaRows[0].id,
            `Cheque rechazado — ${ch.banco} #${ch.numero_cheque} — ${ch.cliente_nombre ?? 'Cliente'}${motivo} [Venta #${ch.venta_numero}]`,
            parseFloat(ch.importe),
          ]);
        }
      }
    }

    // Cheque RECIBIDO acreditado → confirmar ingreso en caja (en caso de no haber sido registrado al crear la venta)
    if (tipo === 'recibido' && estado_nuevo === 'acreditado') {
      const { rows: chequeInfo } = await client.query(`
        SELECT vc.banco, vc.numero_cheque, vc.importe,
               v.numero AS venta_numero, v.sucursal_id,
               cl.razon_social AS cliente_nombre
          FROM venta_cheques vc
          JOIN ventas v    ON v.id  = vc.venta_id
          LEFT JOIN clientes cl ON cl.id = v.cliente_id
         WHERE vc.id = $1
      `, [id]);

      if (chequeInfo[0]) {
        const ch = chequeInfo[0];
        // Solo registrar si hay caja abierta Y no existe ya un movimiento positivo para esta venta
        const { rows: cajaRows } = await client.query(
          `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
          [ch.sucursal_id]
        );
        if (cajaRows[0]) {
          const conceptoVenta = `Venta #${ch.venta_numero}`;
          const { rows: yaExiste } = await client.query(
            `SELECT id FROM movimientos_caja
              WHERE caja_id = $1 AND tipo = 'venta' AND concepto = $2 LIMIT 1`,
            [cajaRows[0].id, conceptoVenta]
          );
          // Registrar movimiento de acreditación del cheque (separado de la venta)
          await client.query(`
            INSERT INTO movimientos_caja (caja_id, tipo, concepto, monto, medio_pago_id)
            SELECT $1, 'ingreso',
                   $2,
                   $3,
                   mp.id
              FROM medios_pago mp
             WHERE LOWER(mp.nombre) LIKE '%cheque%' LIMIT 1
          `, [
            cajaRows[0].id,
            `Cheque acreditado — ${ch.banco} #${ch.numero_cheque} — ${ch.cliente_nombre ?? 'Cliente'} [Venta #${ch.venta_numero}]`,
            parseFloat(ch.importe),
          ]);
        }
      }
    }

    await client.query('COMMIT');

    res.json({ ok: true, estado_anterior: estadoActual, estado_nuevo });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/cheques/por-cliente ─────────────────────────────────────────────
// Cheques recibidos agrupados por cliente con detalle
router.get('/por-cliente', async (req, res, next) => {
  try {
    const { estado, banco } = req.query;
    const sucId = sucursalEfectiva(req);

    const conditions = [`v.deleted_at IS NULL`];
    const params = [];
    let idx = 1;

    if (sucId) {
      conditions.push(`v.sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (estado) {
      conditions.push(`vc.estado = $${idx++}`);
      params.push(estado);
    }
    if (banco) {
      conditions.push(`LOWER(vc.banco) LIKE $${idx++}`);
      params.push(`%${banco.toLowerCase()}%`);
    }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        cl.id            AS cliente_id,
        cl.razon_social  AS cliente_nombre,
        cl.telefono      AS cliente_telefono,
        COUNT(vc.id)     AS cantidad,
        COALESCE(SUM(vc.importe), 0)                                                  AS total,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'en_cartera'),  0)         AS en_cartera,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'depositado'),  0)         AS depositado,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'acreditado'),  0)         AS acreditado,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'rechazado'),   0)         AS rechazado,
        COUNT(vc.id)     FILTER (WHERE vc.estado = 'rechazado')                       AS rechazado_cant,
        COUNT(vc.id)     FILTER (WHERE vc.fecha_vencimiento < CURRENT_DATE
                                   AND vc.estado NOT IN ('acreditado','rechazado','anulado')) AS vencidos_cant,
        json_agg(
          json_build_object(
            'id',                vc.id,
            'banco',             vc.banco,
            'numero_cheque',     vc.numero_cheque,
            'fecha_emision',     vc.fecha_emision,
            'fecha_vencimiento', vc.fecha_vencimiento,
            'importe',           vc.importe,
            'estado',            vc.estado,
            'fecha_estado',      vc.fecha_estado,
            'venta_numero',      v.numero,
            'venta_id',          v.id,
            'vencido',           (vc.fecha_vencimiento < CURRENT_DATE AND vc.estado NOT IN ('acreditado','rechazado','anulado'))
          ) ORDER BY vc.fecha_vencimiento ASC
        ) AS cheques
      FROM venta_cheques vc
      JOIN ventas   v  ON v.id  = vc.venta_id
      JOIN clientes cl ON cl.id = v.cliente_id
      WHERE ${where}
      GROUP BY cl.id, cl.razon_social, cl.telefono
      ORDER BY SUM(vc.importe) FILTER (WHERE vc.estado IN ('en_cartera','depositado')) DESC NULLS LAST,
               cl.razon_social
    `, params);

    res.json({ clientes: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/cheques/emitidos-resumen ────────────────────────────────────────
// Cheques emitidos por proveedor + nro factura, con columnas por mes
router.get('/emitidos-resumen', async (req, res, next) => {
  try {
    const { meses = 6 } = req.query;
    const sucId = sucursalEfectiva(req);

    const conditions = [`ec.estado NOT IN ('anulado')`];
    const params = [];
    let idx = 1;

    if (sucId) {
      conditions.push(`e.sucursal_id = $${idx++}`);
      params.push(sucId);
    }

    const where = conditions.join(' AND ');

    // Cheques emitidos con info del proveedor y egreso
    const { rows } = await pool.query(`
      SELECT
        COALESCE(pr.razon_social, 'Sin proveedor')  AS proveedor_nombre,
        pr.id                                        AS proveedor_id,
        e.numero_comprobante                         AS nro_factura,
        e.id                                         AS egreso_id,
        ec.id                                        AS cheque_id,
        ec.banco,
        ec.numero_cheque,
        ec.fecha_emision,
        ec.fecha_vencimiento,
        ec.importe,
        ec.estado,
        ec.fecha_estado,
        DATE_TRUNC('month', ec.fecha_vencimiento)    AS mes_venc,
        s.nombre                                     AS sucursal_nombre
      FROM egreso_cheques ec
      JOIN egreso_pagos   ep ON ep.id  = ec.egreso_pago_id
      JOIN egresos        e  ON e.id   = ep.egreso_id
      LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
      JOIN sucursales     s  ON s.id   = e.sucursal_id
      WHERE ${where}
        AND ec.fecha_vencimiento >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
        AND ec.fecha_vencimiento <  DATE_TRUNC('month', CURRENT_DATE) + (${parseInt(meses) || 6} || ' months')::INTERVAL
      ORDER BY ec.fecha_vencimiento ASC, pr.razon_social
    `, params);

    // Extraer meses únicos presentes
    const mesesSet = new Set(rows.map(r => r.mes_venc?.toISOString?.().slice(0, 7) ?? ''));
    const mesesOrdenados = [...mesesSet].filter(Boolean).sort();

    res.json({ cheques: rows, meses: mesesOrdenados });
  } catch (err) { next(err); }
});

module.exports = router;
