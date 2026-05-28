const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/egresos/alertas ─────────────────────────────────────────────────
// Vencimientos próximos (7 días) + obligaciones mensuales pendientes del mes actual
// IMPORTANTE: debe ir antes de /:id
router.get('/alertas', async (req, res, next) => {
  try {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    const [{ rows: vencEgresos }, { rows: vencCheques }, { rows: obligaciones }] = await Promise.all([
      pool.query(`
        SELECT e.id, e.descripcion, e.total, e.fecha_vencimiento_pago,
               p.razon_social AS proveedor_nombre
        FROM egresos e
        LEFT JOIN proveedores p ON p.id = e.proveedor_id
        WHERE e.estado_pago IN ('pendiente','parcial')
          AND e.fecha_vencimiento_pago BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        ORDER BY e.fecha_vencimiento_pago
      `),
      pool.query(`
        SELECT ec.banco, ec.numero_cheque, ec.fecha_vencimiento, ec.importe,
               e.descripcion AS egreso_descripcion,
               p.razon_social AS proveedor_nombre
        FROM egreso_cheques ec
        JOIN egreso_pagos ep ON ep.id = ec.egreso_pago_id
        JOIN egresos e        ON e.id  = ep.egreso_id
        LEFT JOIN proveedores p ON p.id = e.proveedor_id
        WHERE ec.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        ORDER BY ec.fecha_vencimiento
      `),
      pool.query(`
        SELECT id, descripcion, periodo_mes, periodo_anio
        FROM obligaciones_mensuales
        WHERE completada = FALSE AND periodo_mes = $1 AND periodo_anio = $2
        ORDER BY descripcion
      `, [mes, anio]),
    ]);

    const tieneObligacionesPendientes = obligaciones.length > 0;

    res.json({
      vencimientos_egresos: vencEgresos,
      vencimientos_cheques: vencCheques,
      obligaciones_pendientes: obligaciones,
      bloqueo_cierre: tieneObligacionesPendientes,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/egresos/pendientes ──────────────────────────────────────────────
// Lista de egresos con pago pendiente o parcial
router.get('/pendientes', async (req, res, next) => {
  try {
    const { sucursal_id, proveedor_id, limit = 100, offset = 0 } = req.query;

    const conditions = ["e.estado_pago IN ('pendiente','parcial')"];
    const params = [];
    let idx = 1;

    if (sucursal_id) { conditions.push(`e.sucursal_id = $${idx++}`); params.push(sucursal_id); }
    if (proveedor_id) { conditions.push(`e.proveedor_id = $${idx++}`); params.push(proveedor_id); }

    const where = conditions.join(' AND ');
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const { rows } = await pool.query(`
      SELECT e.id, e.tipo_operacion, e.tipo_comprobante, e.punto_venta, e.numero_comprobante,
             e.fecha_emision, e.descripcion, e.total, e.estado_pago, e.fecha_vencimiento_pago,
             p.razon_social AS proveedor_nombre, p.cuit AS proveedor_cuit,
             s.nombre AS sucursal_nombre,
             sg.nombre AS subrubro_nombre
      FROM egresos e
      LEFT JOIN proveedores p    ON p.id  = e.proveedor_id
      LEFT JOIN sucursales s     ON s.id  = e.sucursal_id
      LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
      WHERE ${where}
      ORDER BY e.fecha_vencimiento_pago ASC NULLS LAST, e.fecha_emision DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    res.json({ count: rows.length, egresos: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/egresos ─────────────────────────────────────────────────────────
// ?tipo_operacion=  (uno o varios separados por coma)
// ?proveedor_id=
// ?sucursal_id=
// ?fecha_desde=     ISO date
// ?fecha_hasta=     ISO date
// ?estado_pago=     pendiente | pagado | parcial
// ?q=               busca en descripcion o razon_social del proveedor
// ?limit=           default 100
// ?offset=          default 0
router.get('/', async (req, res, next) => {
  try {
    const {
      tipo_operacion, proveedor_id, sucursal_id,
      fecha_desde, fecha_hasta, estado_pago, q,
      limit = 100, offset = 0,
    } = req.query;

    const conditions = ['e.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (tipo_operacion) {
      const tipos = tipo_operacion.split(',').map(t => t.trim()).filter(Boolean);
      if (tipos.length > 0) {
        conditions.push(`e.tipo_operacion = ANY($${idx++})`);
        params.push(tipos);
      }
    }
    if (proveedor_id) { conditions.push(`e.proveedor_id = $${idx++}`); params.push(proveedor_id); }
    if (sucursal_id)  { conditions.push(`e.sucursal_id = $${idx++}`);  params.push(sucursal_id); }
    if (estado_pago)  { conditions.push(`e.estado_pago = $${idx++}`);  params.push(estado_pago); }
    if (fecha_desde)  {
      conditions.push(`e.fecha_emision >= $${idx++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta)  {
      conditions.push(`e.fecha_emision <= $${idx++}`);
      params.push(fecha_hasta);
    }
    if (q && q.trim()) {
      conditions.push(`(e.descripcion ILIKE $${idx} OR p.razon_social ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          e.id, e.tipo_operacion, e.tipo_comprobante,
          e.punto_venta, e.numero_comprobante, e.fecha_emision,
          e.descripcion, e.total, e.estado_pago, e.fecha_vencimiento_pago,
          e.neto_gravado, e.neto_no_gravado, e.iva_21, e.iva_105,
          e.percepciones_ib, e.otros_impuestos,
          p.id           AS proveedor_id,
          p.razon_social AS proveedor_nombre,
          p.cuit         AS proveedor_cuit,
          s.nombre       AS sucursal_nombre,
          sg.nombre      AS subrubro_nombre,
          rg.nombre      AS rubro_nombre,
          (SELECT COUNT(*) FROM egreso_items ei WHERE ei.egreso_id = e.id) AS items_count
        FROM egresos e
        LEFT JOIN proveedores p      ON p.id  = e.proveedor_id
        LEFT JOIN sucursales s       ON s.id  = e.sucursal_id
        LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
        LEFT JOIN rubros_gastos rg   ON rg.id = sg.rubro_id
        WHERE ${where}
        ORDER BY e.fecha_emision DESC, e.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`
        SELECT COUNT(*)
        FROM egresos e
        LEFT JOIN proveedores p ON p.id = e.proveedor_id
        WHERE ${where}
      `, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), egresos: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/egresos ────────────────────────────────────────────────────────
// Crea un egreso de cualquier tipo. Lógica condicional según tipo_operacion:
//   compra_mercaderia → items + actualiza stock + cuenta corriente proveedor
//   compra_gasto      → items + cuenta corriente proveedor
//   anticipo_proveedor → crea anticipos_proveedor + cuenta corriente (haber)
//   otros             → solo egreso
// Body:
//   tipo_operacion, tipo_comprobante?, punto_venta?, numero_comprobante?,
//   fecha_emision?, proveedor_id?, sucursal_id, subrubro_gasto_id?,
//   descripcion, neto_gravado?, neto_no_gravado?, iva_21?, iva_105?,
//   percepciones_ib?, otros_impuestos?, total,
//   estado_pago? (default 'pendiente'), fecha_vencimiento_pago?,
//   anticipo_id?  (anticipo a vincular con esta compra)
//   items: [{ articulo_id?, descripcion, cantidad, precio_unitario, sucursal_imputacion_id? }]
//   pago?: { medio_pago_id, monto, cuenta_bancaria_id?, observaciones?, cheques?: [...] }
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      tipo_operacion, tipo_comprobante, punto_venta, numero_comprobante,
      fecha_emision, proveedor_id, sucursal_id, subrubro_gasto_id,
      descripcion,
      neto_gravado = 0, neto_no_gravado = 0,
      iva_21 = 0, iva_105 = 0, percepciones_ib = 0, otros_impuestos = 0,
      total, estado_pago = 'pendiente', fecha_vencimiento_pago,
      anticipo_id,
      items = [],
      pago,
    } = req.body;

    // --- Validaciones básicas ---
    const TIPOS_VALIDOS = [
      'compra_mercaderia','compra_gasto','carga_social_laboral',
      'gasto_manual','inversion_bien_uso','anticipo_proveedor',
    ];
    if (!tipo_operacion || !TIPOS_VALIDOS.includes(tipo_operacion)) {
      return res.status(400).json({ error: 'tipo_operacion inválido o ausente' });
    }
    if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido' });
    if (!descripcion?.trim()) return res.status(400).json({ error: 'descripcion es requerida' });
    const TIPOS_CON_COMPROBANTE = ['compra_mercaderia','compra_gasto','inversion_bien_uso'];
    let totalNum;
    if (TIPOS_CON_COMPROBANTE.includes(tipo_operacion)) {
      totalNum = parseFloat(
        [neto_gravado, neto_no_gravado, iva_21, iva_105, percepciones_ib, otros_impuestos]
          .reduce((acc, v) => acc + (parseFloat(v) || 0), 0)
          .toFixed(2)
      );
      if (totalNum <= 0) return res.status(400).json({ error: 'La suma de importes debe ser mayor a 0' });
    } else {
      totalNum = parseFloat(total);
      if (!totalNum || totalNum <= 0) return res.status(400).json({ error: 'total debe ser mayor a 0' });
    }

    const TIPOS_CON_PROVEEDOR = ['compra_mercaderia','compra_gasto','inversion_bien_uso','anticipo_proveedor'];
    if (TIPOS_CON_PROVEEDOR.includes(tipo_operacion) && !proveedor_id) {
      return res.status(400).json({ error: 'proveedor_id es requerido para este tipo de operación' });
    }

    if (['compra_mercaderia','compra_gasto'].includes(tipo_operacion) && items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un ítem' });
    }

    if (tipo_operacion === 'compra_mercaderia') {
      for (const it of items) {
        if (!it.articulo_id) {
          return res.status(400).json({ error: 'Cada ítem de compra de mercadería requiere articulo_id' });
        }
      }
    }

    // Facturas en blanco: neto obligatorio
    if (tipo_comprobante && tipo_comprobante !== 'informal') {
      if (parseFloat(neto_gravado) === 0 && parseFloat(neto_no_gravado) === 0) {
        return res.status(400).json({ error: 'Las facturas en blanco requieren neto gravado o neto no gravado' });
      }
    }

    await client.query('BEGIN');

    // --- Crear egreso principal ---
    const { rows: egresoRows } = await client.query(`
      INSERT INTO egresos (
        tipo_operacion, tipo_comprobante, punto_venta, numero_comprobante, fecha_emision,
        proveedor_id, sucursal_id, subrubro_gasto_id, descripcion,
        neto_gravado, neto_no_gravado, iva_21, iva_105, percepciones_ib, otros_impuestos,
        total, estado_pago, fecha_vencimiento_pago, anticipo_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id, fecha_emision, estado_pago, total
    `, [
      tipo_operacion,
      tipo_comprobante || null,
      punto_venta?.trim() || null,
      numero_comprobante?.trim() || null,
      fecha_emision || new Date().toISOString().split('T')[0],
      proveedor_id || null,
      sucursal_id,
      subrubro_gasto_id || null,
      descripcion.trim(),
      parseFloat(neto_gravado) || 0,
      parseFloat(neto_no_gravado) || 0,
      parseFloat(iva_21) || 0,
      parseFloat(iva_105) || 0,
      parseFloat(percepciones_ib) || 0,
      parseFloat(otros_impuestos) || 0,
      totalNum,
      estado_pago,
      fecha_vencimiento_pago || null,
      anticipo_id || null,
    ]);
    const egreso = egresoRows[0];

    // --- Insertar ítems ---
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cant = parseFloat(it.cantidad) || 1;
      const precio = parseFloat(it.precio_unitario) || 0;
      const descPct = Math.max(0, Math.min(100, parseFloat(it.descuento_pct) || 0));
      const precioConDto = parseFloat((precio * (1 - descPct / 100)).toFixed(2));
      const neto = parseFloat((cant * precioConDto).toFixed(2));
      const sucImp = it.sucursal_imputacion_id || sucursal_id;

      await client.query(`
        INSERT INTO egreso_items
          (egreso_id, articulo_id, descripcion, cantidad, precio_unitario, descuento_pct,
           neto_linea, sucursal_imputacion_id, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [egreso.id, it.articulo_id || null, (it.descripcion || '').trim(),
          cant, precio, descPct, neto, sucImp, i]);
    }

    // --- Compra mercadería: crear pedido pendiente (stock se acredita al confirmar recepción) ---
    let pedidoCreado = null;
    if (tipo_operacion === 'compra_mercaderia') {
      const montoMercaderia = items.reduce((s, it) => {
        const cant = parseFloat(it.cantidad) || 1;
        const precio = parseFloat(it.precio_unitario) || 0;
        const descPct = Math.max(0, Math.min(100, parseFloat(it.descuento_pct) || 0));
        return s + cant * parseFloat((precio * (1 - descPct / 100)).toFixed(2));
      }, 0);

      const { rows: pedidoRows } = await client.query(`
        INSERT INTO pedidos_compra (proveedor_id, sucursal_id, egreso_id, monto_total)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [proveedor_id, sucursal_id, egreso.id, montoMercaderia.toFixed(2)]);
      pedidoCreado = pedidoRows[0];

      for (const it of items) {
        if (!it.articulo_id) continue;
        const cant = parseFloat(it.cantidad) || 1;
        const precio = parseFloat(it.precio_unitario) || 0;
        await client.query(`
          INSERT INTO pedido_items (pedido_id, articulo_id, cantidad, precio_compra)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (pedido_id, articulo_id)
          DO UPDATE SET cantidad = pedido_items.cantidad + EXCLUDED.cantidad
        `, [pedidoCreado.id, it.articulo_id, cant, precio]);
      }
    }

    // --- Anticipo vinculado: marcar como utilizado ---
    if (anticipo_id) {
      const { rowCount } = await client.query(`
        UPDATE anticipos_proveedor
        SET estado = 'vinculado', egreso_vinculado_id = $1
        WHERE id = $2 AND estado = 'disponible'
      `, [egreso.id, anticipo_id]);
      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El anticipo seleccionado ya no está disponible' });
      }
    }

    // --- Cuenta corriente del proveedor (deuda generada) ---
    if (proveedor_id && tipo_operacion !== 'anticipo_proveedor') {
      const saldo = await calcularSaldoProveedor(client, proveedor_id);
      await client.query(`
        INSERT INTO cuentas_corrientes_proveedor
          (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion)
        VALUES ($1, $2, 0, $3, 'egreso', $4, $5)
      `, [proveedor_id, totalNum, +(saldo + totalNum).toFixed(2),
          egreso.id, descripcion.trim().substring(0, 200)]);
    }

    // --- Anticipo proveedor: crear registro en anticipos_proveedor ---
    let anticipoNuevo = null;
    if (tipo_operacion === 'anticipo_proveedor') {
      const { rows: antRows } = await client.query(`
        INSERT INTO anticipos_proveedor (proveedor_id, monto, fecha, descripcion)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [proveedor_id, totalNum,
          fecha_emision || new Date().toISOString().split('T')[0], descripcion.trim()]);
      anticipoNuevo = antRows[0];

      const saldo = await calcularSaldoProveedor(client, proveedor_id);
      await client.query(`
        INSERT INTO cuentas_corrientes_proveedor
          (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion)
        VALUES ($1, 0, $2, $3, 'anticipo', $4, $5)
      `, [proveedor_id, totalNum, +(saldo - totalNum).toFixed(2),
          egreso.id, `Anticipo — ${descripcion}`.substring(0, 200)]);
    }

    // --- Registrar pago inmediato ---
    let estadoFinal = estado_pago;
    if (pago && pago.medio_pago_id && parseFloat(pago.monto) > 0) {
      const montoPago = parseFloat(pago.monto);

      const { rows: pagoRows } = await client.query(`
        INSERT INTO egreso_pagos
          (egreso_id, medio_pago_id, monto, cuenta_bancaria_id, observaciones)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [egreso.id, pago.medio_pago_id, montoPago,
          pago.cuenta_bancaria_id || null, pago.observaciones || null]);
      const pagoId = pagoRows[0].id;

      for (const ch of (pago.cheques || [])) {
        await client.query(`
          INSERT INTO egreso_cheques
            (egreso_pago_id, banco, numero_cheque, fecha_emision, fecha_vencimiento, importe)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [pagoId, ch.banco, ch.numero_cheque, ch.fecha_emision || null, ch.fecha_vencimiento, parseFloat(ch.importe)]);
      }

      if (proveedor_id) {
        const saldo = await calcularSaldoProveedor(client, proveedor_id);
        await client.query(`
          INSERT INTO cuentas_corrientes_proveedor
            (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion)
          VALUES ($1, 0, $2, $3, 'pago', $4, 'Pago')
        `, [proveedor_id, montoPago, +(saldo - montoPago).toFixed(2), egreso.id]);
      }

      estadoFinal = Math.abs(montoPago - totalNum) <= 0.01 ? 'pagado' : 'parcial';
      await client.query(
        `UPDATE egresos SET estado_pago = $1, updated_at = NOW() WHERE id = $2`,
        [estadoFinal, egreso.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      egreso: { ...egreso, estado_pago: estadoFinal },
      anticipo_creado: anticipoNuevo,
      pedido_creado: pedidoCreado,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Ya existe un comprobante con ese número para este proveedor. Verificá punto de venta y número.',
      });
    }
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/egresos/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [{ rows: egresoRows }, { rows: itemRows }, { rows: pagoRows }, { rows: pedidoRows }] = await Promise.all([
      pool.query(`
        SELECT
          e.*,
          p.razon_social AS proveedor_nombre, p.cuit AS proveedor_cuit,
          ci.nombre      AS proveedor_cond_iva,
          s.nombre       AS sucursal_nombre,
          sg.nombre      AS subrubro_nombre,
          rg.nombre      AS rubro_nombre
        FROM egresos e
        LEFT JOIN proveedores p      ON p.id  = e.proveedor_id
        LEFT JOIN cond_iva ci        ON ci.id = p.cond_iva_id
        LEFT JOIN sucursales s       ON s.id  = e.sucursal_id
        LEFT JOIN subrubro_gastos sg ON sg.id = e.subrubro_gasto_id
        LEFT JOIN rubros_gastos rg   ON rg.id = sg.rubro_id
        WHERE e.id = $1
      `, [id]),
      pool.query(`
        SELECT
          ei.*, a.nombre AS articulo_nombre, a.codigo AS articulo_codigo,
          s.nombre AS sucursal_imputacion_nombre
        FROM egreso_items ei
        LEFT JOIN articulos a   ON a.id = ei.articulo_id
        LEFT JOIN sucursales s  ON s.id = ei.sucursal_imputacion_id
        WHERE ei.egreso_id = $1
        ORDER BY ei.orden
      `, [id]),
      pool.query(`
        SELECT
          ep.*, mp.nombre AS medio_pago_nombre,
          cb.nombre AS cuenta_bancaria_nombre,
          json_agg(
            json_build_object(
              'id', ec.id, 'banco', ec.banco,
              'numero_cheque', ec.numero_cheque,
              'fecha_emision', ec.fecha_emision,
              'fecha_vencimiento', ec.fecha_vencimiento,
              'importe', ec.importe
            )
          ) FILTER (WHERE ec.id IS NOT NULL) AS cheques
        FROM egreso_pagos ep
        LEFT JOIN medios_pago mp             ON mp.id = ep.medio_pago_id
        LEFT JOIN cuentas_bancarias_empresa cb ON cb.id = ep.cuenta_bancaria_id
        LEFT JOIN egreso_cheques ec          ON ec.egreso_pago_id = ep.id
        WHERE ep.egreso_id = $1
        GROUP BY ep.id, mp.nombre, cb.nombre
        ORDER BY ep.fecha_pago DESC
      `, [id]),
      pool.query(`
        SELECT id, estado, stock_acreditado, fecha_recepcion, monto_total
        FROM pedidos_compra
        WHERE egreso_id = $1
        LIMIT 1
      `, [id]),
    ]);

    if (egresoRows.length === 0) return res.status(404).json({ error: 'Egreso no encontrado' });

    res.json({
      egreso: egresoRows[0],
      items: itemRows,
      pagos: pagoRows,
      pedido: pedidoRows[0] ?? null,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/egresos/:id/pago ───────────────────────────────────────────────
// Registra un pago parcial o total para un egreso pendiente
// Body: { medio_pago_id, monto, cuenta_bancaria_id?, observaciones?, cheques?: [...] }
router.post('/:id/pago', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { medio_pago_id, monto, cuenta_bancaria_id, observaciones, cheques = [] } = req.body;

    if (!medio_pago_id) return res.status(400).json({ error: 'medio_pago_id es requerido' });
    const montoPago = parseFloat(monto);
    if (!montoPago || montoPago <= 0) return res.status(400).json({ error: 'monto debe ser mayor a 0' });

    const { rows: egresoRows } = await pool.query(
      `SELECT id, total, proveedor_id, estado_pago FROM egresos WHERE id = $1`, [id]
    );
    if (!egresoRows[0]) return res.status(404).json({ error: 'Egreso no encontrado' });
    if (egresoRows[0].estado_pago === 'pagado') {
      return res.status(400).json({ error: 'Este egreso ya está pagado' });
    }

    await client.query('BEGIN');

    const { rows: pagoRows } = await client.query(`
      INSERT INTO egreso_pagos
        (egreso_id, medio_pago_id, monto, cuenta_bancaria_id, observaciones)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [id, medio_pago_id, montoPago, cuenta_bancaria_id || null, observaciones || null]);
    const pagoId = pagoRows[0].id;

    for (const ch of cheques) {
      await client.query(`
        INSERT INTO egreso_cheques
          (egreso_pago_id, banco, numero_cheque, fecha_emision, fecha_vencimiento, importe)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [pagoId, ch.banco, ch.numero_cheque, ch.fecha_emision || null, ch.fecha_vencimiento, parseFloat(ch.importe)]);
    }

    // Calcular total pagado para determinar nuevo estado
    const { rows: totalPagadoRows } = await client.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM egreso_pagos WHERE egreso_id = $1`, [id]
    );
    const totalPagado = parseFloat(totalPagadoRows[0].total_pagado);
    const totalEgreso = parseFloat(egresoRows[0].total);
    const nuevoEstado = Math.abs(totalPagado - totalEgreso) <= 0.01 ? 'pagado' : 'parcial';

    await client.query(
      `UPDATE egresos SET estado_pago = $1, updated_at = NOW() WHERE id = $2`,
      [nuevoEstado, id]
    );

    // Cuenta corriente del proveedor
    const proveedorId = egresoRows[0].proveedor_id;
    if (proveedorId) {
      const saldo = await calcularSaldoProveedor(client, proveedorId);
      await client.query(`
        INSERT INTO cuentas_corrientes_proveedor
          (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion)
        VALUES ($1, 0, $2, $3, 'pago', $4, 'Pago')
      `, [proveedorId, montoPago, +(saldo - montoPago).toFixed(2), id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, estado_pago: nuevoEstado, pago_id: pagoId });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── DELETE /api/egresos/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'El motivo de eliminación es requerido' });
    }

    const { rowCount } = await pool.query(
      `UPDATE egresos
          SET deleted_at = NOW(), motivo_eliminacion = $1, updated_at = NOW()
        WHERE id = $2 AND deleted_at IS NULL`,
      [motivo.trim(), id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Egreso no encontrado o ya eliminado' });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function calcularSaldoProveedor(client, proveedor_id) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
     FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`,
    [proveedor_id]
  );
  return parseFloat(rows[0].saldo) || 0;
}

module.exports = router;
