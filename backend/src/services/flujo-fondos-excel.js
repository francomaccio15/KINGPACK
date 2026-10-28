const ExcelJS = require('exceljs');

// Planilla del flujo de fondos. Los montos del período van como valor (vienen
// del sistema); totales, netos, margen y proyección van como fórmula para que
// la planilla recalcule si se cambian los supuestos (celdas amarillas).

const FONT = 'Arial';
const MON = '$#,##0;($#,##0);"-"';
const PCT = '0.0%;(0.0%);"-"';
const NUM = '#,##0;(#,##0);"-"';
const AZUL_OSC = 'FF103170';
const CELESTE = 'FFDEEAFD';
const GRIS_TOT = 'FFF0F5FF';

const col = (n) => {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

function hoja(wb, nombre, titulo, subtitulo, anchos, color) {
  const ws = wb.addWorksheet(nombre, { views: [{ showGridLines: false }], properties: { tabColor: { argb: color } } });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  anchos.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.getCell('A1').value = titulo;
  ws.getCell('A1').font = { name: FONT, size: 14, bold: true, color: { argb: 'FF0B1F4A' } };
  ws.getCell('A2').value = subtitulo;
  ws.getCell('A2').font = { name: FONT, size: 9, italic: true, color: { argb: 'FF666666' } };
  return ws;
}

function encabezado(ws, fila, etiquetas) {
  etiquetas.forEach((t, i) => {
    const c = ws.getCell(fila, i + 1);
    c.value = t;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSC } };
    c.alignment = { horizontal: i ? 'center' : 'left', vertical: 'middle', wrapText: true };
  });
  ws.getRow(fila).height = 30;
}

function set(ws, fila, columna, valor, { fmt, bold, color, fill, indent } = {}) {
  const c = ws.getCell(fila, columna);
  c.value = valor;
  c.font = { name: FONT, size: 10, bold: !!bold, color: color ? { argb: color } : undefined };
  if (fmt) c.numFmt = fmt;
  if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  if (indent) c.alignment = { indent };
  return c;
}

const f = (formula, result) => ({ formula, result });

function pintarFila(ws, fila, ncol, fill, conBorde) {
  for (let j = 1; j <= ncol; j++) {
    const c = ws.getCell(fila, j);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    if (conBorde) c.border = { top: { style: 'thin', color: { argb: AZUL_OSC } } };
  }
}

function seccion(ws, fila, texto, ncol) {
  set(ws, fila, 1, texto, { bold: true });
  pintarFila(ws, fila, ncol, CELESTE);
}

const nota = (ws, fila, texto) => set(ws, fila, 1, texto, { color: 'FF666666' }).font = { name: FONT, size: 9, italic: true, color: { argb: 'FF666666' } };

