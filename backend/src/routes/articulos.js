const express = require('express');
const { pool } = require('../config/db');
const { requireRol, sucursalEfectiva } = require('../middleware/auth');

const router = express.Router();

// ─── PUT /api/articulos/:id ───────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { costo_base, costo_flete, margen_aplicado, nombre, categoria_id, alicuota_iva_id } = req.body;

    const updates = [];
    const params  = [];
    let idx = 1;

    if (nombre         !== undefined) { updates.push(`nombre = $${idx++}`);          params.push(nombre.trim()); }
    if (categoria_id   !== undefined) { updates.push(`categoria_id = $${idx++}`);    params.push(categoria_id); }
    if (alicuota_iva_id !== undefined){ updates.push(`alicuota_iva_id = $${idx++}`); params.push(alicuota_iva_id); }
    if (costo_base     !== undefined) { updates.push(`costo_base = $${idx++}`);      params.push(parseFloat(costo_base) || 0); }
    if (costo_flete    !== undefined) { updates.push(`costo_flete = $${idx++}`);     params.push(parseFloat(costo_flete) || 0); }
    if (margen_aplicado !== undefined){ updates.push(`margen_aplicado = $${idx++}`); params.push(margen_aplicado === '' || margen_aplicado === null ? null : parseFloat(margen_aplicado)); }

    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    const { rows } = await pool.query(`
      UPDATE articulos SET ${updates.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING id, codigo, nombre, precio_madre, costo_base, costo_flete, margen_aplicado, categoria_id, activo
    `, params);

    if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json({ articulo: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código duplicado' });
    next(err);
  }
});

// ─── PATCH /api/articulos/:id/stock-minimo ───────────────────────────────────
router.patch('/:id/stock-minimo', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock_minimo } = req.body;
    const val = Math.max(0, parseFloat(stock_minimo) || 0);

    // Verificar que el artículo existe
    const { rows: artRows } = await pool.query(
      'SELECT id FROM articulos WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!artRows[0]) return res.status(404).json({ error: 'Artículo no encontrado' });

    // Actualizar stock_minimo en todos los registros de stock existentes
    await pool.query(
      'UPDATE stock SET stock_minimo = $1 WHERE articulo_id = $2',
      [val, id]
    );

    res.json({ ok: true, stock_minimo: val });
  } catch (err) { next(err); }
});

