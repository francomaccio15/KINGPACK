// TODO(fase-2): proteger con JWT — endpoint público temporal.
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

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
    const { q, categoria_id, lista_id, activo = 'true', limit = 500, offset = 0 } = req.query;

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

    // JOIN condicional para lista de precios
    let listaJoin = '';
    let precioListaExpr = 'a.precio_madre AS precio_lista';
    if (lista_id) {
      params.push(lista_id);
      listaJoin = `LEFT JOIN lista_precio_items lpi ON lpi.articulo_id = a.id AND lpi.lista_id = $${idx++}`;
      precioListaExpr = 'COALESCE(lpi.precio_efectivo, a.precio_madre) AS precio_lista';
    }

    const where       = conditions.join(' AND ');
    const countParams = params.slice(0, lista_id ? -1 : undefined); // sin lista_id para count

    params.push(Math.min(parseInt(limit) || 500, 1000));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          a.id, a.codigo, a.nombre,
          a.precio_madre, a.activo,
          c.id           AS categoria_id,
          c.nombre       AS categoria,
          ${precioListaExpr},
          COALESCE(st.cantidad_total, 0)::numeric  AS stock_total,
          COALESCE(st.stock_bajo,    false)         AS stock_bajo
        FROM articulos a
        LEFT JOIN categorias c   ON c.id  = a.categoria_id
        ${listaJoin}
        LEFT JOIN (
          SELECT articulo_id,
                 SUM(cantidad)                                          AS cantidad_total,
                 BOOL_OR(cantidad <= stock_minimo AND stock_minimo > 0) AS stock_bajo
            FROM stock GROUP BY articulo_id
        ) st ON st.articulo_id = a.id
        WHERE ${where}
        ORDER BY c.nombre NULLS LAST, a.nombre
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

module.exports = router;