async function generarExcel(d) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KingPack';
  wb.created = new Date();

  const meses = d.periodo.meses;
  const nM = meses.length;
  const cTot = nM + 2;            // columna "Total" de Flujo real
  const ultimoMes = meses[nM - 1];
  const fechaDatos = d.generado.split('-').reverse().join('/');
  const etiqueta = (m) => (m.parcial ? `${m.etiqueta} (al ${String(m.hasta_dia).padStart(2, '0')})` : m.etiqueta);
  const sumaVals = (o) => meses.reduce((s, m) => s + (o[m.mes] || 0), 0);

  // ─── Resumen (se llena al final, cuando se conocen las filas) ───────────────
  const wr = hoja(wb, 'Resumen', 'King Pack — Flujo de fondos: resumen',
    `${meses[0].etiqueta} a ${ultimoMes.etiqueta} (real) y proyección de 6 meses. Datos del sistema al ${fechaDatos}.`, [56, 20], AZUL_OSC);

  // ─── Flujo real ────────────────────────────────────────────────────────────
  const wf = hoja(wb, 'Flujo real', 'King Pack — Flujo de fondos real',
    'Dinero que efectivamente entró y salió, según el sistema. Todas las sucursales. Pesos corrientes.',
    [48, ...meses.map(() => 16), 18], 'FF1A5FD4');
  encabezado(wf, 4, ['Concepto', ...meses.map(etiqueta), 'Total']);
  wf.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];

  let r = 5;
  const filaValores = (ws, fila, concepto, valores, opts = {}) => {
    set(ws, fila, 1, concepto, { indent: 1, bold: opts.bold });
    meses.forEach((m, j) => set(ws, fila, j + 2, valores[m.mes] || 0, { fmt: MON, color: 'FF0000FF' }));
    set(ws, fila, cTot, f(`SUM(B${fila}:${col(nM + 1)}${fila})`, sumaVals(valores)), { fmt: MON, bold: true });
  };
  const filaFormula = (ws, fila, concepto, fx, resultados, opts = {}) => {
    set(ws, fila, 1, concepto, { bold: opts.bold, indent: opts.indent ?? 1 });
    for (let j = 2; j <= cTot; j++) {
      const res = j === cTot ? (opts.totalRes ?? sumaVals(resultados)) : resultados[meses[j - 2].mes];
      set(ws, fila, j, f(fx(col(j), j), res), { fmt: opts.fmt || MON, bold: opts.bold });
    }
    if (opts.fill) pintarFila(ws, fila, cTot, opts.fill, opts.borde);
  };

  seccion(wf, r++, 'INGRESOS', cTot);
  const ing0 = r;
  for (const x of d.flujo.ingresos) filaValores(wf, r++, x.concepto, x.valores);
  const ING = r;
  filaFormula(wf, r++, 'Total ingresos', (c) => `SUM(${c}${ing0}:${c}${ING - 1})`, d.flujo.total_ingresos, { bold: true, fill: GRIS_TOT, borde: true });
  r++;
  seccion(wf, r++, 'EGRESOS', cTot);
  const egr0 = r;
  const filaEgreso = {};
  for (const x of d.flujo.egresos) { filaEgreso[x.concepto] = r; filaValores(wf, r++, x.concepto, x.valores); }
  const EGT = r;
  filaFormula(wf, r++, 'Total egresos', (c) => `SUM(${c}${egr0}:${c}${EGT - 1})`, d.flujo.total_egresos, { bold: true, fill: GRIS_TOT, borde: true });
  r++;
  const NET = r;
  filaFormula(wf, r++, 'FLUJO NETO DEL MES', (c) => `${c}${ING}-${c}${EGT}`, d.flujo.neto, { bold: true, fill: CELESTE, indent: 0 });
  set(wf, r, 1, 'Flujo neto acumulado', { bold: true });
  meses.forEach((m, j) => set(wf, r, j + 2, f(j === 0 ? `B${NET}` : `${col(j + 1)}${r}+${col(j + 2)}${NET}`, d.flujo.acumulado[m.mes]), { fmt: MON, bold: true }));
  r++;
  const filaRetiros = filaEgreso['Retiros de los dueños'];
  const OPE = r;
  const operativo = Object.fromEntries(meses.map((m) => [m.mes, d.flujo.neto[m.mes] + d.flujo.egresos.find((x) => x.concepto === 'Retiros de los dueños').valores[m.mes]]));
  filaFormula(wf, r++, 'Flujo operativo (antes de retiros de los dueños)', (c) => `${c}${NET}+${c}${filaRetiros}`, operativo);
  r++;
  seccion(wf, r++, 'REFERENCIA: VENTAS DEL MES (lo vendido, se cobre o no)', cTot);
  const VEN = r;
  filaValores(wf, r++, 'Ventas del mes (con IVA)', d.flujo.ventas.total);
  const VCC = r;
  filaValores(wf, r++, 'De las cuales, a cuenta corriente', d.flujo.ventas.a_cc);
  const ratio = (a, b) => Object.fromEntries(meses.map((m) => [m.mes, b[m.mes] ? a[m.mes] / b[m.mes] : 0]));
  const totVen = sumaVals(d.flujo.ventas.total);
  filaFormula(wf, r++, '% vendido a crédito', (c) => `IF(${c}${VEN}=0,0,${c}${VCC}/${c}${VEN})`, ratio(d.flujo.ventas.a_cc, d.flujo.ventas.total),
    { fmt: PCT, totalRes: totVen ? sumaVals(d.flujo.ventas.a_cc) / totVen : 0 });
  filaFormula(wf, r++, 'Cobranza / ventas del mes', (c) => `IF(${c}${VEN}=0,0,${c}${ING}/${c}${VEN})`, ratio(d.flujo.total_ingresos, d.flujo.ventas.total),
    { fmt: PCT, totalRes: totVen ? sumaVals(d.flujo.total_ingresos) / totVen : 0 });
  r++;
  nota(wf, r++, 'Los pagos con cheques de terceros endosados cuentan como salida: el cheque ya había entrado como cobro.');
  nota(wf, r++, 'No incluye ventas anuladas, preventas ni pases internos (caja diaria → caja administrativa, depósitos).');

  // ─── Posición actual ───────────────────────────────────────────────────────
  const wp = hoja(wb, 'Posición actual', `King Pack — Posición financiera al ${fechaDatos}`, 'Saldos que muestra el sistema hoy.', [56, 20], 'FF1A5FD4');
  encabezado(wp, 4, ['Rubro', 'Saldo ($)']);
  r = 5;
  seccion(wp, r++, 'DISPONIBILIDADES', 2);
  const d0 = r;
  for (const x of d.posicion.disponibilidades) {
    set(wp, r, 1, x.nombre, { indent: 1 });
    set(wp, r++, 2, x.monto, { fmt: MON, color: 'FF0000FF' });
  }
  const DISP = r;
  set(wp, r, 1, 'Total disponibilidades', { bold: true });
  set(wp, r, 2, f(`SUM(B${d0}:B${r - 1})`, d.posicion.total_disponible), { fmt: MON, bold: true });
  pintarFila(wp, r++, 2, GRIS_TOT, true);
  nota(wp, r++, '(no incluye el efectivo de las cajas diarias abiertas)');
  r++;
  seccion(wp, r++, 'A COBRAR Y A PAGAR', 2);
  const CCC = r;
  set(wp, r, 1, 'Saldo a cobrar de clientes (cuenta corriente)', { indent: 1 });
  set(wp, r++, 2, d.posicion.a_cobrar, { fmt: MON, color: 'FF0000FF' });
  const pv = d.posicion.proveedores;
  const IMP = r;
  set(wp, r, 1, 'Deuda con proveedores — facturado (cuenta corriente)', { indent: 1 });
  set(wp, r++, 2, -pv.facturado, { fmt: MON, color: 'FF0000FF' });
  const ACU = r;
  set(wp, r, 1, 'Deuda con proveedores — no facturado (cuenta corriente)', { indent: 1 });
  set(wp, r++, 2, -pv.no_facturado, { fmt: MON, color: 'FF0000FF' });
  const DEU = r;
  set(wp, r, 1, 'Deuda neta con proveedores', { indent: 1, bold: true });
  set(wp, r++, 2, f(`B${IMP}+B${ACU}`, -d.posicion.deuda_proveedores), { fmt: MON, bold: true });
  const WC = r;
  set(wp, r, 1, 'Capital de trabajo neto (disponible + a cobrar − deuda neta)', { bold: true });
  set(wp, r, 2, f(`B${DISP}+B${CCC}+B${DEU}`, d.posicion.capital_trabajo), { fmt: MON, bold: true });
  pintarFila(wp, r++, 2, CELESTE, true);
  r += 2;

  // Desglose por proveedor
  wp.getColumn(3).width = 22;
  wp.getColumn(4).width = 20;
  set(wp, r++, 1, 'DEUDA CON PROVEEDORES, POR PROVEEDOR', { bold: true });
  encabezado(wp, r++, ['Proveedor', 'Facturado', 'No facturado', 'Neto (+ debés / − a favor)']);
  const pv0 = r;
  for (const x of pv.detalle) {
    set(wp, r, 1, x.proveedor);
    set(wp, r, 2, x.facturado, { fmt: MON, color: 'FF0000FF' });
    set(wp, r, 3, x.no_facturado, { fmt: MON, color: 'FF0000FF' });
    set(wp, r, 4, f(`B${r}+C${r}`, x.neto), { fmt: MON });
    r++;
  }
  set(wp, r, 1, 'Deuda neta', { bold: true });
  [2, 3, 4].forEach((j) => set(wp, r, j, f(`SUM(${col(j)}${pv0}:${col(j)}${r - 1})`,
    j === 2 ? pv.facturado : j === 3 ? pv.no_facturado : d.posicion.deuda_proveedores), { fmt: MON, bold: true }));
  pintarFila(wp, r++, 4, GRIS_TOT, true);
  set(wp, r, 1, 'Se debe (proveedores con neto positivo)', { indent: 1 });
  set(wp, r++, 4, f(`SUMIF(D${pv0}:D${r - 2},">0")`, pv.a_pagar), { fmt: MON });
  set(wp, r, 1, 'Saldo a favor (proveedores con neto negativo)', { indent: 1 });
  set(wp, r++, 4, f(`-SUMIF(D${pv0}:D${r - 3},"<0")`, pv.a_favor), { fmt: MON });
  nota(wp, r++, 'Saldo de la cuenta corriente de cada proveedor: el mismo que muestra la pestaña Proveedores.');

  // ─── Proyección ────────────────────────────────────────────────────────────
  const pr = d.proyeccion;
  const nP = pr.meses.length;
  const wpr = hoja(wb, 'Proyección', `King Pack — Proyección del flujo de fondos (${nP} meses)`,
    `Parte del promedio real de ${pr.supuestos.base_meses.join(', ')} y lo ajusta por los supuestos. Las celdas amarillas se pueden cambiar.`,
    [48, 18, ...pr.meses.map(() => 15), 18], 'FF0EA5E9');
  set(wpr, 4, 1, 'SUPUESTOS', { bold: true });
  const supuesto = (fila, txt, valor, fmt, comentario) => {
    set(wpr, fila, 1, txt);
    const c = set(wpr, fila, 2, valor, { fmt, color: 'FF0000FF', fill: 'FFFFFF00' });
    c.note = comentario;
  };
  supuesto(5, 'Inflación mensual estimada', pr.supuestos.inflacion, PCT, 'Supuesto editable, no sale del sistema.');
  supuesto(6, 'Crecimiento real mensual de la actividad', pr.supuestos.crecimiento, PCT, 'Supuesto editable. 0% = mismo volumen que el promedio actual.');
  set(wpr, 7, 1, 'Saldo inicial: total disponibilidades hoy');
  set(wpr, 7, 2, f(`'Posición actual'!B${DISP}`, pr.supuestos.saldo_inicial), { fmt: MON, color: 'FF008000' });
  nota(wpr, 8, 'Amarillo = supuesto que podés cambiar. Verde = viene de otra hoja. La base de cada concepto es el promedio de los meses indicados (el mes en curso, llevado a mes completo).');

  const H = 10;
  encabezado(wpr, H, ['Concepto', 'Base mensual', ...pr.meses.map((m) => m.etiqueta), `Total ${nP} meses`]);
  const cPT = nP + 3;
  r = H + 1;
  const filaProy = (x) => {
    set(wpr, r, 1, x.concepto, { indent: 1 });
    set(wpr, r, 2, x.base, { fmt: MON, color: 'FF0000FF' });
    pr.meses.forEach((m, i) => set(wpr, r, i + 3, f(`$B${r}*((1+$B$5)*(1+$B$6))^${i + 1}`, x.valores[m.mes]), { fmt: MON }));
    set(wpr, r, cPT, f(`SUM(C${r}:${col(nP + 2)}${r})`, pr.meses.reduce((s, m) => s + x.valores[m.mes], 0)), { fmt: MON, bold: true });
    r++;
  };
  const totalProy = (desde, hasta, label) => {
    set(wpr, r, 1, label, { bold: true });
    for (let j = 2; j <= cPT; j++) set(wpr, r, j, { formula: `SUM(${col(j)}${desde}:${col(j)}${hasta})` }, { fmt: MON, bold: true });
    pintarFila(wpr, r, cPT, GRIS_TOT, true);
    return r++;
  };
  seccion(wpr, r++, 'INGRESOS', cPT);
  let p0 = r;
  pr.ingresos.forEach(filaProy);
  const PING = totalProy(p0, r - 1, 'Total ingresos');
  r++;
  seccion(wpr, r++, 'EGRESOS', cPT);
  p0 = r;
  pr.egresos.forEach(filaProy);
  const PEGR = totalProy(p0, r - 1, 'Total egresos');
  r++;
  const PNET = r;
  set(wpr, r, 1, 'FLUJO NETO DEL MES', { bold: true });
  for (let j = 2; j <= cPT; j++) set(wpr, r, j, { formula: `${col(j)}${PING}-${col(j)}${PEGR}` }, { fmt: MON, bold: true });
  pintarFila(wpr, r++, cPT, CELESTE);
  const PINI = r++, PFIN = r++;
  set(wpr, PINI, 1, 'Disponibilidades al inicio del mes');
  set(wpr, PFIN, 1, 'Disponibilidades al cierre del mes', { bold: true });
  pr.meses.forEach((m, i) => {
    const c = col(i + 3);
    set(wpr, PINI, i + 3, f(i === 0 ? '$B$7' : `${col(i + 2)}${PFIN}`, pr.inicio[m.mes]), { fmt: MON });
    set(wpr, PFIN, i + 3, f(`${c}${PINI}+${c}${PNET}`, pr.cierre[m.mes]), { fmt: MON, bold: true });
  });
  r++;
  nota(wpr, r++, 'No suma de golpe la deuda con proveedores ni el saldo a cobrar: esos saldos ya se van pagando y cobrando dentro del flujo mensual.');
  wpr.views = [{ state: 'frozen', xSplit: 2, ySplit: H, showGridLines: false }];

  // ─── Productos ─────────────────────────────────────────────────────────────
  const pd = d.productos;
  const wpc = hoja(wb, 'Productos', 'King Pack — Ventas y margen por producto',
    'Ventas confirmadas y facturadas. Margen con el costo actual de cada artículo × (1 + flete%), sin IVA.',
    [40, 16, 16, 16, 18, 18, 14, 16, 16], 'FF10B981');
  r = 4;
  set(wpc, r++, 1, 'MARGEN POR CATEGORÍA', { bold: true });
  encabezado(wpc, r++, ['Categoría', 'Venta con IVA', 'IVA', 'Venta neta', 'Costo estimado', 'Margen bruto', 'Margen %', 'Peso en ventas', 'Peso en margen']);
  const m0 = r;
  const mT = m0 + pd.categorias.length;
  const margenTot = pd.venta_neta_total - pd.costo_total;
  for (const c of pd.categorias) {
    set(wpc, r, 1, c.categoria);
    set(wpc, r, 2, c.venta_iva, { fmt: MON, color: 'FF0000FF' });
    set(wpc, r, 3, c.iva, { fmt: MON, color: 'FF0000FF' });
    set(wpc, r, 4, f(`B${r}-C${r}`, c.venta_neta), { fmt: MON });
    set(wpc, r, 5, c.costo, { fmt: MON, color: 'FF0000FF' });
    set(wpc, r, 6, f(`D${r}-E${r}`, c.margen), { fmt: MON });
    set(wpc, r, 7, f(`IF(D${r}=0,0,F${r}/D${r})`, c.margen_pct), { fmt: PCT });
    set(wpc, r, 8, f(`IF($D$${mT}=0,0,D${r}/$D$${mT})`, pd.venta_neta_total ? c.venta_neta / pd.venta_neta_total : 0), { fmt: PCT });
    set(wpc, r, 9, f(`IF($F$${mT}=0,0,F${r}/$F$${mT})`, margenTot ? c.margen / margenTot : 0), { fmt: PCT });
    r++;
  }
  set(wpc, r, 1, 'Total', { bold: true });
  [2, 3, 4, 5, 6].forEach((j) => set(wpc, r, j, { formula: `SUM(${col(j)}${m0}:${col(j)}${r - 1})` }, { fmt: MON, bold: true }));
  set(wpc, r, 7, f(`IF(D${r}=0,0,F${r}/D${r})`, pd.margen_pct), { fmt: PCT, bold: true });
  [8, 9].forEach((j) => set(wpc, r, j, { formula: `SUM(${col(j)}${m0}:${col(j)}${r - 1})` }, { fmt: PCT, bold: true }));
  pintarFila(wpc, r, 9, GRIS_TOT, true);
  r += 3;

  set(wpc, r++, 1, 'VENTAS CON IVA POR CATEGORÍA Y MES', { bold: true });
  encabezado(wpc, r++, ['Categoría', ...meses.map(etiqueta), 'Total']);
  for (let j = 2; j <= cTot; j++) if (!wpc.getColumn(j).width || wpc.getColumn(j).width < 16) wpc.getColumn(j).width = 16;
  const k0 = r;
  for (const c of pd.categorias) {
    set(wpc, r, 1, c.categoria);
    meses.forEach((m, j) => set(wpc, r, j + 2, c.por_mes[m.mes] || 0, { fmt: MON, color: 'FF0000FF' }));
    set(wpc, r, cTot, f(`SUM(B${r}:${col(nM + 1)}${r})`, c.venta_iva), { fmt: MON, bold: true });
    r++;
  }
  set(wpc, r, 1, 'Total', { bold: true });
  for (let j = 2; j <= cTot; j++) set(wpc, r, j, { formula: `SUM(${col(j)}${k0}:${col(j)}${r - 1})` }, { fmt: MON, bold: true });
  pintarFila(wpc, r, cTot, GRIS_TOT, true);
  r += 3;

  set(wpc, r++, 1, `LOS ${pd.top_articulos.length} ARTÍCULOS QUE MÁS VENDEN (venta neta)`, { bold: true });
  encabezado(wpc, r++, ['Artículo', 'Código', 'Categoría', 'Bultos', 'Venta neta', 'Costo estimado', 'Margen bruto', 'Margen %', 'Peso en ventas']);
  for (const a of pd.top_articulos) {
    set(wpc, r, 1, a.articulo);
    set(wpc, r, 2, a.codigo);
    set(wpc, r, 3, a.categoria);
    set(wpc, r, 4, a.bultos, { fmt: NUM, color: 'FF0000FF' });
    set(wpc, r, 5, a.venta_neta, { fmt: MON, color: 'FF0000FF' });
    set(wpc, r, 6, a.costo, { fmt: MON, color: 'FF0000FF' });
    set(wpc, r, 7, f(`E${r}-F${r}`, a.margen), { fmt: MON });
    set(wpc, r, 8, f(`IF(E${r}=0,0,G${r}/E${r})`, a.margen_pct), { fmt: PCT });
    set(wpc, r, 9, f(`IF($D$${mT}=0,0,E${r}/$D$${mT})`, pd.venta_neta_total ? a.venta_neta / pd.venta_neta_total : 0), { fmt: PCT });
    r++;
  }
  r++;
  nota(wpc, r++, 'El sistema no guarda el costo de cada venta: se usa el costo de hoy. Si un artículo aumentó, el margen de los meses viejos sale más bajo que el real.');

  // ─── Resumen ───────────────────────────────────────────────────────────────
  const T = col(cTot);
  const sumaV = (o) => sumaVals(o);
  const totIng = sumaV(d.flujo.total_ingresos), totEgr = sumaV(d.flujo.total_egresos);
  const items = [
    [`REAL (${meses[0].etiqueta} a ${etiqueta(ultimoMes)})`],
    ['Total cobrado', `'Flujo real'!${T}${ING}`, totIng, MON],
    ['Total pagado', `'Flujo real'!${T}${EGT}`, totEgr, MON],
    ['Flujo neto del período', `'Flujo real'!${T}${NET}`, totIng - totEgr, MON],
    ['Flujo operativo (antes de retiros de los dueños)', `'Flujo real'!${T}${OPE}`, sumaV(operativo), MON],
    ['Ventas del período (con IVA)', `'Flujo real'!${T}${VEN}`, totVen, MON],
    ['% de las ventas hechas a cuenta corriente', `'Flujo real'!${T}${VCC + 1}`, totVen ? sumaV(d.flujo.ventas.a_cc) / totVen : 0, PCT],
    ['Margen bruto estimado sobre venta neta', `Productos!G${mT}`, pd.margen_pct, PCT],
    [],
    ['POSICIÓN HOY'],
    ['Disponibilidades (bancos, cajas fuertes, caja adm., cheques)', `'Posición actual'!B${DISP}`, d.posicion.total_disponible, MON],
    ['A cobrar de clientes', `'Posición actual'!B${CCC}`, d.posicion.a_cobrar, MON],
    ['Deuda neta con proveedores', `'Posición actual'!B${DEU}`, -d.posicion.deuda_proveedores, MON],
    ['Capital de trabajo neto', `'Posición actual'!B${WC}`, d.posicion.capital_trabajo, MON],
    [],
    [`PROYECCIÓN (${pr.meses[0].etiqueta} a ${pr.meses[nP - 1].etiqueta})`],
    [`Flujo neto proyectado ${nP} meses`, `'Proyección'!${col(cPT)}${PNET}`, pr.meses.reduce((s, m) => s + pr.neto[m.mes], 0), MON],
    ['Disponibilidades proyectadas al final', `'Proyección'!${col(nP + 2)}${PFIN}`, pr.cierre[pr.meses[nP - 1].mes], MON],
    ['Peor mes proyectado (disponibilidades al cierre)', `MIN('Proyección'!C${PFIN}:${col(nP + 2)}${PFIN})`, Math.min(...pr.meses.map((m) => pr.cierre[m.mes])), MON],
  ];
  r = 4;
  for (const [label, fx, res, fmt] of items) {
    if (label && !fx) { set(wr, r, 1, label, { bold: true }); pintarFila(wr, r, 2, CELESTE); }
    else if (label) {
      set(wr, r, 1, label, { indent: 1 });
      set(wr, r, 2, f(fx, res), { fmt, bold: true, color: 'FF008000' });
    }
    r++;
  }
  r++;
  for (const t of [
    'Ingresos = cobros de contado de ventas + cobranzas de cuenta corriente. Las ventas a cuenta corriente entran cuando el cliente paga.',
    'Egresos = pagos a proveedores (facturas y pagos a cuenta) + gastos, sueldos, impuestos y retiros, en la fecha en que se pagaron.',
    'Hojas: Flujo real · Posición actual · Proyección (supuestos en amarillo) · Productos.',
  ]) nota(wr, r++, t);

  return wb.xlsx.writeBuffer();
}

module.exports = { generarExcel };