// ─── PUT /api/articulos/:id/stock ────────────────────────────────────────────
// Fija el stock ABSOLUTO de un artículo en una sucursal, desglosado en las dos
// ubicaciones (adelante + depósito). El total es la suma de ambas y es lo que
// usa el resto del sistema. Registra el ajuste (delta del total) en
// ajustes_stock para auditoría.
// Body: { sucursal_id, cantidad_adelante, cantidad_deposito, motivo? }
//   (compat: si viene solo `cantidad`, se toma como depósito y adelante = 0)
router.put('/:id/stock', requireRol('administrador', 'supervisor'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { sucursal_id, cantidad_adelante, cantidad_deposito, cantidad, motivo } = req.body;

    if (!sucursal_id) return res.status(400).json({ error: 'Se requiere sucursal_id' });

    // Compat hacia atrás: si mandan solo `cantidad`, va todo al depósito.
    const legacy   = cantidad_adelante === undefined && cantidad_deposito === undefined;
    const adelante = parseFloat(legacy ? 0 : cantidad_adelante);
    const deposito = parseFloat(legacy ? cantidad : cantidad_deposito);

    if (!Number.isFinite(adelante) || adelante < 0 ||
        !Number.isFinite(deposito) || deposito < 0) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }
    const nueva = parseFloat((adelante + deposito).toFixed(3));

    await client.query('BEGIN');

    const art = await client.query('SELECT id FROM articulos WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!art.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Artículo no encontrado' }); }

    const suc = await client.query('SELECT id FROM sucursales WHERE id = $1', [sucursal_id]);
    if (!suc.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Sucursal no encontrada' }); }

    // Total actual (0 si todavía no hay registro de stock para esa sucursal)
    const cur = await client.query(
      'SELECT cantidad FROM stock WHERE articulo_id = $1 AND sucursal_id = $2',
      [id, sucursal_id]
    );
    const actual = cur.rows[0] ? parseFloat(cur.rows[0].cantidad) : 0;
    const delta  = parseFloat((nueva - actual).toFixed(3));

    // Upsert de los componentes (el trigger recalcula `cantidad` = adelante + depósito)
    await client.query(`
      INSERT INTO stock (articulo_id, sucursal_id, cantidad, cantidad_adelante, cantidad_deposito, ultima_actualizacion)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (articulo_id, sucursal_id)
      DO UPDATE SET cantidad_adelante = EXCLUDED.cantidad_adelante,
                    cantidad_deposito = EXCLUDED.cantidad_deposito,
                    ultima_actualizacion = NOW()
    `, [id, sucursal_id, nueva, adelante, deposito]);

    // Registrar el ajuste solo si el total cambió
    if (Math.abs(delta) > 0.0001) {
      await client.query(`
        INSERT INTO ajustes_stock (articulo_id, sucursal_id, cantidad_delta, motivo, usuario_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, sucursal_id, delta, (motivo && motivo.trim()) || 'Ajuste manual de stock', req.usuario?.id || null]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, cantidad: nueva, cantidad_adelante: adelante, cantidad_deposito: deposito, delta });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/articulos/alicuotas ────────────────────────────────────────────
router.get('/alicuotas', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, porcentaje, descripcion FROM alicuotas_iva ORDER BY porcentaje'
    );
    res.json({ alicuotas: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/articulos/next-codigo ──────────────────────────────────────────
// Sugiere el siguiente código correlativo (solo número, sin prefijo).
// Toma el mayor número al final de los códigos existentes y le suma 1.
router.get('/next-codigo', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(MAX((substring(codigo from '([0-9]+)$'))::bigint), 0) + 1 AS next
        FROM articulos
       WHERE deleted_at IS NULL AND codigo ~ '[0-9]+$'
    `);
    const n = Number(rows[0].next);
    res.json({ next: n, codigo: String(n).padStart(3, '0') });
  } catch (err) { next(err); }
});

// ─── POST /api/articulos ──────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      codigo, nombre, categoria_id, alicuota_iva_id,
      costo_base, costo_flete = 0, margen_aplicado,
    } = req.body;

    if (!codigo || !nombre || !categoria_id || !alicuota_iva_id || costo_base === undefined) {
      return res.status(400).json({
        error: 'codigo, nombre, categoria_id, alicuota_iva_id y costo_base son requeridos',
      });
    }

    const { rows } = await pool.query(`
      INSERT INTO articulos
        (codigo, nombre, categoria_id, alicuota_iva_id, costo_base, costo_flete, margen_aplicado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, codigo, nombre, precio_madre, activo, created_at
    `, [
      codigo.trim(),
      nombre.trim(),
      categoria_id,
      alicuota_iva_id,
      parseFloat(costo_base) || 0,
      parseFloat(costo_flete) || 0,
      margen_aplicado !== undefined && margen_aplicado !== '' ? parseFloat(margen_aplicado) : null,
    ]);

    res.status(201).json({ articulo: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un artículo con ese código' });
    }
    next(err);
  }
});

