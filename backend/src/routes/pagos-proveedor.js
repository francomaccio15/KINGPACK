const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');
const {
  registrarMovimientosDeMedios,
  revertirMovimientosBancarios,
} = require('../services/movimientos-bancarios');

const router = express.Router();

// Todo el módulo es exclusivo del administrador.
router.use(requireRol('administrador'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Saldo de movimientos (Σ debe − Σ haber) SIN el saldo inicial del proveedor,
// igual criterio que el resto del sistema (el saldo inicial se suma aparte).
async function saldoMovimientos(client, proveedorId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
       FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`,
    [proveedorId]
  );
  return parseFloat(rows[0].saldo) || 0;
}

// ─── GET /api/pagos-proveedor ─────────────────────────────────────────────────
// ?proveedor_id=  ?fecha_desde=  ?fecha_hasta=  ?incluir_anulados=true
router.get('/', async (req, res, next) => {
  try {
    const { proveedor_id, fecha_desde, fecha_hasta, incluir_anulados, limit = 100, offset = 0 } = req.query;

    const cond = [];
    const params = [];
    let idx = 1;

    if (proveedor_id) { cond.push(`pp.proveedor_id = $${idx++}`); params.push(proveedor_id); }
    if (fecha_desde)  { cond.push(`pp.fecha >= $${idx++}`);       params.push(fecha_desde); }
    if (fecha_hasta)  { cond.push(`pp.fecha <= $${idx++}`);       params.push(fecha_hasta); }
    if (incluir_anulados !== 'true') cond.push(`pp.anulado = FALSE`);

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const { rows } = await pool.query(`
      SELECT pp.id, pp.proveedor_id, pp.fecha, pp.monto, pp.observaciones,
             pp.anulado, pp.motivo_anulacion, pp.created_at,
             p.razon_social AS proveedor_nombre,
             COALESCE(
               (SELECT string_agg(DISTINCT mp2.nombre, ' + ')
                  FROM pago_proveedor_medios m JOIN medios_pago mp2 ON mp2.id = m.medio_pago_id
                 WHERE m.pago_proveedor_id = pp.id),
               mp.nombre
             ) AS medio_pago_nombre,
             s.nombre  AS sucursal_nombre,
             u.nombre  AS usuario_nombre,
             (SELECT COUNT(*) FROM pago_proveedor_aplicaciones a WHERE a.pago_proveedor_id = pp.id) AS aplicaciones_count
        FROM pagos_proveedor pp
        JOIN proveedores p   ON p.id  = pp.proveedor_id
        JOIN medios_pago mp  ON mp.id = pp.medio_pago_id
        LEFT JOIN sucursales s ON s.id = pp.sucursal_id
        LEFT JOIN usuarios u   ON u.id = pp.usuario_id
        ${where}
       ORDER BY pp.fecha DESC, pp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    res.json({ count: rows.length, pagos: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/pagos-proveedor/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [{ rows: cab }, { rows: aplic }, { rows: cheques }] = await Promise.all([
      pool.query(`
        SELECT pp.*, p.razon_social AS proveedor_nombre,
               mp.nombre AS medio_pago_nombre, s.nombre AS sucursal_nombre
          FROM pagos_proveedor pp
          JOIN proveedores p  ON p.id  = pp.proveedor_id
          JOIN medios_pago mp ON mp.id = pp.medio_pago_id
          LEFT JOIN sucursales s ON s.id = pp.sucursal_id
         WHERE pp.id = $1`, [id]),
      pool.query(`
        SELECT a.id, a.egreso_id, a.monto_aplicado,
               e.descripcion, e.tipo_comprobante, e.punto_venta, e.numero_comprobante,
               e.total AS egreso_total, e.estado_pago
          FROM pago_proveedor_aplicaciones a
          JOIN egresos e ON e.id = a.egreso_id
         WHERE a.pago_proveedor_id = $1`, [id]),
      pool.query(`SELECT * FROM pago_proveedor_cheques WHERE pago_proveedor_id = $1`, [id]),
    ]);

    if (!cab[0]) return res.status(404).json({ error: 'Pago no encontrado' });

    const { rows: medios } = await pool.query(`
      SELECT m.medio_pago_id, m.monto, m.cuenta_bancaria_id, mp.nombre AS medio_nombre
        FROM pago_proveedor_medios m JOIN medios_pago mp ON mp.id = m.medio_pago_id
       WHERE m.pago_proveedor_id = $1`, [id]);

    res.json({ pago: cab[0], aplicaciones: aplic, cheques, medios });
  } catch (err) { next(err); }
});

// ─── POST /api/pagos-proveedor ────────────────────────────────────────────────
// Body:
//   proveedor_id (req), medio_pago_id (req), monto (req), fecha?,
//   cuenta_bancaria_id?, sucursal_id?, observaciones?, facturado? (pago a cuenta),
//   aplicaciones?: [{ egreso_id, monto }]   → modo "aplicado a comprobantes"
//   cheques?: [{ banco, numero_cheque, fecha_vencimiento, importe }]
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      proveedor_id, medio_pago_id, monto, fecha,
      cuenta_bancaria_id, sucursal_id, observaciones, facturado = false,
      aplicaciones = [], cheques = [], medios,
    } = req.body;

    if (!proveedor_id)  return res.status(400).json({ error: 'proveedor_id es requerido' });
    const montoTotal = parseFloat(monto);
    if (!montoTotal || montoTotal <= 0) return res.status(400).json({ error: 'monto debe ser mayor a 0' });

    const { rows: provRows } = await client.query(
      `SELECT id FROM proveedores WHERE id = $1 AND deleted_at IS NULL`, [proveedor_id]
    );
    if (!provRows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });

    // ── Medios de pago (uno o varios: pago dividido) ────────────────────────────
    // Compatibilidad: si no viene `medios`, se arma con el medio único clásico.
    const mediosLista = (Array.isArray(medios) && medios.length > 0)
      ? medios.map(m => ({
          medio_pago_id: m.medio_pago_id,
          monto: parseFloat(m.monto),
          cuenta_bancaria_id: m.cuenta_bancaria_id || null,
        }))
      : (medio_pago_id
          ? [{ medio_pago_id, monto: montoTotal, cuenta_bancaria_id: cuenta_bancaria_id || null }]
          : []);

    if (mediosLista.length === 0) return res.status(400).json({ error: 'Indicá al menos un medio de pago' });
    for (const m of mediosLista) {
      if (!m.medio_pago_id) return res.status(400).json({ error: 'Falta el medio de pago en una de las líneas' });
      if (!m.monto || m.monto <= 0) return res.status(400).json({ error: 'El monto de cada medio debe ser mayor a 0' });
    }
    const sumaMedios = mediosLista.reduce((s, m) => s + m.monto, 0);
    if (Math.abs(sumaMedios - montoTotal) > 0.01) {
      return res.status(400).json({
        error: `La suma de los medios (${sumaMedios.toFixed(2)}) no coincide con el total a pagar (${montoTotal.toFixed(2)})`,
      });
    }

    // Nombres de los medios elegidos (para detectar cheque)
    const { rows: mpRows } = await client.query(
      `SELECT id, nombre, caja_fuerte_sucursal_id FROM medios_pago WHERE id = ANY($1::uuid[])`,
      [mediosLista.map(m => m.medio_pago_id)]
    );
    const nombreMedio = Object.fromEntries(mpRows.map(r => [r.id, r.nombre]));
    const cfSucursalMedio = Object.fromEntries(mpRows.map(r => [r.id, r.caja_fuerte_sucursal_id]));
    const esChq = (mid) => /cheque/i.test(nombreMedio[mid] || '');

    const aplicar = Array.isArray(aplicaciones) && aplicaciones.length > 0;

    // En modo "aplicado", la suma imputada debe igualar el monto del pago.
    if (aplicar) {
      const sumaAplic = aplicaciones.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
      if (Math.abs(sumaAplic - montoTotal) > 0.01) {
        return res.status(400).json({
          error: `La suma imputada (${sumaAplic.toFixed(2)}) no coincide con el monto del pago (${montoTotal.toFixed(2)})`,
        });
      }
    }

    // El detalle de cheques debe igualar el importe abonado en cheque.
    const sumaChequeMedios = mediosLista.filter(m => esChq(m.medio_pago_id)).reduce((s, m) => s + m.monto, 0);
    const sumaCheques = (cheques || []).reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
    if (sumaChequeMedios > 0 && Math.abs(sumaCheques - sumaChequeMedios) > 0.01) {
      return res.status(400).json({
        error: `El detalle de cheques (${sumaCheques.toFixed(2)}) no coincide con el importe abonado en cheque (${sumaChequeMedios.toFixed(2)})`,
      });
    }

    const primaryMedioId = mediosLista[0].medio_pago_id;
    const primaryCuenta  = mediosLista[0].cuenta_bancaria_id;
    const usuarioId = req.usuario?.id ?? null;

    await client.query('BEGIN');

    // 1) Cabecera del pago (medio_pago_id = medio primario, para compatibilidad)
    const { rows: pagoRows } = await client.query(`
      INSERT INTO pagos_proveedor
        (proveedor_id, fecha, medio_pago_id, monto, cuenta_bancaria_id,
         sucursal_id, observaciones, facturado, usuario_id)
      VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, fecha, monto
    `, [proveedor_id, fecha || null, primaryMedioId, montoTotal,
        primaryCuenta, sucursal_id || null,
        observaciones?.trim() || null, !!facturado, usuarioId]);
    const pago = pagoRows[0];

    // 1b) Líneas de medios de pago (pago dividido)
    for (const m of mediosLista) {
      await client.query(`
        INSERT INTO pago_proveedor_medios (pago_proveedor_id, medio_pago_id, monto, cuenta_bancaria_id)
        VALUES ($1, $2, $3, $4)
      `, [pago.id, m.medio_pago_id, m.monto, m.cuenta_bancaria_id]);
    }

    // 1c) Si alguna línea se pagó con "Efectivo Caja Fuerte", descontar de la
    //     caja fuerte correspondiente (la del medio; fallback a la del pago).
    const cfPorSucursal = new Map();
    for (const m of mediosLista) {
      if (!/caja fuerte/i.test(nombreMedio[m.medio_pago_id] || '')) continue;
      const suc = cfSucursalMedio[m.medio_pago_id] || sucursal_id;
      if (!suc) continue;
      cfPorSucursal.set(suc, (cfPorSucursal.get(suc) || 0) + (parseFloat(m.monto) || 0));
    }
    for (const [suc, monto] of cfPorSucursal) {
      if (monto > 0) {
        await client.query(
          `UPDATE caja_fuerte SET saldo = saldo - $1, updated_at = NOW() WHERE sucursal_id = $2`,
          [monto.toFixed(2), suc]
        );
      }
    }

    // 1d) Las líneas pagadas desde una cuenta bancaria (Transferencia) se
    //     descuentan de esa cuenta y quedan asentadas en el ledger.
    await registrarMovimientosDeMedios(client, mediosLista, {
      tipo: 'egreso',
      concepto: 'Pago a proveedor',
      origen_tipo: 'pago_proveedor',
      origen_id: pago.id,
      usuario_id: usuarioId,
      fecha: pago.fecha,
    });

    if (aplicar) {
      // 2a) Imputación a cada egreso pendiente
      for (const ap of aplicaciones) {
        const montoAp = parseFloat(ap.monto);
        if (!montoAp || montoAp <= 0) throw Object.assign(new Error('monto de imputación inválido'), { status: 400 });

        const { rows: egRows } = await client.query(
          `SELECT id, total, estado_pago, tipo_comprobante, proveedor_id
             FROM egresos WHERE id = $1 AND deleted_at IS NULL`, [ap.egreso_id]
        );
        const egreso = egRows[0];
        if (!egreso) throw Object.assign(new Error('Egreso no encontrado'), { status: 404 });
        if (egreso.proveedor_id !== proveedor_id) {
          throw Object.assign(new Error('Un comprobante no pertenece al proveedor'), { status: 400 });
        }
        if (egreso.estado_pago === 'pagado') {
          throw Object.assign(new Error('Un comprobante seleccionado ya está pagado'), { status: 400 });
        }

        const { rows: pagadoRows } = await client.query(
          `SELECT COALESCE(SUM(monto), 0) AS pagado FROM egreso_pagos WHERE egreso_id = $1`, [ap.egreso_id]
        );
        const pendiente = +(parseFloat(egreso.total) - parseFloat(pagadoRows[0].pagado)).toFixed(2);
        if (montoAp - pendiente > 0.01) {
          throw Object.assign(new Error(`La imputación (${montoAp.toFixed(2)}) supera el saldo pendiente del comprobante (${pendiente.toFixed(2)})`), { status: 400 });
        }

        // Registro de pago del egreso (mantiene el detalle en "Ver egreso").
        // En pagos divididos se usa el medio primario a nivel comprobante; el
        // desglose fino por medio queda en pago_proveedor_medios.
        await client.query(`
          INSERT INTO egreso_pagos
            (egreso_id, medio_pago_id, monto, cuenta_bancaria_id, observaciones, pago_proveedor_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [ap.egreso_id, primaryMedioId, montoAp, primaryCuenta,
            observaciones?.trim() || null, pago.id]);

        // Nuevo estado del egreso
        const nuevoPagado = +(parseFloat(pagadoRows[0].pagado) + montoAp).toFixed(2);
        const nuevoEstado = Math.abs(nuevoPagado - parseFloat(egreso.total)) <= 0.01 ? 'pagado' : 'parcial';
        await client.query(
          `UPDATE egresos SET estado_pago = $1, updated_at = NOW() WHERE id = $2`,
          [nuevoEstado, ap.egreso_id]
        );

        // Haber en cuenta corriente (facturado según el comprobante)
        const esFacturado = !!(egreso.tipo_comprobante && egreso.tipo_comprobante !== 'informal');
        const saldoPrev = await saldoMovimientos(client, proveedor_id);
        await client.query(`
          INSERT INTO cuentas_corrientes_proveedor
            (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
          VALUES ($1, 0, $2, $3, 'pago', $4, $5, $6)
        `, [proveedor_id, montoAp, +(saldoPrev - montoAp).toFixed(2), ap.egreso_id,
            'Pago a proveedor', esFacturado]);

        // Registro de la imputación
        await client.query(`
          INSERT INTO pago_proveedor_aplicaciones (pago_proveedor_id, egreso_id, monto_aplicado)
          VALUES ($1, $2, $3)
        `, [pago.id, ap.egreso_id, montoAp]);
      }
    } else {
      // 2b) Pago a cuenta: un único haber global
      const saldoPrev = await saldoMovimientos(client, proveedor_id);
      await client.query(`
        INSERT INTO cuentas_corrientes_proveedor
          (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
        VALUES ($1, 0, $2, $3, 'pago', $4, $5, $6)
      `, [proveedor_id, montoTotal, +(saldoPrev - montoTotal).toFixed(2), pago.id,
          `Pago a cuenta${observaciones ? ' — ' + observaciones.trim() : ''}`.substring(0, 200), !!facturado]);
    }

    // 3) Cheques del pago
    for (const ch of cheques) {
      if (!ch.banco || !ch.numero_cheque || !ch.fecha_vencimiento || !ch.importe) continue;
      await client.query(`
        INSERT INTO pago_proveedor_cheques
          (pago_proveedor_id, banco, numero_cheque, fecha_vencimiento, importe)
        VALUES ($1, $2, $3, $4, $5)
      `, [pago.id, ch.banco, ch.numero_cheque, ch.fecha_vencimiento, parseFloat(ch.importe)]);
    }

    await client.query('COMMIT');
    res.status(201).json({ pago });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
});

// ─── POST /api/pagos-proveedor/:id/anular ─────────────────────────────────────
// Revierte cuenta corriente, estado de los egresos imputados y, si es posible,
// el movimiento de caja (compensa en la caja abierta de la sucursal).
router.post('/:id/anular', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    if (!motivo || !motivo.trim()) return res.status(400).json({ error: 'El motivo de anulación es requerido' });

    const { rows: pagoRows } = await client.query(
      `SELECT * FROM pagos_proveedor WHERE id = $1`, [id]
    );
    const pago = pagoRows[0];
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.anulado) return res.status(400).json({ error: 'El pago ya está anulado' });

    await client.query('BEGIN');

    // 1) Marcar anulado
    await client.query(
      `UPDATE pagos_proveedor SET anulado = TRUE, motivo_anulacion = $1, updated_at = NOW() WHERE id = $2`,
      [motivo.trim(), id]
    );

    // 1b) Reponer en la caja fuerte lo que este pago descontó (medios "Efectivo
    //     Caja Fuerte"), sobre la sucursal de cada medio (fallback a la del pago).
    {
      const { rows: cfRows } = await client.query(`
        SELECT COALESCE(mp.caja_fuerte_sucursal_id, $2) AS suc, COALESCE(SUM(m.monto), 0) AS total
        FROM pago_proveedor_medios m JOIN medios_pago mp ON mp.id = m.medio_pago_id
        WHERE m.pago_proveedor_id = $1 AND mp.nombre ILIKE '%caja fuerte%'
        GROUP BY COALESCE(mp.caja_fuerte_sucursal_id, $2)
      `, [id, pago.sucursal_id]);
      for (const r of cfRows) {
        const totalCF = parseFloat(r.total) || 0;
        if (totalCF > 0 && r.suc) {
          await client.query(
            `UPDATE caja_fuerte SET saldo = saldo + $1, updated_at = NOW() WHERE sucursal_id = $2`,
            [totalCF.toFixed(2), r.suc]
          );
        }
      }
    }

    // 1c) Devolver a las cuentas bancarias lo que este pago descontó.
    await revertirMovimientosBancarios(client, 'pago_proveedor', id);

    // 2) Revertir imputaciones a egresos
    const { rows: aplic } = await client.query(
      `SELECT egreso_id, monto_aplicado FROM pago_proveedor_aplicaciones WHERE pago_proveedor_id = $1`, [id]
    );
    for (const ap of aplic) {
      // Borrar los egreso_pagos generados por este pago y recalcular estado
      await client.query(`DELETE FROM egreso_pagos WHERE egreso_id = $1 AND pago_proveedor_id = $2`,
        [ap.egreso_id, id]);
      const { rows: egRows } = await client.query(`SELECT total FROM egresos WHERE id = $1`, [ap.egreso_id]);
      const { rows: pagadoRows } = await client.query(
        `SELECT COALESCE(SUM(monto), 0) AS pagado FROM egreso_pagos WHERE egreso_id = $1`, [ap.egreso_id]
      );
      const total   = parseFloat(egRows[0]?.total || 0);
      const pagado  = parseFloat(pagadoRows[0].pagado);
      const estado  = pagado <= 0.01 ? 'pendiente'
                    : Math.abs(pagado - total) <= 0.01 ? 'pagado' : 'parcial';
      await client.query(`UPDATE egresos SET estado_pago = $1, updated_at = NOW() WHERE id = $2`,
        [estado, ap.egreso_id]);
    }

    // 3) Revertir cuenta corriente por los montos EXACTOS de este pago (un debe de
    //    corrección por cada haber generado). No se consultan los haber por origen_id
    //    para no revertir de más si el comprobante tuvo otros pagos.
    const reversas = aplic.length
      ? aplic.map(a => parseFloat(a.monto_aplicado))
      : [parseFloat(pago.monto)];
    for (const monto of reversas) {
      if (!monto || monto <= 0) continue;
      const saldoPrev = await saldoMovimientos(client, pago.proveedor_id);
      await client.query(`
        INSERT INTO cuentas_corrientes_proveedor
          (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
        VALUES ($1, $2, 0, $3, 'correccion', $4, 'Anulación de pago a proveedor', FALSE)
      `, [pago.proveedor_id, monto, +(saldoPrev + monto).toFixed(2), id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
