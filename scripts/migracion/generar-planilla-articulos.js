/**
 * Genera la planilla de corrección de artículos para el cliente,
 * a partir de la copia del sistema viejo (KingPack.xlsx).
 *
 * Lee las hojas "Articulos", "Datos Stock" y "Categorias" del legacy
 * y marca los problemas de calidad de datos detectados para que el cliente
 * los corrija antes de la migración.
 *
 * Nota: la hoja "Articulos Stock" del legacy (4 depósitos) está vacía — nunca
 * se usó. El stock real está en "Datos Stock" como total único, sin desglose
 * por sucursal. Se incluye como referencia y el cliente reparte el stock
 * entre Laprida y Huaico en columnas vacías.
 *
 * Uso:  node scripts/migracion/generar-planilla-articulos.js
 * Salida: KingPack-Articulos-Correccion.xlsx (raíz del repo, no se commitea)
 */

const path = require('path');
const ExcelJS = require('exceljs');

const ORIGEN = path.join(__dirname, '..', '..', 'KingPack.xlsx');
const SALIDA = path.join(__dirname, '..', '..', 'KingPack-Articulos-Correccion.xlsx');

const IVA_PCT = 21;

// --- Helpers de lectura ---------------------------------------------------

/** Devuelve el valor "crudo" útil de una celda exceljs (string trim o number). */
function celda(row, col) {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    // Fórmulas, rich text, hyperlinks
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if (v.text) return String(v.text).trim();
    return null;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s;
  }
  return v; // number, boolean, Date
}

/** Convierte el Id articulo a string estable, detectando corrupciones. */
function normalizarCodigo(raw) {
  if (raw === null) return { codigo: null, flags: [] };
  const flags = [];
  let codigo;
  if (typeof raw === 'number') {
    // Códigos de barras guardados como número (el legacy los muestra como 7.7983E12)
    codigo = raw.toLocaleString('fullwide', { useGrouping: false });
    if (raw >= 1e11) {
      flags.push('CÓDIGO guardado como número: pueden haberse perdido dígitos del código de barras — verificar contra el producto físico');
    }
  } else {
    codigo = String(raw).trim();
    if (/^\d+(\.\d+)?E\+?\d+$/i.test(codigo)) {
      flags.push('CÓDIGO corrupto en notación científica: se perdieron dígitos del código de barras — verificar contra el producto físico');
    }
  }
  if (/[{}\[\]]/.test(codigo)) {
    flags.push('CÓDIGO con caracteres inválidos ({ } [ ]) — corregir');
  }
  if (/\s/.test(codigo)) {
    flags.push('CÓDIGO contiene espacios — corregir');
  }
  return { codigo, flags };
}

function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// --- Main -----------------------------------------------------------------

