const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');

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
    const { q, activo = 'true', limit = 200, offset = 0 } = req.query;

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
    const sucId = sucursalEfectiva(req);
    if (sucId) {
      conditions.push(`c.sucursal_default_id = $${idx++}`);
      params.push(sucId);
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
    const { monto, concepto, medio_pago_id, sucursal_id } = req.body;
    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // Saldo actual antes del pago
      const { rows: [saldoRow] } = await dbClient.query(`
        SELECT c.saldo_inicial
               + COALESCE(SUM(cc.debe) - SUM(cc.haber), 0)
               + COALESCE(cs_agg.total_correcciones, 0) AS saldo_actual,
               c.razon_social
          FROM clientes c
          LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
          LEFT JOIN (
            SELECT cliente_id, SUM(monto) AS total_correcciones
              FROM correcciones_saldo_cliente GROUP BY cliente_id
          ) cs_agg ON cs_agg.cliente_id = c.id
         WHERE c.id = $1 AND c.deleted_at IS NULL
         GROUP BY c.id, c.saldo_inicial, c.razon_social, cs_agg.total_correcciones
      `, [req.params.id]);

      if (!saldoRow) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      const saldoAntes   = parseFloat(saldoRow.saldo_actual) || 0;
      const montoNum     = parseFloat(monto);
      const saldoDespues = saldoAntes - montoNum;

      const { rows: [mov] } = await dbClient.query(`
        INSERT INTO cuentas_corrientes_cliente
          (cliente_id, debe, haber, saldo, origen_tipo)
        VALUES ($1, 0, $2, $3, 'pago')
        RETURNING id, haber, saldo, fecha
      `, [req.params.id, montoNum, saldoDespues]);

      // Si hay concepto, registrar corrección de texto
      if (concepto?.trim()) {
        await dbClient.query(`
          INSERT INTO correcciones_saldo_cliente (cliente_id, monto, motivo)
          VALUES ($1, 0, $2)
        `, [req.params.id, concepto.trim()]);
      }

      // Registrar en caja si hay medio_pago_id y caja abierta
      if (medio_pago_id) {
        const sucId = sucursal_id || req.usuario?.sucursal_default_id || null;
        if (sucId) {
          const { rows: cajaRows } = await dbClient.query(
            `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
            [sucId]
          );
          if (cajaRows[0]) {
            const conceptoCaja = concepto?.trim()
              ? `Pago cliente — ${saldoRow.razon_social} (${concepto.trim()})`
              : `Pago cliente — ${saldoRow.razon_social}`;
            await dbClient.query(`
              INSERT INTO movimientos_caja (caja_id, tipo, concepto, monto, medio_pago_id)
              VALUES ($1, 'ingreso', $2, $3, $4)
            `, [cajaRows[0].id, conceptoCaja, montoNum, medio_pago_id]);
          }
        }
      }

      await dbClient.query('COMMIT');
      res.status(201).json({ movimiento: mov, saldo_nuevo: saldoDespues });
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally {
      dbClient.release();
    }
  } catch (err) { next(err); }
});

// ─── GET /api/clientes/:id/pdf-estado-cuenta ─────────────────────────────────
router.get('/:id/pdf-estado-cuenta', async (req, res, next) => {
  try {
    const [{ rows: [cliente] }, { rows: movs }] = await Promise.all([
      pool.query(`
        SELECT c.razon_social, c.cuit, c.direccion, c.telefono,
               ci.nombre AS cond_iva,
               lp.nombre AS lista_precio,
               c.saldo_inicial,
               c.saldo_inicial
                 + COALESCE(SUM(cc.debe) - SUM(cc.haber), 0)
                 + COALESCE(cs_agg.total_correcciones, 0) AS saldo_actual,
               c.limite_credito
          FROM clientes c
          LEFT JOIN cond_iva ci        ON ci.id  = c.cond_iva_id
          LEFT JOIN listas_precios lp  ON lp.id  = c.lista_precio_id
          LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
          LEFT JOIN (
            SELECT cliente_id, SUM(monto) AS total_correcciones
              FROM correcciones_saldo_cliente GROUP BY cliente_id
          ) cs_agg ON cs_agg.cliente_id = c.id
         WHERE c.id = $1 AND c.deleted_at IS NULL
         GROUP BY c.id, ci.nombre, lp.nombre, cs_agg.total_correcciones
      `, [req.params.id]),
      pool.query(`
        SELECT debe, haber, saldo, fecha, origen_tipo
          FROM cuentas_corrientes_cliente
         WHERE cliente_id = $1
         ORDER BY fecha ASC
      `, [req.params.id]),
    ]);

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

    const slug = cliente.razon_social.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="estado-cuenta-${slug}.pdf"`);
    doc.pipe(res);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 842
    const ML = 45;
    const MR = 45;
    const CW = PW - ML - MR;

    const ars = v => new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
    }).format(parseFloat(v) || 0);

    const fmtFecha = f => new Date(f).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    const TIPO_LABEL = { venta: 'Venta', facturacion: 'Facturación', pago: 'Pago', correccion: 'Corrección', consumo_nc: 'Saldo a favor', anulacion: 'Anulación', edicion_venta: 'Modificación' };

    // ── HEADER ────────────────────────────────────────────────────────────────
    const HEADER_H = 88;
    doc.rect(0, 0, PW, HEADER_H).fill('#111111');
    doc.rect(0, 0, PW, 4).fill('#333333');
    doc.rect(ML, 20, 3, 32).fill('#333333');

    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
       .text('KING PACK', ML + 12, 20);
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
       .text('DESCARTABLES', ML + 12, 48);
    doc.fillColor('#aaaaaa').fontSize(9).font('Helvetica')
       .text('·  ESTADO DE CUENTA', ML + 120, 48);

    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.fillColor('#888888').fontSize(8).font('Helvetica')
       .text(`Fecha: ${fecha}`, 0, 24, { align: 'right', width: PW - MR });

    // ── DATOS DEL CLIENTE ─────────────────────────────────────────────────────
    let curY = HEADER_H + 16;

    doc.fillColor('#1a1a1a').fontSize(13).font('Helvetica-Bold')
       .text(cliente.razon_social.toUpperCase(), ML, curY);
    curY += 18;

    const infoItems = [];
    if (cliente.cuit)       infoItems.push(`CUIT: ${cliente.cuit}`);
    if (cliente.cond_iva)   infoItems.push(`Cond. IVA: ${cliente.cond_iva}`);
    if (cliente.lista_precio) infoItems.push(`Lista: ${cliente.lista_precio}`);
    if (cliente.telefono)   infoItems.push(`Tel: ${cliente.telefono}`);
    if (cliente.direccion)  infoItems.push(cliente.direccion);

    doc.fillColor('#666666').fontSize(8).font('Helvetica')
       .text(infoItems.join('   ·   '), ML, curY, { width: CW * 0.65 });
    curY += 14;

    // Saldo actual — badge derecho
    const saldoActual  = parseFloat(cliente.saldo_actual) || 0;
    const limiteCredito = parseFloat(cliente.limite_credito) || 0;
    const excede = limiteCredito > 0 && saldoActual > limiteCredito;

    const badgeColor = excede ? '#1a1a1a' : saldoActual > 0 ? '#444444' : '#666666';
    doc.rect(PW - MR - 130, HEADER_H + 14, 130, 44).fill(badgeColor);
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
       .text('SALDO ACTUAL', PW - MR - 126, HEADER_H + 19, { width: 122, align: 'center' });
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(ars(saldoActual), PW - MR - 126, HEADER_H + 32, { width: 122, align: 'center' });

    curY = Math.max(curY, HEADER_H + 62);

    // Separator line
    doc.strokeColor('#e0e0e0').lineWidth(0.7)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();
    curY += 14;

    // ── COLUMN HEADERS ────────────────────────────────────────────────────────
    const COL_FECHA = ML;
    const COL_TIPO  = ML + 68;
    const COL_DEBE  = PW - MR - 210;
    const COL_HABER = PW - MR - 140;
    const COL_SALDO = PW - MR;

    doc.rect(0, curY, PW, 20).fill('#f2f2f2');
    doc.rect(0, curY + 19, PW, 1).fill('#d0d0d0');

    doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold');
    doc.text('FECHA',  COL_FECHA, curY + 7, { width: 60 });
    doc.text('TIPO',   COL_TIPO,  curY + 7, { width: 90 });
    doc.text('DEBE',   0, curY + 7, { align: 'right', width: PW - MR - 140 });
    doc.text('HABER',  0, curY + 7, { align: 'right', width: PW - MR - 70 });
    doc.text('SALDO',  0, curY + 7, { align: 'right', width: PW - MR });
    curY += 22;

    const ROW_H = 20;
    let rowIndex = 0;

    const ensureSpace = () => {
      if (curY + ROW_H > PH - 55) {
        doc.addPage();
        doc.rect(0, 0, PW, 20).fill('#f2f2f2');
        doc.rect(0, 19, PW, 1).fill('#d0d0d0');
        doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold');
        doc.text('FECHA', COL_FECHA, 7, { width: 60 });
        doc.text('TIPO',  COL_TIPO,  7, { width: 90 });
        doc.text('DEBE',  0, 7, { align: 'right', width: PW - MR - 140 });
        doc.text('HABER', 0, 7, { align: 'right', width: PW - MR - 70 });
        doc.text('SALDO', 0, 7, { align: 'right', width: PW - MR });
        curY = 22;
        rowIndex = 0;
      }
    };

    // Fila saldo inicial
    ensureSpace();
    if (rowIndex % 2 === 1) doc.rect(0, curY, PW, ROW_H).fill('#f9f9f9');
    doc.fillColor('#999999').fontSize(7.5).font('Helvetica-Oblique')
       .text('—', COL_FECHA, curY + 6, { width: 60 });
    doc.fillColor('#999999').fontSize(7.5).font('Helvetica-Oblique')
       .text('Saldo inicial', COL_TIPO, curY + 6, { width: 90 });
    doc.fillColor('#444444').fontSize(8).font('Helvetica-Bold')
       .text(ars(cliente.saldo_inicial), 0, curY + 5, { align: 'right', width: PW - MR });
    doc.strokeColor('#eeeeee').lineWidth(0.4)
       .moveTo(ML, curY + ROW_H).lineTo(PW - MR, curY + ROW_H).stroke();
    curY += ROW_H;
    rowIndex++;

    // Movimientos
    for (const m of movs) {
      ensureSpace();
      if (rowIndex % 2 === 1) doc.rect(0, curY, PW, ROW_H).fill('#f9f9f9');

      const debe  = parseFloat(m.debe)  || 0;
      const haber = parseFloat(m.haber) || 0;
      const saldo = parseFloat(m.saldo) || 0;

      doc.fillColor('#777777').fontSize(7.5).font('Helvetica')
         .text(fmtFecha(m.fecha), COL_FECHA, curY + 6, { width: 60 });

      doc.fillColor('#333333').fontSize(7.5).font('Helvetica')
         .text(TIPO_LABEL[m.origen_tipo] ?? m.origen_tipo ?? '—', COL_TIPO, curY + 6, { width: 90 });

      // Debe
      if (debe > 0) {
        doc.fillColor('#333333').fontSize(8).font('Helvetica-Bold')
           .text(ars(debe), 0, curY + 5, { align: 'right', width: PW - MR - 140 });
      } else {
        doc.fillColor('#cccccc').fontSize(8).font('Helvetica')
           .text('—', 0, curY + 5, { align: 'right', width: PW - MR - 140 });
      }

      // Haber
      if (haber > 0) {
        doc.fillColor('#666666').fontSize(8).font('Helvetica-Bold')
           .text(ars(haber), 0, curY + 5, { align: 'right', width: PW - MR - 70});
      } else {
        doc.fillColor('#cccccc').fontSize(8).font('Helvetica')
           .text('—', 0, curY + 5, { align: 'right', width: PW - MR - 70});
      }

      // Saldo
      const saldoColor = saldo > 0 ? '#333333' : saldo < 0 ? '#666666' : '#555555';
      doc.fillColor(saldoColor).fontSize(8.5).font('Helvetica-Bold')
         .text(ars(saldo), 0, curY + 5, { align: 'right', width: PW - MR });

      doc.strokeColor('#eeeeee').lineWidth(0.4)
         .moveTo(ML, curY + ROW_H).lineTo(PW - MR, curY + ROW_H).stroke();

      curY += ROW_H;
      rowIndex++;
    }

    // ── RESUMEN FINAL ─────────────────────────────────────────────────────────
    curY += 10;
    ensureSpace();

    doc.rect(ML, curY, CW, 32).fill('#f5f5f5');
    doc.strokeColor(excede ? '#444444' : '#d0d0d0').lineWidth(0.8)
       .rect(ML, curY, CW, 32).stroke();

    doc.fillColor('#555555').fontSize(7.5).font('Helvetica-Bold')
       .text('SALDO TOTAL AL ' + fecha, ML + 10, curY + 8);
    doc.fillColor(badgeColor).fontSize(13).font('Helvetica-Bold')
       .text(ars(saldoActual), 0, curY + 6, { align: 'right', width: PW - MR });

    if (excede) {
      doc.fillColor('#333333').fontSize(7).font('Helvetica-Bold')
         .text(`⚠  Límite de crédito excedido (límite: ${ars(limiteCredito)})`, ML + 10, curY + 21);
    }

    curY += 44;

    // ── FOOTER ────────────────────────────────────────────────────────────────
    doc.strokeColor('#cccccc').lineWidth(0.7)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();
    curY += 8;

    doc.fillColor('#888888').fontSize(7).font('Helvetica')
       .text('* Documento generado automáticamente. No válido como comprobante fiscal.', ML, curY, { width: CW });
    curY += 12;

    doc.fillColor('#555555').fontSize(7.5).font('Helvetica-Bold')
       .text('Laprida 270 – Ciudad de Salta', ML, curY);
    doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
       .text('  ·  Tel: 3872220486', ML + 143, curY);

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      if (totalPages > 1) {
        doc.fillColor('#aaaaaa').fontSize(7).font('Helvetica')
           .text(`Pág. ${i + 1} / ${totalPages}`, 0, PH - 22, { align: 'right', width: PW - MR });
      }
    }

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
