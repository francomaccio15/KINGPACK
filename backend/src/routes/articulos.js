// TODO(fase-2): proteger con JWT — endpoint público temporal para validación inicial.
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/articulos/pdf-precios ──────────────────────────────────────────
// Debe ir ANTES de cualquier /:id para que Express no lo interprete como param.
router.get('/pdf-precios', async (req, res, next) => {
  try {
    const descuento = Math.max(0, Math.min(100, parseFloat(req.query.descuento) || 0));

    // Descuentos por categoría: ?desc_cats=uuid1:10,uuid2:15
    const descCatsMap = {};
    if (req.query.desc_cats) {
      req.query.desc_cats.split(',').forEach(part => {
        const [id, pct] = part.split(':');
        if (id && pct !== undefined) descCatsMap[id] = Math.max(0, Math.min(100, parseFloat(pct) || 0));
      });
    }

    const { rows } = await pool.query(`
      SELECT a.codigo, a.nombre, a.precio_madre,
             c.id AS categoria_id, c.nombre AS categoria
        FROM articulos a
        LEFT JOIN categorias c ON c.id = a.categoria_id
       WHERE a.deleted_at IS NULL AND a.activo = true
       ORDER BY c.nombre NULLS LAST, a.nombre
    `);

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="lista-precios-kingpack.pdf"');
    doc.pipe(res);

    const ars = v => new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', minimumFractionDigits: 2
    }).format(v);

    const PAGE_W = doc.page.width - 90; // usable width

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill('#0d0d0d');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('KING PACK', 45, 18);
    doc.fillColor('#e3000f').fontSize(10).font('Helvetica')
       .text('DESCARTABLES', 45, 44);
    doc.fillColor('#8a8a8a').fontSize(9)
       .text('Lista de Precios', 45, 58);

    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.fillColor('#c0c0c0').fontSize(9).font('Helvetica')
       .text(`Fecha: ${fecha}`, 0, 26, { align: 'right', width: doc.page.width - 45 });

    if (descuento > 0) {
      doc.fillColor('#e3000f').fontSize(9)
         .text(`Descuento aplicado: ${descuento}%`, 0, 40, { align: 'right', width: doc.page.width - 45 });
    }

    doc.y = 96;

    // ── Tabla ─────────────────────────────────────────────────────────────────
    let currentCat = null;

    for (const art of rows) {
      // Nueva categoría
      if (art.categoria !== currentCat) {
        currentCat = art.categoria;
        if (doc.y > 730) doc.addPage();

        doc.moveDown(0.6);
        doc.fillColor('#1a1a1a').rect(45, doc.y, PAGE_W, 18).fill();
        doc.fillColor('#e3000f').fontSize(8).font('Helvetica-Bold')
           .text((currentCat || 'SIN CATEGORÍA').toUpperCase(), 50, doc.y + 5);
        doc.y += 22;
      }

      // Fila del artículo
      if (doc.y > 750) doc.addPage();

      const catDescuento = Object.prototype.hasOwnProperty.call(descCatsMap, art.categoria_id)
        ? descCatsMap[art.categoria_id]
        : descuento;

      const precio = parseFloat(art.precio_madre) * (1 - catDescuento / 100);

      const rowY = doc.y;
      doc.fillColor('#2d2d2d').fontSize(8).font('Helvetica')
         .text(art.codigo, 50, rowY, { width: 80 });
      doc.fillColor('#f0f0f0').fontSize(8).font('Helvetica')
         .text(art.nombre, 135, rowY, { width: PAGE_W - 150 });
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text(ars(precio), 0, rowY, { align: 'right', width: doc.page.width - 45 });

      doc.y = rowY + 14;

      // Separador sutil
      doc.strokeColor('#2d2d2d').lineWidth(0.4)
         .moveTo(50, doc.y).lineTo(45 + PAGE_W, doc.y).stroke();
      doc.y += 2;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveDown(1.5);
    doc.strokeColor('#2d2d2d').lineWidth(0.5)
       .moveTo(45, doc.y).lineTo(45 + PAGE_W, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#8a8a8a').fontSize(7.5).font('Helvetica')
       .text('* Precios en pesos argentinos con IVA incluido. Sujetos a modificación sin previo aviso.', 45, doc.y, { width: PAGE_W });
    doc.text('Laprida 270 – Ciudad de Salta · Tel: 3872220486', 45, doc.y + 12, { width: PAGE_W });

    doc.end();
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/articulos ──────────────────────────────────────────────────────
// ?q=          busca en nombre o código (ILIKE)
// ?categoria_id=  filtra por categoría
// ?activo=     'true' (default) | 'false' | 'all'
// ?limit=      max 1000, default 500
// ?offset=     default 0
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria_id, activo = 'true', limit = 500, offset = 0 } = req.query;

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

    const where = conditions.join(' AND ');
    const countParams = [...params];

    params.push(Math.min(parseInt(limit) || 500, 1000));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          a.id, a.codigo, a.nombre,
          a.costo_base, a.costo_flete,
          a.margen_aplicado,
          a.precio_madre,
          a.activo,
          c.id           AS categoria_id,
          c.nombre       AS categoria,
          c.margen_default,
          iv.porcentaje  AS iva_pct,
          COALESCE(st.cantidad_total, 0)::numeric AS stock_total,
          COALESCE(st.stock_bajo, false)           AS stock_bajo
        FROM articulos a
        LEFT JOIN categorias    c  ON c.id  = a.categoria_id
        LEFT JOIN alicuotas_iva iv ON iv.id = a.alicuota_iva_id
        LEFT JOIN (
          SELECT articulo_id,
                 SUM(cantidad)                                      AS cantidad_total,
                 BOOL_OR(cantidad <= stock_minimo AND stock_minimo > 0) AS stock_bajo
            FROM stock
           GROUP BY articulo_id
        ) st ON st.articulo_id = a.id
        WHERE ${where}
        ORDER BY c.nombre NULLS LAST, a.nombre
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM articulos a WHERE ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), articulos: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
