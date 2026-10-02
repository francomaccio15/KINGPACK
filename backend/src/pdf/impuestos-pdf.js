// =============================================================================
// PDF del módulo Impuestos — Libro IVA Ventas, Libro IVA Compras y Posición IVA
//
// Genera documentos A4 (apaisado para los libros, vertical para la posición)
// con el encabezado institucional de KING PACK, fila de totales y numeración
// de páginas. Pensados para entregar al contador.
// =============================================================================

const PDFDocument = require('pdfkit');

// ─── Formatos ────────────────────────────────────────────────────────────────
const nf = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : nf.format(n);
};

const fecha = (v) => {
  if (!v) return '—';
  const iso = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const mesLargo = (periodo) => {
  const [y, m] = String(periodo).split('-');
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};

const TIPO_COMPROBANTE = {
  factura_a: 'Factura A',   factura_b: 'Factura B',   factura_c: 'Factura C',
  nota_debito_a: 'N. Débito A',  nota_debito_b: 'N. Débito B',  nota_debito_c: 'N. Débito C',
  nota_credito_a: 'N. Crédito A', nota_credito_b: 'N. Crédito B', nota_credito_c: 'N. Crédito C',
  informal: 'Informal',
};

const slug = (s) => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── Primitivas de dibujo ────────────────────────────────────────────────────
const ML = 28;  // margen izquierdo
const MR = 28;  // margen derecho
const HEADER_H = 64;
const FOOTER_RESERVA = 34;

function dibujarEncabezado(doc, { titulo, subtitulo, sucursal }) {
  const PW = doc.page.width;

  doc.rect(0, 0, PW, HEADER_H).fill('#111111');
  doc.rect(0, 0, PW, 3).fill('#c62828');
  doc.rect(ML, 15, 3, 26).fill('#c62828');

  doc.fillColor('#ffffff').fontSize(17).font('Helvetica-Bold')
     .text('KING PACK', ML + 11, 15, { lineBreak: false });

  doc.fillColor('#bbbbbb').fontSize(8).font('Helvetica-Bold')
     .text(titulo.toUpperCase(), ML + 11, 37, { lineBreak: false });

  if (subtitulo) {
    doc.fillColor('#888888').fontSize(8).font('Helvetica')
       .text(subtitulo, ML + 11, 49, { lineBreak: false });
  }

  const emitido = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
     .text(`Emitido: ${emitido}`, 0, 18, { align: 'right', width: PW - MR });
  doc.fillColor('#888888').fontSize(7.5).font('Helvetica')
     .text(`Sucursal: ${sucursal}`, 0, 30, { align: 'right', width: PW - MR });
}

/**
 * Renderiza una tabla paginada.
 * columns: [{ key, label, width, align, bold }]
 * rows:    array de objetos ya formateados a string
 * totales: objeto opcional con las mismas keys (se dibuja como fila destacada)
 */
function dibujarTabla(doc, { columns: cols, rows, totales, encabezado }) {
  let columns = cols;
  const PW = doc.page.width;
  const PH = doc.page.height;
  const ROW_H = 15;
  const HDR_H = 17;

  // Si los anchos declarados exceden el ancho útil, se escalan proporcionalmente
  // para que ninguna columna se salga de la hoja.
  const disponible = PW - ML - MR;
  const sumaAnchos = columns.reduce((s, c) => s + c.width, 0);
  if (sumaAnchos > disponible) {
    const factor = disponible / sumaAnchos;
    columns = columns.map((c) => ({ ...c, width: c.width * factor }));
  }

  // Posición X de cada columna
  const xs = [];
  let acc = ML;
  for (const c of columns) { xs.push(acc); acc += c.width; }

  const celda = (col, i, y, valor, opts = {}) => {
    const w = col.width - 4;
    doc.text(valor == null ? '' : String(valor), xs[i] + 2, y, {
      width: w,
      align: col.align || 'left',
      lineBreak: false,
      ellipsis: true,
      ...opts,
    });
  };

  const dibujarHeaderTabla = (y) => {
    doc.rect(ML, y, PW - ML - MR, HDR_H).fill('#ebebeb');
    doc.fillColor('#444444').fontSize(6.5).font('Helvetica-Bold');
    columns.forEach((c, i) => celda(c, i, y + 5.5, c.label.toUpperCase()));
    doc.strokeColor('#bbbbbb').lineWidth(0.6)
       .moveTo(ML, y + HDR_H).lineTo(PW - MR, y + HDR_H).stroke();
    return y + HDR_H + 1;
  };

  let y = dibujarHeaderTabla(HEADER_H + 8);
  let i = 0;

  for (const r of rows) {
    if (y + ROW_H > PH - FOOTER_RESERVA) {
      doc.addPage();
      dibujarEncabezado(doc, encabezado);
      y = dibujarHeaderTabla(HEADER_H + 8);
      i = 0;
    }

    if (i % 2 === 1) doc.rect(ML, y, PW - ML - MR, ROW_H).fill('#f7f7f7');

    doc.fillColor('#1a1a1a').fontSize(7).font('Helvetica');
    columns.forEach((c, idx) => {
      doc.font(c.bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.fillColor(c.muted ? '#777777' : '#1a1a1a');
      celda(c, idx, y + 4.5, r[c.key]);
    });

    doc.strokeColor('#e6e6e6').lineWidth(0.4)
       .moveTo(ML, y + ROW_H).lineTo(PW - MR, y + ROW_H).stroke();

    y += ROW_H;
    i++;
  }

  // ── Fila de totales
  if (totales) {
    if (y + ROW_H + 6 > PH - FOOTER_RESERVA) {
      doc.addPage();
      dibujarEncabezado(doc, encabezado);
      y = dibujarHeaderTabla(HEADER_H + 8);
    }
    y += 2;
    doc.rect(ML, y, PW - ML - MR, ROW_H + 4).fill('#111111');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    columns.forEach((c, idx) => celda(c, idx, y + 6, totales[c.key]));
    y += ROW_H + 4;
  }

  return y;
}

function dibujarPiePaginas(doc, nota) {
  const PW = doc.page.width;
  const PH = doc.page.height;
  const total = doc.bufferedPageRange().count;

  for (let p = 0; p < total; p++) {
    doc.switchToPage(p);
    doc.strokeColor('#dddddd').lineWidth(0.5)
       .moveTo(ML, PH - 26).lineTo(PW - MR, PH - 26).stroke();
    if (nota) {
      doc.fillColor('#999999').fontSize(6.5).font('Helvetica')
         .text(nota, ML, PH - 20, { width: PW - ML - MR - 70, lineBreak: false });
    }
    doc.fillColor('#999999').fontSize(6.5).font('Helvetica')
       .text(`Página ${p + 1} de ${total}`, 0, PH - 20, { align: 'right', width: PW - MR });
  }
}

// ─── Libro IVA Ventas ────────────────────────────────────────────────────────
function pdfLibroVentas(res, { ventas, totales, desde, hasta, sucursal }) {
  const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape', bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="libro-iva-ventas-${desde}-a-${hasta}.pdf"`);
  doc.pipe(res);

  const encabezado = {
    titulo: 'Libro IVA Ventas',
    subtitulo: `Período ${fecha(desde)} al ${fecha(hasta)}`,
    sucursal,
  };
  dibujarEncabezado(doc, encabezado);

  const columns = [
    // Suma de anchos = 784 pt (A4 apaisado útil ≈ 786 pt)
    { key: 'fecha',       label: 'Fecha',       width: 48 },
    { key: 'comprobante', label: 'Comprobante', width: 100 },
    { key: 'cliente',     label: 'Cliente',     width: 128 },
    { key: 'cuit',        label: 'CUIT',        width: 62 },
    { key: 'cond_iva',    label: 'Cond. IVA',   width: 70, muted: true },
    { key: 'neto_21',     label: 'Neto 21%',    width: 64, align: 'right' },
    { key: 'iva_21',      label: 'IVA 21%',     width: 60, align: 'right' },
    { key: 'neto_105',    label: 'Neto 10,5%',  width: 64, align: 'right' },
    { key: 'iva_105',     label: 'IVA 10,5%',   width: 60, align: 'right' },
    { key: 'exento',      label: 'Exento',      width: 56, align: 'right' },
    { key: 'total',       label: 'Total',       width: 72, align: 'right', bold: true },
  ];

  const rows = ventas.map((v) => {
    const comprobante = v.cae
      ? `${v.tipo_comprobante || 'Factura'} ${String(v.punto_venta).padStart(5, '0')}-${String(v.factura_numero).padStart(8, '0')}`
      : `Venta #${v.numero} (sin CAE)`;
    return {
      fecha:       fecha(v.fecha),
      comprobante,
      cliente:     v.cliente_nombre,
      cuit:        v.cliente_cuit,
      cond_iva:    v.cond_iva,
      neto_21:     num(v.neto_21),
      iva_21:      num(v.iva_21),
      neto_105:    num(v.neto_105),
      iva_105:     num(v.iva_105),
      exento:      num(v.neto_exento),
      total:       num(v.total),
    };
  });

  dibujarTabla(doc, {
    columns, rows, encabezado,
    totales: {
      fecha: '', comprobante: `TOTALES (${ventas.length} comprobantes)`, cliente: '', cuit: '', cond_iva: '',
      neto_21:  num(totales.neto_21),
      iva_21:   num(totales.iva_21),
      neto_105: num(totales.neto_105),
      iva_105:  num(totales.iva_105),
      exento:   num(totales.neto_exento),
      total:    num(totales.total),
    },
  });

  dibujarPiePaginas(doc,
    'Ventas confirmadas y facturadas. Preventas y anuladas excluidas. Las ventas sin CAE se listan como "sin CAE".');
  doc.end();
}

// ─── Libro IVA Compras ───────────────────────────────────────────────────────
function pdfLibroCompras(res, { compras, totales, credito_fiscal_valido, desde, hasta, sucursal }) {
  const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape', bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `inline; filename="libro-iva-compras-${desde}-a-${hasta}.pdf"`);
  doc.pipe(res);

  const encabezado = {
    titulo: 'Libro IVA Compras',
    subtitulo: `Período ${fecha(desde)} al ${fecha(hasta)}`,
    sucursal,
  };
  dibujarEncabezado(doc, encabezado);

  const columns = [
    // Suma de anchos = 784 pt (A4 apaisado útil ≈ 786 pt)
    { key: 'fecha',       label: 'Fecha',        width: 48 },
    { key: 'comprobante', label: 'Comprobante',  width: 110 },
    { key: 'proveedor',   label: 'Proveedor',    width: 138 },
    { key: 'cuit',        label: 'CUIT',         width: 68 },
    { key: 'neto',        label: 'Neto gravado', width: 66, align: 'right' },
    { key: 'no_gravado',  label: 'No gravado',   width: 60, align: 'right' },
    { key: 'iva_21',      label: 'IVA 21%',      width: 58, align: 'right' },
    { key: 'iva_105',     label: 'IVA 10,5%',    width: 58, align: 'right' },
    { key: 'perc_ib',     label: 'Perc. IIBB',   width: 56, align: 'right' },
    { key: 'otros',       label: 'Otros imp.',   width: 56, align: 'right' },
    { key: 'total',       label: 'Total',        width: 66, align: 'right', bold: true },
  ];

  const rows = compras.map((c) => ({
    fecha:       fecha(c.fecha),
    comprobante: `${TIPO_COMPROBANTE[c.tipo_comprobante] || c.tipo_comprobante} ${c.punto_venta || ''}-${c.numero_comprobante || ''}`.trim(),
    proveedor:   c.proveedor_nombre,
    cuit:        c.sin_cuit ? 'SIN CUIT' : c.proveedor_cuit,
    neto:        num(c.neto_gravado),
    no_gravado:  num(c.neto_no_gravado),
    iva_21:      num(c.iva_21),
    iva_105:     num(c.iva_105),
    perc_ib:     num(c.percepciones_ib),
    otros:       num(c.otros_impuestos),
    total:       num(c.total),
  }));

  let y = dibujarTabla(doc, {
    columns, rows, encabezado,
    totales: {
      fecha: '', comprobante: `TOTALES (${compras.length} comprobantes)`, proveedor: '', cuit: '',
      neto:       num(totales.neto_gravado),
      no_gravado: num(totales.neto_no_gravado),
      iva_21:     num(totales.iva_21),
      iva_105:    num(totales.iva_105),
      perc_ib:    num(totales.percepciones_ib),
      otros:      num(totales.otros_impuestos),
      total:      num(totales.total),
    },
  });

  // Crédito fiscal computable (solo comprobantes con CUIT)
  if (y + 30 < doc.page.height - FOOTER_RESERVA) {
    y += 10;
    doc.fillColor('#444444').fontSize(8).font('Helvetica-Bold')
       .text(`Crédito fiscal computable (solo comprobantes con CUIT): $ ${num(credito_fiscal_valido)}`,
         ML, y, { lineBreak: false });
  }

  dibujarPiePaginas(doc,
    'Solo egresos con comprobante fiscal. Los informales quedan excluidos. Los comprobantes sin CUIT no computan crédito fiscal.');
  doc.end();
}

// ─── Posición IVA ────────────────────────────────────────────────────────────
function pdfPosicionIVA(res, { posicion, ytd, proyeccion_proximo_mes, anio, sucursal }) {
  const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="posicion-iva-${anio}.pdf"`);
  doc.pipe(res);

  const encabezado = {
    titulo: `Posición IVA ${anio}`,
    subtitulo: 'Débito fiscal vs. crédito fiscal por mes',
    sucursal,
  };
  dibujarEncabezado(doc, encabezado);

  const columns = [
    // Suma de anchos = 538 pt (A4 vertical útil ≈ 539 pt)
    { key: 'mes',       label: 'Mes',            width: 96 },
    { key: 'debito',    label: 'Débito fiscal',  width: 92, align: 'right' },
    { key: 'credito',   label: 'Crédito fiscal', width: 92, align: 'right' },
    { key: 'saldo',     label: 'Saldo del mes',  width: 92, align: 'right', bold: true },
    { key: 'acumulado', label: 'Acumulado',      width: 86, align: 'right' },
    { key: 'estado',    label: 'Situación',      width: 80, muted: true },
  ];

  const ESTADO = { a_pagar: 'A pagar', saldo_favor: 'Saldo a favor', neutro: 'Neutro' };

  const rows = posicion.map((p) => ({
    mes:       mesLargo(p.mes),
    debito:    num(p.debito_fiscal),
    credito:   num(p.credito_fiscal),
    saldo:     num(p.saldo_mes),
    acumulado: num(p.saldo_acumulado),
    estado:    ESTADO[p.estado] || p.estado,
  }));

  let y = dibujarTabla(doc, {
    columns, rows, encabezado,
    totales: {
      mes: 'ACUMULADO AÑO',
      debito:    num(ytd.debito_fiscal),
      credito:   num(ytd.credito_fiscal),
      saldo:     num(ytd.saldo_neto),
      acumulado: '',
      estado:    ytd.saldo_neto > 0 ? 'A pagar' : ytd.saldo_neto < 0 ? 'A favor' : 'Neutro',
    },
  });

  // Resumen en tarjetas
  const PW = doc.page.width;
  const CW = PW - ML - MR;
  if (y + 92 < doc.page.height - FOOTER_RESERVA) {
    y += 16;
    const tarjetas = [
      ['Débito fiscal acumulado',  `$ ${num(ytd.debito_fiscal)}`],
      ['Crédito fiscal acumulado', `$ ${num(ytd.credito_fiscal)}`],
      ['Saldo neto del año',       `$ ${num(ytd.saldo_neto)}`],
      ['Proyección próximo mes',   `$ ${num(proyeccion_proximo_mes)}`],
    ];
    const tw = (CW - 3 * 8) / 4;
    tarjetas.forEach(([label, valor], i) => {
      const x = ML + i * (tw + 8);
      doc.rect(x, y, tw, 46).fill('#f4f4f4');
      doc.rect(x, y, 2.5, 46).fill('#c62828');
      doc.fillColor('#777777').fontSize(6.5).font('Helvetica-Bold')
         .text(label.toUpperCase(), x + 8, y + 9, { width: tw - 14, lineBreak: false });
      doc.fillColor('#111111').fontSize(11).font('Helvetica-Bold')
         .text(valor, x + 8, y + 24, { width: tw - 14, lineBreak: false });
    });
    y += 56;
  }

  if (y + 24 < doc.page.height - FOOTER_RESERVA) {
    doc.fillColor('#777777').fontSize(7).font('Helvetica')
       .text('La proyección del próximo mes es el promedio del saldo de los últimos 3 meses con movimiento.',
         ML, y, { width: CW });
  }

  dibujarPiePaginas(doc,
    'Débito fiscal: IVA de ventas confirmadas y facturadas. Crédito fiscal: IVA de compras con comprobante y CUIT.');
  doc.end();
}

module.exports = { pdfLibroVentas, pdfLibroCompras, pdfPosicionIVA, slug };
