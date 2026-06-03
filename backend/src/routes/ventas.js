const express = require('express');
const { pool } = require('../config/db');
const arca = require('../services/arca');
const { sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/ventas/medios-pago ─────────────────────────────────────────────
router.get('/medios-pago', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, requiere_cuenta FROM medios_pago WHERE activo = true ORDER BY nombre'
    );
    res.json({ medios_pago: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/ventas ──────────────────────────────────────────────────────────
// ?q=            busca en número o razón social del cliente
// ?estado=       preventa | confirmada | facturada | anulada
// ?cliente_id=
// ?fecha_desde=  ISO date
// ?fecha_hasta=  ISO date
// ?sucursal_id=
// ?limit=        default 100
// ?offset=       default 0
router.get('/', async (req, res, next) => {
  try {
    const {
      q, estado, cliente_id, fecha_desde, fecha_hasta,
      limit = 100, offset = 0,
    } = req.query;

    const conditions = ['v.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (estado) {
      conditions.push(`v.estado = $${idx++}`);
      params.push(estado);
    }
    if (cliente_id) {
      conditions.push(`v.cliente_id = $${idx++}`);
      params.push(cliente_id);
    }
    const sucId = sucursalEfectiva(req);
    if (sucId) {
      conditions.push(`v.sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (fecha_desde) {
      conditions.push(`v.fecha >= $${idx++}`);
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      conditions.push(`v.fecha < ($${idx++}::date + interval '1 day')`);
      params.push(fecha_hasta);
    }
    if (q && q.trim()) {
      conditions.push(`(c.razon_social ILIKE $${idx} OR v.numero::text = $${idx + 1})`);
      params.push(`%${q.trim()}%`);
      params.push(q.trim());
      idx += 2;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          v.id, v.numero, v.fecha, v.estado,
          v.subtotal, v.descuento_total, v.total,
          v.observaciones,
          c.id             AS cliente_id,
          c.razon_social   AS cliente_nombre,
          s.nombre         AS sucursal_nombre,
          lp.nombre        AS lista_precio,
          f.cae            AS cae,
          f.ok             AS facturada_ok,
          (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id) AS items_count
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN sucursales s ON s.id = v.sucursal_id
        LEFT JOIN listas_precios lp ON lp.id = v.lista_precio_id
        LEFT JOIN LATERAL (
          SELECT cae, ok FROM facturaciones
          WHERE venta_id = v.id AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 1
        ) f ON true
        WHERE ${where}
        ORDER BY v.fecha DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(
        `SELECT COUNT(*) FROM ventas v
         LEFT JOIN clientes c ON c.id = v.cliente_id
         WHERE ${where}`,
        countParams
      ),
    ]);

    res.json({ count: parseInt(countRows[0].count), ventas: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/ventas ─────────────────────────────────────────────────────────
// Body:
//   sucursal_id, cliente_id (opcional), lista_precio_id (opcional),
//   estado ('preventa'|'confirmada'), observaciones,
//   items: [{ articulo_id, cantidad, precio_lista, descuento_pct, precio_unitario_final, iva_monto }]
//   pagos: [{ medio_pago_id, monto, cuenta_destino }]  (solo si estado=confirmada)
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      sucursal_id, cliente_id, lista_precio_id,
      estado = 'confirmada', observaciones,
      items = [], pagos = [],
    } = req.body;

    if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido' });
    if (items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un artículo' });

    // El cajero solo puede registrar ventas en su propia sucursal
    if (req.usuario?.rol === 'cajero') {
      const sucursalCajero = req.usuario.sucursal_default_id;
      if (!sucursalCajero || sucursalCajero !== sucursal_id) {
        return res.status(403).json({ error: 'No podés registrar ventas en una sucursal distinta a la tuya' });
      }
    }

    const articuloIds = items.map(i => i.articulo_id).filter(Boolean);
    if (articuloIds.length !== items.length) {
      return res.status(400).json({ error: 'Todos los ítems deben tener articulo_id' });
    }

    // Verificar caja abierta antes de confirmar una venta
    let cajaId = null;
    if (estado === 'confirmada') {
      const { rows: cajaRows } = await pool.query(
        `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
        [sucursal_id]
      );
      if (!cajaRows[0]) {
        return res.status(409).json({ error: 'La caja está cerrada. Abrí la caja antes de registrar ventas.' });
      }
      cajaId = cajaRows[0].id;
    }

    await client.query('BEGIN');

    // Fetchear precios reales desde la DB — no confiar en el cliente
    const precioQuery = lista_precio_id
      ? `SELECT a.id, a.nombre, a.alicuota_iva_id, ai.porcentaje AS iva_pct,
                COALESCE(lpi.precio_efectivo, a.precio_madre) AS precio_lista
         FROM articulos a
         LEFT JOIN lista_precio_items lpi
           ON lpi.articulo_id = a.id AND lpi.lista_id = $2 AND lpi.activo = TRUE
         LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
         WHERE a.id = ANY($1) AND a.deleted_at IS NULL`
      : `SELECT a.id, a.nombre, a.precio_madre AS precio_lista, a.alicuota_iva_id,
                ai.porcentaje AS iva_pct
         FROM articulos a
         LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
         WHERE a.id = ANY($1) AND a.deleted_at IS NULL`;

    const precioParams = lista_precio_id ? [articuloIds, lista_precio_id] : [articuloIds];
    const { rows: artRows } = await client.query(precioQuery, precioParams);

    if (artRows.length !== articuloIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Uno o más artículos no existen o están inactivos' });
    }
    const artMap = Object.fromEntries(artRows.map(a => [a.id, a]));

    // Recalcular precios y totales con datos de la DB
    let subtotal = 0;
    let descuento_total = 0;
    const itemsCalculados = items.map(item => {
      const art        = artMap[item.articulo_id];
      const precio_lista  = parseFloat(art.precio_lista) || 0;
      const descuento_pct = Math.max(0, Math.min(100, parseFloat(item.descuento_pct) || 0));
      const precio_final  = parseFloat((precio_lista * (1 - descuento_pct / 100)).toFixed(2));
      const cantidad      = Math.max(0, parseFloat(item.cantidad) || 1);
      const iva_pct       = parseFloat(art.iva_pct) || 0;
      const iva_monto     = parseFloat((precio_final * (iva_pct / 100)).toFixed(2));

      subtotal        += precio_lista * cantidad;
      descuento_total += (precio_lista - precio_final) * cantidad;

      return { ...item, precio_lista, descuento_pct, precio_unitario_final: precio_final, iva_monto, cantidad };
    });
    const total = parseFloat((subtotal - descuento_total).toFixed(2));

    // Número de venta secuencial por sucursal
    const { rows: numRows } = await client.query(
      `SELECT numero FROM ventas WHERE sucursal_id = $1
       ORDER BY numero DESC LIMIT 1 FOR UPDATE`,
      [sucursal_id]
    );
    const numero = (numRows[0]?.numero ?? 0) + 1;

    // Insertar venta
    const { rows: ventaRows } = await client.query(`
      INSERT INTO ventas
        (numero, sucursal_id, cliente_id, lista_precio_id, estado, observaciones,
         subtotal, descuento_total, total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, numero, fecha, estado, total
    `, [
      numero,
      sucursal_id,
      cliente_id || null,
      lista_precio_id || null,
      estado,
      observaciones || null,
      subtotal.toFixed(2),
      descuento_total.toFixed(2),
      total.toFixed(2),
    ]);
    const venta = ventaRows[0];

    // Solo verificar y descontar stock en ventas confirmadas
    if (estado === 'confirmada') {
      for (const item of itemsCalculados) {
        const { rows: stockRows } = await client.query(
          `SELECT cantidad FROM stock
           WHERE articulo_id = $1 AND sucursal_id = $2
           FOR UPDATE`,
          [item.articulo_id, sucursal_id]
        );
        const stockActual = parseFloat(stockRows[0]?.cantidad ?? 0);
        if (stockActual < item.cantidad) {
          await client.query('ROLLBACK');
          const art = artMap[item.articulo_id];
          return res.status(409).json({
            error: `Stock insuficiente para "${art.nombre}"`,
            detalle: {
              articulo_id: item.articulo_id,
              nombre: art.nombre,
              disponible: stockActual,
              solicitado: item.cantidad,
            },
          });
        }
        const nuevaCantidad = parseFloat((stockActual - item.cantidad).toFixed(3));
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET cantidad = EXCLUDED.cantidad, ultima_actualizacion = NOW()`,
          [item.articulo_id, sucursal_id, nuevaCantidad]
        );
      }
    }

    // Insertar items con precios calculados server-side
    for (const item of itemsCalculados) {
      await client.query(`
        INSERT INTO venta_items
          (venta_id, articulo_id, cantidad, precio_lista, descuento_pct, precio_unitario_final, iva_monto)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        venta.id,
        item.articulo_id,
        item.cantidad,
        item.precio_lista,
        item.descuento_pct,
        item.precio_unitario_final,
        item.iva_monto,
      ]);
    }

    // Insertar pagos (si confirmada)
    if (estado === 'confirmada' && pagos.length > 0) {
      // Resolver nombres de medios de pago para detectar "Saldo a favor"
      const medioIds = [...new Set(pagos.map(p => p.medio_pago_id).filter(Boolean))];
      let mediosMap = {};
      if (medioIds.length > 0) {
        const { rows: mediosRows } = await client.query(
          `SELECT id, nombre FROM medios_pago WHERE id = ANY($1::uuid[])`,
          [medioIds]
        );
        mediosMap = Object.fromEntries(mediosRows.map(m => [m.id, m]));
      }

      // Validar y consumir saldo a favor antes de insertar
      const pagosSaldoFavor = pagos.filter(p => mediosMap[p.medio_pago_id]?.nombre === 'Saldo a favor');
      if (pagosSaldoFavor.length > 0) {
        if (!cliente_id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Se requiere un cliente para usar saldo a favor' });
        }

        // Calcular saldo disponible
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
        `, [cliente_id]);

        const saldoActual = parseFloat(saldoRow?.saldo_actual ?? '0');
        const saldoDisponible = saldoActual < 0 ? Math.abs(saldoActual) : 0;
        const totalSaldoFavor = pagosSaldoFavor.reduce((s, p) => s + parseFloat(p.monto), 0);

        if (totalSaldoFavor > saldoDisponible + 0.01) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Saldo a favor insuficiente. Disponible: $${saldoDisponible.toFixed(2)}, solicitado: $${totalSaldoFavor.toFixed(2)}`,
          });
        }

        // Consumir el crédito: insertar debe en CC para reducir el saldo a favor
        const saldoDespues = parseFloat((saldoActual + totalSaldoFavor).toFixed(2));
        await client.query(
          `INSERT INTO cuentas_corrientes_cliente
             (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
           VALUES ($1, $2, 0, $3, 'consumo_nc', $4)`,
          [cliente_id, totalSaldoFavor, saldoDespues, venta.id]
        );
      }

      for (const pago of pagos) {
        await client.query(`
          INSERT INTO venta_pagos (venta_id, medio_pago_id, monto, cuenta_destino)
          VALUES ($1,$2,$3,$4)
        `, [venta.id, pago.medio_pago_id, parseFloat(pago.monto), pago.cuenta_destino || null]);

        for (const ch of (pago.cheques || [])) {
          await client.query(`
            INSERT INTO venta_cheques
              (venta_id, medio_pago_id, banco, numero_cheque, fecha_emision, fecha_vencimiento, importe)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [venta.id, pago.medio_pago_id, ch.banco, ch.numero_cheque,
              ch.fecha_emision || null, ch.fecha_vencimiento, parseFloat(ch.importe)]);
        }

        // Registrar movimiento en la caja (omitir "Saldo a favor" — no es ingreso de efectivo)
        const medio = mediosMap[pago.medio_pago_id];
        if (cajaId && medio?.nombre !== 'Saldo a favor') {
          await client.query(`
            INSERT INTO movimientos_caja (caja_id, tipo, concepto, monto, medio_pago_id)
            VALUES ($1, 'venta', $2, $3, $4)
          `, [
            cajaId,
            `Venta #${numero}`,
            parseFloat(pago.monto),
            pago.medio_pago_id || null,
          ]);
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ venta });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/ventas/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [{ rows: ventaRows }, { rows: itemRows }, { rows: pagoRows }, { rows: factRows }] = await Promise.all([
      pool.query(`
        SELECT
          v.id, v.numero, v.fecha, v.estado, v.observaciones,
          v.subtotal, v.descuento_total, v.total,
          v.sucursal_id,
          c.id           AS cliente_id,
          c.razon_social AS cliente_nombre,
          c.cuit         AS cliente_cuit,
          c.telefono     AS cliente_telefono,
          c.cond_iva_id,
          ci.nombre      AS cliente_cond_iva,
          c.direccion    AS cliente_direccion,
          s.nombre       AS sucursal_nombre,
          s.direccion    AS sucursal_direccion,
          s.telefono     AS sucursal_telefono,
          lp.nombre      AS lista_precio
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN cond_iva ci ON ci.id = c.cond_iva_id
        LEFT JOIN sucursales s ON s.id = v.sucursal_id
        LEFT JOIN listas_precios lp ON lp.id = v.lista_precio_id
        WHERE v.id = $1 AND v.deleted_at IS NULL
      `, [id]),
      pool.query(`
        SELECT
          vi.articulo_id, vi.cantidad, vi.precio_lista,
          vi.descuento_pct, vi.precio_unitario_final, vi.iva_monto,
          a.nombre, a.codigo,
          a.precio_madre
        FROM venta_items vi
        JOIN articulos a ON a.id = vi.articulo_id
        WHERE vi.venta_id = $1
        ORDER BY a.nombre
      `, [id]),
      pool.query(`
        SELECT
          vp.monto, vp.cuenta_destino, mp.nombre AS medio_pago,
          json_agg(
            json_build_object(
              'id',               vc.id,
              'banco',            vc.banco,
              'numero_cheque',    vc.numero_cheque,
              'fecha_emision',    vc.fecha_emision,
              'fecha_vencimiento',vc.fecha_vencimiento,
              'importe',          vc.importe
            )
          ) FILTER (WHERE vc.id IS NOT NULL) AS cheques
        FROM venta_pagos vp
        JOIN medios_pago mp ON mp.id = vp.medio_pago_id
        LEFT JOIN venta_cheques vc
          ON vc.venta_id = vp.venta_id AND vc.medio_pago_id = vp.medio_pago_id
        WHERE vp.venta_id = $1
        GROUP BY vp.monto, vp.cuenta_destino, mp.nombre
      `, [id]),
      pool.query(`
        SELECT f.cae, f.cae_vencimiento, f.numero AS factura_numero,
               f.punto_venta, f.total, f.qr_url, f.ok, f.mensaje_afip,
               f.fecha_emision, tc.descripcion AS tipo_comprobante
        FROM facturaciones f
        LEFT JOIN tipos_comprobante tc ON tc.id = f.tipo_comprobante_id
        WHERE f.venta_id = $1 AND f.deleted_at IS NULL
        ORDER BY f.created_at DESC
        LIMIT 1
      `, [id]),
    ]);

    if (ventaRows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

    res.json({
      venta: ventaRows[0],
      items: itemRows,
      pagos: pagoRows,
      facturacion: factRows[0] || null,
    });
  } catch (err) { next(err); }
});

