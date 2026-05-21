// TODO(fase-2): proteger con JWT — endpoint público temporal.
const express = require('express');
const { pool } = require('../config/db');

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

    // Red accent stripe at the very top
    doc.rect(0, 0, PW, 4).fill('#e3000f');

    // Red vertical bar before logo
    doc.rect(ML, 20, 3, 32).fill('#e3000f');

    // KING PACK
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
       .text('KING PACK', ML + 12, 20);

    // DESCARTABLES
    doc.fillColor('#e3000f').fontSize(9).font('Helvetica-Bold')
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
      doc.fillColor('#e3000f').fontSize(8).font('Helvetica-Bold')
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
        // Red left accent
        doc.rect(ML - 2, curY, 3, 24).fill('#e3000f');
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

// ─── GET /api/articulos ──────────────────────────────────────────────────────
// ?lista_id=UUID   precio_efectivo de esa lista (default: precio_madre)
// ?q=              busca en nombre o código
// ?categoria_id=   filtra por categoría
// ?activo=         'true' (default) | 'false' | 'all'
// ?limit=          max 1000, default 500
// ?offset=         default 0
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria_id, lista_id, sucursal_id, activo = 'true', limit = 500, offset = 0 } = req.query;

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
               (COALESCE(cantidad, 0) <= stock_minimo AND stock_minimo > 0)     AS stock_bajo,
               NULL::json                                                       AS stock_detalle
          FROM stock
         WHERE sucursal_id = $${idx++}
      `;
      joinParamCount++;
    } else {
      stockSubquery = `
        SELECT st.articulo_id,
               SUM(st.cantidad)                                                      AS cantidad_total,
               BOOL_OR(st.cantidad <= st.stock_minimo AND st.stock_minimo > 0)      AS stock_bajo,
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

    const where       = conditions.join(' AND ');
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
          COALESCE(st.stock_bajo,    false)         AS stock_bajo,
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
        `SELECT COUNT(*) FROM articulos a WHERE ${where}`,
        countParams
      ),
    ]);

    res.json({ count: parseInt(countRows[0].count), articulos: rows });
  } catch (err) {
    next(err);
  }
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
        COALESCE(0, 0)::numeric AS stock_total,
        FALSE           AS stock_bajo,
        NULL            AS stock_detalle
      FROM articulos a
      LEFT JOIN categorias    c  ON c.id  = a.categoria_id
      LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
      ${listaJoin}
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `, params);

    if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json({ articulo: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