async function main() {
  console.log(`Leyendo ${ORIGEN} ...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);

  const hojaArt = wb.getWorksheet('Articulos');
  const hojaDatos = wb.getWorksheet('Datos Stock');
  const hojaCat = wb.getWorksheet('Categorias');
  if (!hojaArt || !hojaDatos || !hojaCat) {
    throw new Error('No se encontraron las hojas esperadas (Articulos / Datos Stock / Categorias)');
  }

  // -- Categorías del legacy
  const categorias = [];
  hojaCat.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 1);
    if (nombre && !categorias.includes(String(nombre))) categorias.push(String(nombre));
  });
  console.log(`Categorías: ${categorias.length}`);

  // -- Stock total por artículo desde "Datos Stock" (col K = Stock disponible)
  // OJO: en esta hoja muchos códigos de barras se guardaron como número con
  // precisión perdida (7798348231783 -> 7798300000000), por lo que artículos
  // distintos colisionan en el mismo código. Se matchea por código solo cuando
  // es unívoco, y si no, por nombre normalizado.
  const normNombre = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  const filasStock = [];
  const stockPorCodigo = new Map(); // codigo -> fila | 'AMBIGUO'
  const stockPorNombre = new Map(); // nombre normalizado -> fila | 'AMBIGUO'
  hojaDatos.eachRow((row, n) => {
    if (n === 1) return;
    const { codigo } = normalizarCodigo(celda(row, 1));
    const nombre = celda(row, 2);
    if (!codigo && !nombre) return;
    const fila = { codigo, nombre, total: num(celda(row, 11)), usado: false };
    filasStock.push(fila);
    if (codigo) {
      stockPorCodigo.set(codigo, stockPorCodigo.has(codigo) ? 'AMBIGUO' : fila);
    }
    const nn = normNombre(nombre);
    if (nn) {
      stockPorNombre.set(nn, stockPorNombre.has(nn) ? 'AMBIGUO' : fila);
    }
  });
  const buscarStock = (codigo, nombre) => {
    const porCodigo = codigo ? stockPorCodigo.get(codigo) : null;
    if (porCodigo && porCodigo !== 'AMBIGUO') return porCodigo;
    const porNombre = stockPorNombre.get(normNombre(nombre));
    if (porNombre && porNombre !== 'AMBIGUO') return porNombre;
    return null;
  };
  console.log(`Filas de stock (Datos Stock): ${filasStock.length}`);

  // -- Artículos
  // Columnas legacy: A=Id, B=Nombre, C=Categoria, D=Margen, E=Costo, F=Precio, G=Precio licitaciones
  const articulos = [];
  const codigosVistos = new Map(); // codigo -> primera fila
  hojaArt.eachRow((row, n) => {
    if (n === 1) return;
    const raw = celda(row, 1);
    const nombre = celda(row, 2);
    if (raw === null && nombre === null) return; // fila vacía
    const { codigo, flags } = normalizarCodigo(raw);

    if (codigo === null) flags.push('SIN CÓDIGO — asignar uno único');
    if (codigo && codigosVistos.has(codigo)) {
      flags.push(`CÓDIGO duplicado (ya aparece en la fila ${codigosVistos.get(codigo)})`);
    } else if (codigo) {
      codigosVistos.set(codigo, n);
    }
    if (codigo === 'OtroArt') flags.push('Artículo placeholder del sistema viejo — definir si se migra o se elimina');

    const categoria = celda(row, 3);
    if (categoria && !categorias.includes(String(categoria))) {
      flags.push('CATEGORÍA no existe en la hoja Categorias — corregir o agregarla');
    }
    if (!categoria) flags.push('SIN CATEGORÍA — completar');

    const costo = num(celda(row, 5));
    if (costo === null || costo === 0) flags.push('COSTO vacío o en cero — completar');

    const stock = buscarStock(codigo, nombre);
    if (stock) stock.usado = true;
    else flags.push('No se encontró su stock en "Datos Stock" del sistema viejo (ni por código ni por nombre) — verificar stock');

    articulos.push({
      codigo,
      nombre: nombre ? String(nombre) : null,
      categoria: categoria ? String(categoria) : null,
      costo,
      precioViejo: num(celda(row, 6)),
      precioLicitaciones: num(celda(row, 7)),
      stockTotalViejo: stock ? stock.total : null,
      flags,
    });
  });

  // -- Filas que están en Datos Stock pero no matchearon con ningún artículo
  for (const s of filasStock) {
    if (s.usado) continue;
    const flags = ['Existe en "Datos Stock" pero NO en la hoja Articulos del sistema viejo — completar datos o eliminar'];
    if (s.codigo && stockPorCodigo.get(s.codigo) === 'AMBIGUO') {
      flags.push('CÓDIGO corrupto/redondeado (compartido con otros artículos) — recargar el código de barras real');
    }
    articulos.push({
      codigo: s.codigo,
      nombre: s.nombre ? String(s.nombre) : null,
      categoria: null,
      costo: null,
      precioViejo: null,
      precioLicitaciones: null,
      stockTotalViejo: s.total,
      flags,
    });
  }

  articulos.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  console.log(`Artículos totales: ${articulos.length}`);

  // -- Estadísticas para la hoja Instrucciones
  const stats = {
    total: articulos.length,
    conFlags: articulos.filter((a) => a.flags.length > 0).length,
    sinCosto: articulos.filter((a) => a.costo === null || a.costo === 0).length,
    sinStock: articulos.filter((a) => a.stockTotalViejo === null).length,
    codigosProblema: articulos.filter((a) => a.flags.some((f) => f.startsWith('CÓDIGO'))).length,
    sinCategoria: articulos.filter((a) => !a.categoria).length,
  };

  // --- Generar salida -------------------------------------------------------

  const out = new ExcelJS.Workbook();

  // == Hoja Instrucciones ==
  const wsInfo = out.addWorksheet('Instrucciones');
  wsInfo.getColumn(1).width = 110;
  const lineas = [
    ['PLANILLA DE CORRECCIÓN DE ARTÍCULOS — KING PACK', true],
    [''],
    ['Esta planilla contiene todos los artículos del sistema viejo. El objetivo es corregir y completar', false],
    ['los datos acá, para después cargarlos automáticamente en el sistema nuevo.', false],
    [''],
    ['QUÉ HAY QUE HACER EN LA HOJA "Articulos":', true],
    ['1. CÓDIGO: debe ser único, sin espacios ni símbolos. Las filas marcadas en rojo tienen códigos con problemas.', false],
    ['2. CATEGORÍA: elegir de la lista desplegable. Si falta una categoría, agregarla primero en la hoja "Categorias".', false],
    ['3. COSTO: completar el costo de compra actual (sin IVA), número sin "$" ni puntos de miles. Usar coma o punto decimal.', false],
    ['4. MARGEN %: completar el porcentaje de ganancia de cada artículo (ej: 40 = 40%).', false],
    ['   El sistema nuevo calcula el precio automáticamente: Precio = Costo × (1 + Margen%) × 1.21 (IVA).', false],
    ['   La columna "Precio resultante" muestra en vivo cómo queda el precio — compararla con "Precio viejo".', false],
    ['5. STOCK LAPRIDA / STOCK HUAICO: repartir el stock real entre las dos sucursales.', false],
    ['   La columna "Stock total (viejo)" muestra el stock que figura en el sistema viejo como referencia,', false],
    ['   pero el sistema viejo NO discrimina por sucursal — por eso hay que cargarlo acá repartido.', false],
    ['6. STOCK MÍNIMO: cantidad a partir de la cual el sistema nuevo avisa "stock bajo". Opcional.', false],
    ['7. ACTIVO: poner "N" en los artículos que ya no se venden y no deben migrarse.', false],
    ['8. OBSERVACIONES: ahí están marcados los problemas detectados automáticamente. Se pueden agregar notas propias.', false],
    [''],
    ['PROBLEMAS DETECTADOS AUTOMÁTICAMENTE:', true],
    [`• Artículos totales: ${stats.total}`, false],
    [`• Con algún problema a revisar: ${stats.conFlags}`, false],
    [`• Con código a corregir (duplicado, corrupto o faltante): ${stats.codigosProblema}`, false],
    [`• Sin costo cargado: ${stats.sinCosto}`, false],
    [`• Sin categoría: ${stats.sinCategoria}`, false],
    [`• Sin dato de stock en el sistema viejo: ${stats.sinStock}`, false],
    [''],
    ['IMPORTANTE: no agregar, eliminar ni renombrar columnas. Se pueden agregar filas nuevas al final', true],
    ['para artículos que falten, completando como mínimo Código, Nombre, Categoría y Costo.', true],
  ];
  for (const [texto, bold] of lineas) {
    const r = wsInfo.addRow([texto]);
    if (bold) r.font = { bold: true };
  }

  // == Hoja Categorias ==
  const wsCat = out.addWorksheet('Categorias');
  wsCat.getColumn(1).width = 45;
  wsCat.addRow(['Nombre categoria']).font = { bold: true };
  for (const c of categorias) wsCat.addRow([c]);
  wsCat.views = [{ state: 'frozen', ySplit: 1 }];

  // == Hoja Articulos ==
  const ws = out.addWorksheet('Articulos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 18 },
    { header: 'Nombre', key: 'nombre', width: 45 },
    { header: 'Categoría', key: 'categoria', width: 28 },
    { header: 'Costo', key: 'costo', width: 12 },
    { header: 'Margen %', key: 'margen', width: 11 },
    { header: 'Precio resultante', key: 'precioResultante', width: 16 },
    { header: 'Precio viejo', key: 'precioViejo', width: 13 },
    { header: 'Precio licitaciones', key: 'precioLic', width: 16 },
    { header: 'Stock total (viejo)', key: 'stockTotalViejo', width: 15 },
    { header: 'Stock Laprida', key: 'stockLaprida', width: 13 },
    { header: 'Stock Huaico', key: 'stockHuaico', width: 13 },
    { header: 'Stock mínimo', key: 'stockMinimo', width: 13 },
    { header: 'Activo', key: 'activo', width: 8 },
    { header: 'Observaciones', key: 'obs', width: 70 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };

  const ROJO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
  const AMARILLO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
  const GRIS = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  articulos.forEach((a, i) => {
    const fila = i + 2;
    const row = ws.addRow({
      codigo: a.codigo,
      nombre: a.nombre,
      categoria: a.categoria,
      costo: a.costo,
      margen: null,
      precioResultante: {
        formula: `IF(OR(D${fila}="",E${fila}=""),"",ROUND(D${fila}*(1+E${fila}/100)*${(1 + IVA_PCT / 100).toString().replace(',', '.')},2))`,
      },
      precioViejo: a.precioViejo,
      precioLic: a.precioLicitaciones,
      stockTotalViejo: a.stockTotalViejo,
      stockLaprida: null,
      stockHuaico: null,
      stockMinimo: null,
      activo: 'S',
      obs: a.flags.join(' | ') || null,
    });

    row.getCell('precioResultante').fill = GRIS;
    row.getCell('stockTotalViejo').fill = GRIS;
    if (a.flags.some((f) => f.startsWith('CÓDIGO') || f.startsWith('SIN CÓDIGO'))) {
      row.getCell('codigo').fill = ROJO;
    }
    if (a.flags.some((f) => f.startsWith('CATEGORÍA') || f.startsWith('SIN CATEGORÍA'))) {
      row.getCell('categoria').fill = ROJO;
    }
    if (a.flags.some((f) => f.startsWith('COSTO'))) {
      row.getCell('costo').fill = ROJO;
    }
    if (a.flags.length > 0) {
      row.getCell('obs').fill = AMARILLO;
    }
  });

  const ultimaFila = articulos.length + 1;

  // Dropdown de categorías (rango con margen para categorías nuevas)
  const rangoCat = `Categorias!$A$2:$A$${categorias.length + 50}`;
  // Dropdown S/N para Activo
  for (let f = 2; f <= ultimaFila; f++) {
    ws.getCell(`C${f}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rangoCat],
      showErrorMessage: true,
      errorTitle: 'Categoría inválida',
      error: 'Elegir una categoría de la lista (o agregarla primero en la hoja Categorias).',
    };
    ws.getCell(`M${f}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"S,N"'],
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Usar S (se migra) o N (no se migra).',
    };
  }

  ws.autoFilter = { from: 'A1', to: `N${ultimaFila}` };

  await out.xlsx.writeFile(SALIDA);
  console.log(`\nPlanilla generada: ${SALIDA}`);
  console.log(`Resumen: ${stats.total} artículos | ${stats.conFlags} con observaciones | ${stats.codigosProblema} códigos a corregir | ${stats.sinCosto} sin costo | ${stats.sinStock} sin stock`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