// ─── PATCH /api/ventas/:id/estado ────────────────────────────────────────────
router.patch('/:id/estado', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!['preventa','confirmada','facturada','anulada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    await client.query('BEGIN');

    const { rows: ventaRows } = await client.query(
      `SELECT id, estado, sucursal_id FROM ventas WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!ventaRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const venta = ventaRows[0];

    // Al anular: devolver stock a la sucursal
    if (estado === 'anulada' && venta.estado !== 'anulada') {
      const { rows: itemRows } = await client.query(
        `SELECT articulo_id, cantidad FROM venta_items WHERE venta_id = $1`,
        [id]
      );
      for (const item of itemRows) {
        await client.query(
          `INSERT INTO stock (articulo_id, sucursal_id, cantidad, ultima_actualizacion)
           VALUES ($1, $2, $3::numeric, NOW())
           ON CONFLICT (articulo_id, sucursal_id)
           DO UPDATE SET cantidad = stock.cantidad + $3::numeric, ultima_actualizacion = NOW()`,
          [item.articulo_id, venta.sucursal_id, parseFloat(item.cantidad)]
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE ventas SET estado = $1 WHERE id = $2 RETURNING id, estado`,
      [estado, id]
    );

    await client.query('COMMIT');
    res.json({ venta: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── POST /api/ventas/:id/factura-test ───────────────────────────────────────
router.post('/:id/factura-test', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows: ventaRows } = await pool.query(`
      SELECT v.total, c.razon_social AS cliente_nombre, c.cuit AS cliente_cuit,
             ci.nombre AS cond_iva
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN cond_iva ci ON ci.id = c.cond_iva_id
      WHERE v.id = $1 AND v.deleted_at IS NULL
    `, [id]);

    if (ventaRows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    const v = ventaRows[0];

    const total = parseFloat(v.total);
    const neto  = +(total / 1.21).toFixed(2);
    const ivaImp = +(total - neto).toFixed(2);

    const resultado = await arca.generarFactura({
      puntoVenta:      1,
      tipoComprobante: arca.TIPO_COMPROBANTE.FACTURA_B,
      concepto:        arca.CONCEPTO.PRODUCTOS,
      cliente: {
        tipoDoc: arca.TIPO_DOC.SIN_IDENTIFICAR,
        nroDoc:  0,
      },
      items: [
        {
          descripcion:    `Venta #${id.slice(0,8)} — ${v.cliente_nombre || 'Consumidor Final'}`,
          cantidad:       1,
          precioUnitario: neto,
          alicuotaIva:    21,
        },
      ],
    });

    // Guardar en facturaciones si OK (best-effort — no falla la respuesta si hay un error de BD)
    if (resultado.CAE) {
      try {
        const nroComp = resultado.nroComprobante ? parseInt(resultado.nroComprobante) : 1;
        await pool.query(`
          INSERT INTO facturaciones
            (venta_id, sucursal_id, tipo_comprobante_id, punto_venta, numero,
             cae, cae_vencimiento, total, qr_url, respuesta_afip, ok, mensaje_afip)
          SELECT $1, v.sucursal_id,
                 COALESCE(
                   (SELECT id FROM tipos_comprobante WHERE codigo_afip = 6 LIMIT 1),
                   (SELECT id FROM tipos_comprobante LIMIT 1)
                 ),
                 $2, $3, $4, $5::date, $6, $7, $8::jsonb, true, 'Factura test ARCA'
          FROM ventas v WHERE v.id = $1
          ON CONFLICT DO NOTHING
        `, [
          id, nroComp, nroComp,
          resultado.CAE,
          resultado.CAEFchVto,
          total.toFixed(2),
          resultado.qrData ? `https://www.afip.gob.ar/fe/qr/?p=${resultado.qrData}` : null,
          JSON.stringify(resultado),
        ]);

        await pool.query(
          `UPDATE ventas SET estado = 'facturada' WHERE id = $1 AND deleted_at IS NULL`,
          [id]
        );
      } catch (dbErr) {
        console.warn('[ventas] factura-test: error guardando en BD:', dbErr.message);
      }
    }

    res.json({
      ok:             true,
      modo:           resultado.modo,
      CAE:            resultado.CAE,
      CAEFchVto:      resultado.CAEFchVto,
      nroComprobante: resultado.nroComprobante,
      total:          resultado.total,
      _mock:          resultado._mock || false,
      cliente:        v.cliente_nombre || 'Consumidor Final',
    });
  } catch (err) { next(err); }
});

// ─── GET /api/ventas/:id/pdf ──────────────────────────────────────────────────
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [{ rows: ventaRows }, { rows: itemRows }, { rows: factRows }] = await Promise.all([
      pool.query(`
        SELECT v.numero, v.fecha, v.estado, v.subtotal, v.descuento_total, v.total,
               c.razon_social AS cliente_nombre, c.cuit AS cliente_cuit, c.telefono AS cliente_tel,
               ci.nombre AS cond_iva,
               s.nombre AS sucursal_nombre, s.direccion AS sucursal_dir,
               lp.nombre AS lista_precio
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN cond_iva ci ON ci.id = c.cond_iva_id
        LEFT JOIN sucursales s ON s.id = v.sucursal_id
        LEFT JOIN listas_precios lp ON lp.id = v.lista_precio_id
        WHERE v.id = $1 AND v.deleted_at IS NULL
      `, [id]),
      pool.query(`
        SELECT vi.cantidad, vi.precio_lista, vi.descuento_pct,
               vi.precio_unitario_final, vi.iva_monto,
               a.nombre, a.codigo, a.precio_madre
        FROM venta_items vi
        JOIN articulos a ON a.id = vi.articulo_id
        WHERE vi.venta_id = $1 ORDER BY a.nombre
      `, [id]),
      pool.query(`
        SELECT f.cae, f.cae_vencimiento, f.numero AS factura_numero,
               f.punto_venta, f.total, f.qr_url, f.ok,
               tc.descripcion AS tipo_comprobante, tc.letra
        FROM facturaciones f
        LEFT JOIN tipos_comprobante tc ON tc.id = f.tipo_comprobante_id
        WHERE f.venta_id = $1 AND f.deleted_at IS NULL AND f.ok = true
        ORDER BY f.created_at DESC LIMIT 1
      `, [id]),
    ]);

    if (ventaRows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

    const venta = ventaRows[0];
    const fact  = factRows[0] || null;
    const tieneFactura = !!(fact?.cae);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="venta-${venta.numero}.pdf"`);
    doc.pipe(res);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 842
    const ML = 45;
    const MR = 45;
    const CW = PW - ML - MR;

    const ars = v => new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
    }).format(v);

    const pct = v => `${parseFloat(v || 0).toFixed(1)}%`;
    const fechaFmt = d => new Date(d).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    // ── HEADER ────────────────────────────────────────────────────────────────
    const HEADER_H = 100;
    doc.rect(0, 0, PW, HEADER_H).fill('#111111');
    doc.rect(0, 0, PW, 4).fill('#333333');
    doc.rect(ML, 18, 3, 36).fill('#333333');

    doc.fillColor('#ffffff').fontSize(26).font('Helvetica-Bold')
       .text('KING PACK', ML + 12, 18);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
       .text('DESCARTABLES', ML + 12, 50);

    // Tipo de comprobante — derecha del header
    const tipoLabel = tieneFactura
      ? `FACTURA ${fact.letra || 'B'}`
      : 'COMPROBANTE INTERNO';

    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(tipoLabel, 0, 22, { align: 'right', width: PW - MR });

    if (tieneFactura) {
      doc.fillColor('#aaaaaa').fontSize(9).font('Helvetica')
         .text(`Pto. Venta: ${String(fact.punto_venta).padStart(4,'0')}  Nº: ${String(fact.factura_numero).padStart(8,'0')}`, 0, 44, { align: 'right', width: PW - MR });
      doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica-Bold')
         .text(`CAE: ${fact.cae}`, 0, 60, { align: 'right', width: PW - MR });
      doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
         .text(`Vence: ${fechaFmt(fact.cae_vencimiento)}`, 0, 74, { align: 'right', width: PW - MR });
    } else {
      doc.fillColor('#888888').fontSize(9).font('Helvetica')
         .text(`Nº ${venta.numero}`, 0, 44, { align: 'right', width: PW - MR });
    }

    let curY = HEADER_H + 16;

    // ── DATOS EMISOR / RECEPTOR ───────────────────────────────────────────────
    const sectionY = curY;
    // Izquierda: emisor
    doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold')
       .text('VENDEDOR', ML, sectionY);
    doc.fillColor('#1a1a1a').fontSize(9).font('Helvetica-Bold')
       .text('King Pack Descartables', ML, sectionY + 10);
    doc.fillColor('#555555').fontSize(8).font('Helvetica')
       .text(venta.sucursal_dir || 'Laprida 270 – Ciudad de Salta', ML, sectionY + 23);
    doc.text('Tel: 3872220486', ML, sectionY + 35);
    doc.text(`CUIT: 30-71792696-6  ·  IVA Responsable Inscripto`, ML, sectionY + 47);
    doc.fillColor('#888888').text(`Fecha: ${fechaFmt(venta.fecha)}`, ML, sectionY + 59);

    // Línea divisoria vertical
    doc.strokeColor('#dddddd').lineWidth(0.5)
       .moveTo(PW / 2, sectionY).lineTo(PW / 2, sectionY + 75).stroke();

    // Derecha: cliente
    const RX = PW / 2 + 20;
    doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold')
       .text('CLIENTE', RX, sectionY);
    doc.fillColor('#1a1a1a').fontSize(9).font('Helvetica-Bold')
       .text(venta.cliente_nombre || 'Consumidor Final', RX, sectionY + 10, { width: PW - MR - RX });
    doc.fillColor('#555555').fontSize(8).font('Helvetica')
       .text(`CUIT: ${venta.cliente_cuit || '—'}`, RX, sectionY + 23);
    doc.text(`Cond. IVA: ${venta.cond_iva || 'Consumidor Final'}`, RX, sectionY + 35);
    if (venta.cliente_tel) {
      doc.text(`Tel: ${venta.cliente_tel}`, RX, sectionY + 47);
    }

    curY = sectionY + 85;

    // ── TABLA DE ITEMS ────────────────────────────────────────────────────────
    doc.strokeColor('#dddddd').lineWidth(0.5)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();
    curY += 2;

    // Header de tabla
    doc.rect(ML, curY, CW, 20).fill('#f2f2f2');
    doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold');
    doc.text('ARTÍCULO',    ML + 6,       curY + 6, { width: 180 });
    doc.text('CANT.',       ML + 186,     curY + 6, { width: 40, align: 'right' });
    doc.text('P. LISTA',    ML + 236,     curY + 6, { width: 70, align: 'right' });
    doc.text('DESC.',       ML + 316,     curY + 6, { width: 40, align: 'right' });
    doc.text('PRECIO FINAL',ML + 366,     curY + 6, { width: 80, align: 'right' });
    doc.text('SUBTOTAL',    ML + 456,     curY + 6, { width: CW - 456, align: 'right' });
    curY += 22;

    let rowIdx = 0;
    for (const item of itemRows) {
      const subtotalItem = parseFloat(item.precio_unitario_final) * parseFloat(item.cantidad);
      const tieneDesc = parseFloat(item.descuento_pct || 0) > 0;

      if (rowIdx % 2 === 1) {
        doc.rect(ML, curY, CW, 18).fill('#f9f9f9');
      }

      doc.fillColor('#1a1a1a').fontSize(8).font('Helvetica')
         .text(item.nombre, ML + 6, curY + 4, { width: 178, lineBreak: false });
      doc.text(parseFloat(item.cantidad).toFixed(0), ML + 186, curY + 4, { width: 40, align: 'right' });

      if (tieneDesc) {
        doc.fillColor('#888888')
           .text(ars(item.precio_lista), ML + 236, curY + 4, { width: 70, align: 'right' });
        doc.fillColor('#555555')
           .text(pct(item.descuento_pct), ML + 316, curY + 4, { width: 40, align: 'right' });
        doc.fillColor('#1a1a1a')
           .text(ars(item.precio_unitario_final), ML + 366, curY + 4, { width: 80, align: 'right' });
      } else {
        doc.fillColor('#888888').text('—', ML + 316, curY + 4, { width: 40, align: 'right' });
        doc.fillColor('#1a1a1a')
           .text(ars(item.precio_unitario_final), ML + 366, curY + 4, { width: 80, align: 'right' });
      }

      doc.fillColor('#111111').font('Helvetica-Bold')
         .text(ars(subtotalItem), ML + 456, curY + 4, { width: CW - 456, align: 'right' });

      doc.strokeColor('#eeeeee').lineWidth(0.4)
         .moveTo(ML, curY + 18).lineTo(PW - MR, curY + 18).stroke();

      curY += 19;
      rowIdx++;
    }

    curY += 8;

    // ── TOTALES ───────────────────────────────────────────────────────────────
    const totX = ML + CW - 200;

    const drawTotalRow = (label, value, bold = false, color = '#333333') => {
      if (bold) {
        doc.rect(totX - 10, curY - 1, 210, 20).fill('#f0f0f0');
      }
      doc.fillColor('#666666').fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(label, totX, curY + 3, { width: 100 });
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .text(ars(value), totX + 100, curY + 3, { width: 100, align: 'right' });
      curY += bold ? 22 : 18;
    };

    drawTotalRow('Subtotal', venta.subtotal);
    if (parseFloat(venta.descuento_total) > 0) {
      drawTotalRow('Descuento', -parseFloat(venta.descuento_total), false, '#555555');
    }
    drawTotalRow('TOTAL', venta.total, true, '#111111');

    // ── FOOTER ────────────────────────────────────────────────────────────────
    curY += 20;
    doc.strokeColor('#cccccc').lineWidth(0.7)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();
    curY += 10;

    if (!tieneFactura) {
      doc.fillColor('#aaaaaa').fontSize(7).font('Helvetica')
         .text('Este comprobante no tiene validez fiscal. Documento interno de King Pack.', ML, curY, { width: CW });
      curY += 12;
    }

    doc.fillColor('#888888').fontSize(7.5).font('Helvetica-Bold')
       .text('Laprida 270 – Ciudad de Salta', ML, curY);
    doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
       .text('  ·  Tel: 3872220486', ML + 143, curY);

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