// ─── GET /api/articulos/pdf-precios ──────────────────────────────────────────
// ?lista_id=UUID   usa precio_efectivo de esa lista (default: precio_madre)
// ?descuento=N     descuento % adicional sobre el precio de lista
// ?desc_cats=id:N  descuentos adicionales por categoría
router.get('/pdf-precios', async (req, res, next) => {
  try {
    const descuento = Math.max(0, Math.min(100, parseFloat(req.query.descuento) || 0));
    const lista_id  = req.query.lista_id || null;

    const descCatsMap = {};
    if (req.query.desc_cats) {
      req.query.desc_cats.split(',').forEach(part => {
        const [id, pct] = part.split(':');
        if (id && pct !== undefined) descCatsMap[id] = Math.max(0, Math.min(100, parseFloat(pct) || 0));
      });
    }

    let listaNombre = 'Precio Madre';
    if (lista_id) {
      const { rows } = await pool.query('SELECT nombre FROM listas_precios WHERE id = $1', [lista_id]);
      if (rows[0]) listaNombre = rows[0].nombre;
    }

    const params  = [];
    let listaJoin = '';
    let precioExpr = 'a.precio_madre';

    if (lista_id) {
      params.push(lista_id);
      listaJoin  = 'LEFT JOIN lista_precio_items lpi ON lpi.articulo_id = a.id AND lpi.lista_id = $1';
      precioExpr = 'COALESCE(lpi.precio_efectivo, a.precio_madre)';
    }

    const { rows } = await pool.query(`
      SELECT a.codigo, a.nombre,
             ${precioExpr} AS precio_lista,
             c.id AS categoria_id, c.nombre AS categoria
        FROM articulos a
        LEFT JOIN categorias c ON c.id = a.categoria_id
        ${listaJoin}
       WHERE a.deleted_at IS NULL AND a.activo = true
       ORDER BY c.nombre NULLS LAST, a.nombre
    `, params);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="lista-precios-${listaNombre.toLowerCase().replace(/\s+/g, '-')}.pdf"`);
    doc.pipe(res);

    const PW   = doc.page.width;   // 595
    const PH   = doc.page.height;  // 842
    const ML   = 45;               // margin left
    const MR   = 45;               // margin right
    const CW   = PW - ML - MR;    // content width = 505

    // Column layout
    const COL_CODE  = ML;
    const COL_NAME  = ML + 78;
    const COL_PRICE = PW - MR;    // right-aligned anchor
    const COL_NAME_W = CW - 78 - 90; // name column width

    const ROW_H = 20;

    const ars = v => new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
    }).format(v);

    // ── HEADER ────────────────────────────────────────────────────────────────
    const HEADER_H = 88;
    doc.rect(0, 0, PW, HEADER_H).fill('#111111');

    // Top accent stripe
    doc.rect(0, 0, PW, 4).fill('#333333');

    // Vertical bar before logo
    doc.rect(ML, 20, 3, 32).fill('#333333');

    // KING PACK
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
       .text('KING PACK', ML + 12, 20);

    // DESCARTABLES
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
       .text('DESCARTABLES', ML + 12, 48);

    // Lista name — right side of "DESCARTABLES" line
    doc.fillColor('#aaaaaa').fontSize(9).font('Helvetica')
       .text('·  ' + listaNombre.toUpperCase(), ML + 120, 48);

    // Date — top right
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.fillColor('#888888').fontSize(8).font('Helvetica')
       .text(`Fecha: ${fecha}`, 0, 24, { align: 'right', width: PW - MR });

    // Extra discount badge (if any)
    if (descuento > 0) {
      doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica-Bold')
         .text(`Descuento adicional: ${descuento}%`, 0, 38, { align: 'right', width: PW - MR });
    }

    // ── COLUMN HEADERS ───────────────────────────────────────────────────────
    const COL_HDR_Y = HEADER_H + 2;
    doc.rect(0, COL_HDR_Y, PW, 22).fill('#f2f2f2');
    doc.rect(0, COL_HDR_Y + 21, PW, 1).fill('#d0d0d0');

    doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold');
    doc.text('CÓDIGO',  COL_CODE,  COL_HDR_Y + 7, { width: 70 });
    doc.text('DESCRIPCIÓN', COL_NAME, COL_HDR_Y + 7, { width: COL_NAME_W });
    doc.text('PRECIO',  0, COL_HDR_Y + 7, { align: 'right', width: PW - MR });

    let curY = COL_HDR_Y + 24;

    // ── ROWS ─────────────────────────────────────────────────────────────────
    let currentCat = null;
    let rowIndex   = 0;

    const ensureSpace = (needed) => {
      if (curY + needed > PH - 55) {
        doc.addPage();
        // Repeat column header on new page
        doc.rect(0, 0, PW, 22).fill('#f2f2f2');
        doc.rect(0, 21, PW, 1).fill('#d0d0d0');
        doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold');
        doc.text('CÓDIGO',      COL_CODE, 7, { width: 70 });
        doc.text('DESCRIPCIÓN', COL_NAME, 7, { width: COL_NAME_W });
        doc.text('PRECIO',      0,         7, { align: 'right', width: PW - MR });
        curY = 26;
        rowIndex = 0;
      }
    };

    for (const art of rows) {
      // ── Category header
      if (art.categoria !== currentCat) {
        currentCat = art.categoria;
        ensureSpace(28 + ROW_H);

        const catLabel = (currentCat || 'SIN CATEGORÍA').toUpperCase();

        doc.rect(0, curY, PW, 24).fill('#1e1e1e');
        // Left accent
        doc.rect(ML - 2, curY, 3, 24).fill('#555555');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
           .text(catLabel, ML + 8, curY + 8, { width: CW - 8 });

        curY += 26;
        rowIndex = 0;
      }

      ensureSpace(ROW_H);

      const catDesc = Object.prototype.hasOwnProperty.call(descCatsMap, art.categoria_id)
        ? descCatsMap[art.categoria_id] : descuento;
      const precio = parseFloat(art.precio_lista) * (1 - catDesc / 100);

      // Alternating row background
      if (rowIndex % 2 === 1) {
        doc.rect(0, curY, PW, ROW_H).fill('#f9f9f9');
      }

      // Code
      doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
         .text(art.codigo, COL_CODE, curY + 6, { width: 70 });

      // Name
      doc.fillColor('#1a1a1a').fontSize(8.5).font('Helvetica')
         .text(art.nombre, COL_NAME, curY + 5, { width: COL_NAME_W, lineBreak: false });

      // Price — bold, dark
      doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold')
         .text(ars(precio), 0, curY + 5, { align: 'right', width: PW - MR });

      // Bottom separator
      doc.strokeColor('#e8e8e8').lineWidth(0.5)
         .moveTo(ML, curY + ROW_H).lineTo(PW - MR, curY + ROW_H).stroke();

      curY += ROW_H;
      rowIndex++;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    curY += 14;
    doc.strokeColor('#cccccc').lineWidth(0.7)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();
    curY += 8;

    doc.fillColor('#888888').fontSize(7).font('Helvetica')
       .text('* Precios en pesos argentinos con IVA incluido. Sujetos a modificación sin previo aviso.', ML, curY, { width: CW });

    curY += 12;
    doc.fillColor('#555555').fontSize(7.5).font('Helvetica-Bold')
       .text('Laprida 270 – Ciudad de Salta', ML, curY);
    doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
       .text('  ·  Tel: 3872220486', ML + 143, curY);

    // Page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      if (totalPages > 1) {
        doc.fillColor('#aaaaaa').fontSize(7).font('Helvetica')
           .text(`Pág. ${i + 1} / ${totalPages}`, 0, PH - 22, { align: 'right', width: PW - MR });
      }
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/articulos/pdf-conteo ───────────────────────────────────────────
// Planilla de conteo de stock (para completar a mano). Lista todos los
// artículos activos ordenados por nombre, con una columna CANTIDAD en blanco.
// ?sucursal_id=UUID   (requerido) solo para el encabezado
// ?ubicacion=         (requerido) adelante | deposito → etiqueta del encabezado
router.get('/pdf-conteo', async (req, res, next) => {
  try {
    const sucursal_id = req.query.sucursal_id || null;
    const ubicacion   = String(req.query.ubicacion || '').toLowerCase();

    if (!sucursal_id) return res.status(400).json({ error: 'sucursal_id es requerido' });

    const UBIC_LABEL = { adelante: 'Frente del local', deposito: 'Depósito' };
    if (!UBIC_LABEL[ubicacion]) {
      return res.status(400).json({ error: 'ubicacion debe ser "adelante" o "deposito"' });
    }
    const ubicLabel = UBIC_LABEL[ubicacion];

    const { rows: sucRows } = await pool.query('SELECT nombre FROM sucursales WHERE id = $1', [sucursal_id]);
    if (!sucRows[0]) return res.status(404).json({ error: 'Sucursal no encontrada' });
    const sucursalNombre = sucRows[0].nombre;

    const { rows } = await pool.query(`
      SELECT a.nombre
        FROM articulos a
       WHERE a.deleted_at IS NULL AND a.activo = true
       ORDER BY a.nombre
    `);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

    const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sucursal';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `inline; filename="conteo-stock-${slug(sucursalNombre)}-${ubicacion}.pdf"`);
    doc.pipe(res);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 842
    const ML = 45;
    const MR = 45;
    const CW = PW - ML - MR;     // 505

    // Layout de columnas: ARTÍCULO (izq) | CANTIDAD (der, recuadro en blanco)
    const CANT_W    = 110;                 // ancho reservado para la columna cantidad
    const COL_NAME  = ML;
    const COL_NAME_W = CW - CANT_W - 10;
    const BOX_W     = 90;
    const BOX_X     = PW - MR - BOX_W;      // recuadro pegado al margen derecho

    const ROW_H = 22;

    // ── HEADER ────────────────────────────────────────────────────────────────
    const HEADER_H = 88;
    doc.rect(0, 0, PW, HEADER_H).fill('#111111');
    doc.rect(0, 0, PW, 4).fill('#333333');
    doc.rect(ML, 20, 3, 32).fill('#333333');

    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
       .text('KING PACK', ML + 12, 20);
    doc.fillColor('#aaaaaa').fontSize(9).font('Helvetica-Bold')
       .text('PLANILLA DE CONTEO DE STOCK', ML + 12, 50);

    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.fillColor('#888888').fontSize(8).font('Helvetica')
       .text(`Fecha: ${fecha}`, 0, 22, { align: 'right', width: PW - MR });
    doc.fillColor('#dddddd').fontSize(8.5).font('Helvetica-Bold')
       .text(`Sucursal: ${sucursalNombre}`, 0, 40, { align: 'right', width: PW - MR });
    doc.fillColor('#dddddd').fontSize(8.5).font('Helvetica-Bold')
       .text(`Ubicación: ${ubicLabel}`, 0, 54, { align: 'right', width: PW - MR });

    // ── COLUMN HEADERS ───────────────────────────────────────────────────────
    const drawColHeader = (y) => {
      doc.rect(0, y, PW, 22).fill('#f2f2f2');
      doc.rect(0, y + 21, PW, 1).fill('#d0d0d0');
      doc.fillColor('#555555').fontSize(7).font('Helvetica-Bold');
      doc.text('ARTÍCULO', COL_NAME, y + 7, { width: COL_NAME_W });
      doc.text('CANTIDAD', BOX_X, y + 7, { width: BOX_W, align: 'center' });
    };

    const COL_HDR_Y = HEADER_H + 2;
    drawColHeader(COL_HDR_Y);
    let curY = COL_HDR_Y + 24;
    let rowIndex = 0;

    const ensureSpace = (needed) => {
      if (curY + needed > PH - 55) {
        doc.addPage();
        drawColHeader(0);
        curY = 26;
        rowIndex = 0;
      }
    };

    // ── ROWS ─────────────────────────────────────────────────────────────────
    for (const art of rows) {
      ensureSpace(ROW_H);

      if (rowIndex % 2 === 1) {
        doc.rect(0, curY, PW, ROW_H).fill('#f9f9f9');
      }

      // Nombre
      doc.fillColor('#1a1a1a').fontSize(9).font('Helvetica')
         .text(art.nombre, COL_NAME, curY + 6, { width: COL_NAME_W, lineBreak: false });

      // Recuadro en blanco para anotar la cantidad
      doc.strokeColor('#bbbbbb').lineWidth(0.7)
         .rect(BOX_X, curY + 4, BOX_W, ROW_H - 8).stroke();

      // Separador inferior de fila
      doc.strokeColor('#e8e8e8').lineWidth(0.5)
         .moveTo(ML, curY + ROW_H).lineTo(PW - MR, curY + ROW_H).stroke();

      curY += ROW_H;
      rowIndex++;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    ensureSpace(40);
    curY += 14;
    doc.strokeColor('#cccccc').lineWidth(0.7)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();
    curY += 8;
    doc.fillColor('#888888').fontSize(7).font('Helvetica')
       .text('* Complete la cantidad real contada en cada artículo y luego actualice el sistema.', ML, curY, { width: CW });

    // Numeración de páginas
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      if (totalPages > 1) {
        doc.fillColor('#aaaaaa').fontSize(7).font('Helvetica')
           .text(`Pág. ${i + 1} / ${totalPages}`, 0, PH - 22, { align: 'right', width: PW - MR });
      }
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/articulos ──────────────────────────────────────────────────────
// ?lista_id=UUID   precio_efectivo de esa lista (default: precio_madre)
// ?q=              busca en nombre o código
// ?categoria_id=   filtra por categoría
// ?activo=         'true' (default) | 'false' | 'all'
// ?stock_bajo=     'true' — solo artículos con cantidad <= stock_minimo
// ?limit=          max 1000, default 500
// ?offset=         default 0
// ─── GET /api/articulos/:id/ventas ───────────────────────────────────────────
// Trazabilidad de un artículo: todas las ventas que lo incluyen, con cliente,
// vendedor, cantidad e importe por renglón. Sirve para controlar a qué venta
// corresponde un artículo y a quién se le vendió.
// Filtros: ?fecha_desde= ?fecha_hasta= ?estado=  (sucursal según rol)
router.get('/:id/ventas', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_desde, fecha_hasta, estado } = req.query;

    const { rows: artRows } = await pool.query(
      'SELECT id, codigo, nombre FROM articulos WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!artRows[0]) return res.status(404).json({ error: 'Artículo no encontrado' });

    const conditions = ['vi.articulo_id = $1', 'v.deleted_at IS NULL'];
    const params = [id];
    let idx = 2;

    if (estado)      { conditions.push(`v.estado = $${idx++}`);   params.push(estado); }
    if (fecha_desde) { conditions.push(`v.fecha >= $${idx++}`);   params.push(fecha_desde); }
    if (fecha_hasta) { conditions.push(`v.fecha < ($${idx++}::date + interval '1 day')`); params.push(fecha_hasta); }

    const sucId = sucursalEfectiva(req);
    if (sucId) { conditions.push(`v.sucursal_id = $${idx++}`); params.push(sucId); }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        v.id                 AS venta_id,
        v.numero,
        v.fecha,
        v.estado,
        vi.cantidad,
        vi.precio_unitario_final,
        (vi.cantidad * vi.precio_unitario_final) AS importe,
        c.id                 AS cliente_id,
        c.razon_social       AS cliente_nombre,
        s.nombre             AS sucursal_nombre,
        u.nombre             AS vendedor_nombre,
        u.rol                AS vendedor_rol
      FROM venta_items vi
      JOIN ventas v          ON v.id = vi.venta_id
      LEFT JOIN clientes c   ON c.id = v.cliente_id
      LEFT JOIN sucursales s ON s.id = v.sucursal_id
      LEFT JOIN usuarios u   ON u.id = v.vendedor_id
      WHERE ${where}
      ORDER BY v.fecha DESC, v.numero DESC
    `, params);

    // Resumen: las anuladas no cuentan como vendido, pero se listan igual para control.
    const vigentes = rows.filter(r => r.estado !== 'anulada');
    const totalUnidades = vigentes.reduce((acc, r) => acc + parseFloat(r.cantidad), 0);
    const totalImporte  = vigentes.reduce((acc, r) => acc + parseFloat(r.importe), 0);

    res.json({
      articulo: artRows[0],
      movimientos: rows,
      resumen: {
        cantidad_ventas: rows.length,
        total_unidades:  totalUnidades,
        total_importe:   totalImporte,
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/articulos ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria_id, lista_id, sucursal_id, activo = 'true', stock_bajo, limit = 500, offset = 0 } = req.query;

    const conditions = ['a.deleted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (activo !== 'all') {
      conditions.push(`a.activo = $${idx++}`);
      params.push(activo !== 'false');
    }
    if (categoria_id) {
      conditions.push(`a.categoria_id = $${idx++}`);
      params.push(categoria_id);
    }
    if (q && q.trim()) {
      conditions.push(`(a.nombre ILIKE $${idx} OR a.codigo ILIKE $${idx})`);
      params.push(`%${q.trim()}%`);
      idx++;
    }

    let joinParamCount = 0;

    // JOIN condicional para lista de precios
    let listaJoin = '';
    let precioListaExpr = 'a.precio_madre AS precio_lista';
    if (lista_id) {
      params.push(lista_id);
      listaJoin = `LEFT JOIN lista_precio_items lpi ON lpi.articulo_id = a.id AND lpi.lista_id = $${idx++}`;
      precioListaExpr = 'COALESCE(lpi.precio_efectivo, a.precio_madre) AS precio_lista';
      joinParamCount++;
    }

    // Subquery de stock — filtrado por sucursal o agregado total con detalle
    let stockSubquery;
    if (sucursal_id) {
      params.push(sucursal_id);
      stockSubquery = `
        SELECT articulo_id,
               COALESCE(cantidad, 0)                                            AS cantidad_total,
               COALESCE(cantidad_adelante, 0)                                   AS cantidad_adelante,
               COALESCE(cantidad_deposito, 0)                                   AS cantidad_deposito,
               (COALESCE(cantidad, 0) <= stock_minimo AND stock_minimo > 0)     AS stock_bajo,
               COALESCE(stock_minimo, 0)                                        AS stock_minimo,
               NULL::json                                                       AS stock_detalle
          FROM stock
         WHERE sucursal_id = $${idx++}
      `;
      joinParamCount++;
    } else {
      stockSubquery = `
        SELECT st.articulo_id,
               SUM(st.cantidad)                                                      AS cantidad_total,
               SUM(st.cantidad_adelante)                                             AS cantidad_adelante,
               SUM(st.cantidad_deposito)                                             AS cantidad_deposito,
               BOOL_OR(st.cantidad <= st.stock_minimo AND st.stock_minimo > 0)      AS stock_bajo,
               COALESCE(MAX(st.stock_minimo), 0)                                    AS stock_minimo,
               json_agg(
                 json_build_object(
                   'nombre',    s.nombre,
                   'cantidad',  COALESCE(st.cantidad, 0)::numeric,
                   'stock_bajo', (st.cantidad <= st.stock_minimo AND st.stock_minimo > 0)
                 )
                 ORDER BY s.nombre
               )                                                                     AS stock_detalle
          FROM stock st
          JOIN sucursales s ON s.id = st.sucursal_id AND s.activo = true
         GROUP BY st.articulo_id
      `;
    }

    if (stock_bajo === 'true') {
      conditions.push('COALESCE(st.stock_bajo, false) = true');
    }

    const where       = conditions.join(' AND ');
    // countParams se calcula ANTES de pushear limit/offset
    // slice(0, -joinParamCount) saca los params de JOIN del final; si joinParamCount=0 toma todos
    const countParams = params.slice(0, joinParamCount > 0 ? -joinParamCount : undefined);

    params.push(Math.min(parseInt(limit) || 500, 1000));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          a.id, a.codigo, a.nombre,
          a.precio_madre, a.costo_base, a.costo_flete, a.margen_aplicado, a.activo,
          a.alicuota_iva_id,
          ai.porcentaje  AS alicuota_porcentaje,
          c.id           AS categoria_id,
          c.nombre       AS categoria,
          ${precioListaExpr},
          COALESCE(st.cantidad_total, 0)::numeric  AS stock_total,
          COALESCE(st.cantidad_adelante, 0)::numeric AS stock_adelante,
          COALESCE(st.cantidad_deposito, 0)::numeric AS stock_deposito,
          COALESCE(st.stock_bajo,    false)         AS stock_bajo,
          COALESCE(st.stock_minimo,  0)::numeric    AS stock_minimo,
          st.stock_detalle
        FROM articulos a
        LEFT JOIN categorias c ON c.id = a.categoria_id
        LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
        ${listaJoin}
        LEFT JOIN (${stockSubquery}) st ON st.articulo_id = a.id
        WHERE ${where}
        ORDER BY a.nombre
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(
        stock_bajo === 'true'
          ? `SELECT COUNT(*) FROM articulos a
             ${listaJoin}
             LEFT JOIN (${stockSubquery}) st ON st.articulo_id = a.id
             WHERE ${where}`
          : `SELECT COUNT(*) FROM articulos a WHERE ${where}`,
        stock_bajo === 'true' ? params.slice(0, -2) : countParams
      ),
    ]);

    res.json({ count: parseInt(countRows[0].count), articulos: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/articulos/ranking — top más y menos vendidos del mes ───────────
router.get('/ranking', async (req, res, next) => {
  try {
    const { sucursal_id, limite = '10' } = req.query;
    const lim = Math.min(parseInt(limite) || 10, 20);

    const sucursalFilter = sucursal_id ? `AND v.sucursal_id = $2` : '';
    const params         = sucursal_id ? [lim, sucursal_id] : [lim];

    const [masVendidos, menosVendidos] = await Promise.all([

      // Top más vendidos del mes (solo artículos con al menos 1 venta)
      pool.query(`
        SELECT
          a.id,
          a.nombre,
          a.codigo,
          COALESCE(cat.nombre, 'Sin categoría') AS categoria,
          SUM(vi.cantidad)::float                AS total_unidades,
          SUM(vi.cantidad * vi.precio_unitario_final)::float AS total_ingresos
        FROM venta_items vi
        JOIN articulos a  ON a.id = vi.articulo_id
                         AND a.deleted_at IS NULL
                         AND a.activo = TRUE
        JOIN ventas v     ON v.id = vi.venta_id
                         AND v.deleted_at IS NULL
                         AND DATE_TRUNC('month', v.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')
                           = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')
                         ${sucursalFilter}
        LEFT JOIN categorias cat ON cat.id = a.categoria_id
        GROUP BY a.id, a.nombre, a.codigo, cat.nombre
        ORDER BY total_unidades DESC
        LIMIT $1
      `, params),

      // Top menos vendidos del mes (incluye artículos con 0 ventas)
      pool.query(`
        SELECT
          a.id,
          a.nombre,
          a.codigo,
          COALESCE(cat.nombre, 'Sin categoría') AS categoria,
          COALESCE(SUM(vi.cantidad), 0)::float   AS total_unidades,
          COALESCE(SUM(vi.cantidad * vi.precio_unitario_final), 0)::float AS total_ingresos
        FROM articulos a
        LEFT JOIN categorias cat ON cat.id = a.categoria_id
        LEFT JOIN venta_items vi ON vi.articulo_id = a.id
        LEFT JOIN ventas v       ON v.id = vi.venta_id
                                AND v.deleted_at IS NULL
                                AND DATE_TRUNC('month', v.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')
                                  = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')
                                ${sucursal_id ? `AND v.sucursal_id = $2` : ''}
        WHERE a.deleted_at IS NULL AND a.activo = TRUE
        GROUP BY a.id, a.nombre, a.codigo, cat.nombre
        ORDER BY total_unidades ASC, a.nombre ASC
        LIMIT $1
      `, params),
    ]);

    const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    res.json({
      mes,
      mas_vendidos:   masVendidos.rows,
      menos_vendidos: menosVendidos.rows,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/articulos/:id — artículo individual con precio_lista correcto ───
// Debe ir después de /alicuotas y después de / para no interceptar esas rutas.
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lista_id } = req.query;

    const listaJoin       = lista_id
      ? `LEFT JOIN lista_precio_items lpi ON lpi.articulo_id = a.id AND lpi.lista_id = $2`
      : '';
    const precioListaExpr = lista_id
      ? 'COALESCE(lpi.precio_efectivo, a.precio_madre) AS precio_lista'
      : 'a.precio_madre AS precio_lista';
    const params = lista_id ? [id, lista_id] : [id];

    const { rows } = await pool.query(`
      SELECT
        a.id, a.codigo, a.nombre,
        a.precio_madre, a.costo_base, a.costo_flete, a.margen_aplicado, a.activo,
        a.alicuota_iva_id,
        ai.porcentaje  AS alicuota_porcentaje,
        c.id           AS categoria_id,
        c.nombre       AS categoria,
        ${precioListaExpr},
        COALESCE(st.stock_total, 0)::numeric AS stock_total,
        COALESCE(st.stock_bajo, FALSE)        AS stock_bajo,
        st.stock_detalle
      FROM articulos a
      LEFT JOIN categorias    c  ON c.id  = a.categoria_id
      LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
      ${listaJoin}
      LEFT JOIN (
        SELECT
          s.articulo_id,
          SUM(s.cantidad)::numeric                                              AS stock_total,
          BOOL_OR(s.cantidad <= s.stock_minimo AND s.stock_minimo > 0)         AS stock_bajo,
          JSON_AGG(JSON_BUILD_OBJECT(
            'sucursal_id', s.sucursal_id,
            'sucursal_nombre', su.nombre,
            'cantidad', s.cantidad,
            'stock_minimo', s.stock_minimo
          ) ORDER BY su.nombre)                                                 AS stock_detalle
        FROM stock s
        JOIN sucursales su ON su.id = s.sucursal_id
        WHERE s.articulo_id = $1
        GROUP BY s.articulo_id
      ) st ON st.articulo_id = a.id
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `, params);

    if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json({ articulo: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
