/**
 * Genera el seed SQL del catálogo real de artículos a partir de la planilla
 * corregida por el cliente (KingPack-Articulos-Correccion.xlsx).
 *
 * Salida: backend/db/seeds/017_catalogo_real.sql
 *
 * El seed BORRA los datos de prueba (artículos, stock, listas y movimientos
 * de prueba asociados) y carga el catálogo limpio. Lo aplica el runner
 * (backend/db/runner.js) una sola vez, dentro de una transacción.
 *
 * Reglas de mapeo (ver plan):
 *  - Cada fila con NOMBRE = un artículo. Filas sin nombre se saltan.
 *  - El código se GENERA nuevo (KP00001…); el código viejo va a legacy_id.
 *  - Categoría vacía → "OTROS". Se insertan todas las categorías usadas.
 *  - costo_flete = 12 (% sobre el costo) para todos.
 *  - margen_aplicado = NULL (usa el margen de la categoría).
 *  - stock de prueba: 100 en ambas sucursales, mínimo 10.
 *
 * Uso:  node scripts/migracion/generar-seed-catalogo.js
 */

const path = require('path');
const ExcelJS = require('exceljs');

const ORIGEN = path.join(__dirname, '..', '..', 'KingPack-Articulos-Correccion.xlsx');
const SALIDA = path.join(__dirname, '..', '..', 'backend', 'db', 'seeds', '017_catalogo_real.sql');

const FLETE_PCT = 12;
const STOCK_PRUEBA = 100;
const STOCK_MINIMO_PRUEBA = 10;
const MARGEN_DEFAULT_NUEVAS = 40;
const CATEGORIA_FALLBACK = 'OTROS';

function celda(row, col) {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if (v.text) return String(v.text).trim();
    return null;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s;
  }
  return v;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Escapa una cadena para un literal SQL (entre comillas simples). */
function sql(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function codigoLegacy(raw) {
  if (raw === null) return null;
  if (typeof raw === 'number') return raw.toLocaleString('fullwide', { useGrouping: false });
  return String(raw).trim();
}

async function main() {
  console.log(`Leyendo ${ORIGEN} ...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);

  const hojaArt = wb.getWorksheet('Articulos');
  const hojaCat = wb.getWorksheet('Categorias');
  if (!hojaArt || !hojaCat) throw new Error('Faltan las hojas Articulos / Categorias');

  // -- Categorías de la hoja Categorias
  const categoriasExcel = [];
  hojaCat.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 1);
    if (nombre && !categoriasExcel.includes(String(nombre))) categoriasExcel.push(String(nombre));
  });

  // -- Artículos (cada fila con nombre)
  const articulos = [];
  let nextCodigo = 1;
  hojaArt.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 2);
    if (!nombre) return; // fila espaciadora

    const categoria = celda(row, 3) ? String(celda(row, 3)) : CATEGORIA_FALLBACK;
    const costo = num(celda(row, 4));
    const margen = num(celda(row, 5)); // hoy vacío → NULL
    const activoRaw = celda(row, 13);
    const activo = String(activoRaw ?? 'S').toUpperCase() !== 'N';

    articulos.push({
      codigo: 'KP' + String(nextCodigo++).padStart(5, '0'),
      legacy_id: codigoLegacy(celda(row, 1)),
      nombre: String(nombre),
      categoria,
      costo_base: costo ?? 0,
      margen_aplicado: margen, // NULL → margen de la categoría
      activo,
    });
  });

  // -- Unión de categorías: las de la hoja + las usadas por artículos
  const categoriasUsadas = new Set(articulos.map((a) => a.categoria));
  const todasCategorias = [...new Set([...categoriasExcel, ...categoriasUsadas, CATEGORIA_FALLBACK])];

  // -- Estadísticas
  const stats = {
    total: articulos.length,
    sinCosto: articulos.filter((a) => !a.costo_base).length,
    categorias: todasCategorias.length,
  };
  console.log(`Artículos: ${stats.total} | sin costo: ${stats.sinCosto} | categorías: ${stats.categorias}`);

  // --- Construir el SQL --------------------------------------------------

  const L = [];
  L.push('-- 017_catalogo_real.sql');
  L.push('-- Generado por scripts/migracion/generar-seed-catalogo.js');
  L.push('-- NO editar a mano: regenerar desde la planilla corregida.');
  L.push('--');
  L.push(`-- Artículos: ${stats.total} | sin costo (precio_madre = 0): ${stats.sinCosto} | categorías: ${stats.categorias}`);
  L.push('-- Borra los datos de prueba y carga el catálogo real limpio.');
  L.push('-- Códigos generados (KP#####); flete 12%; stock de prueba 100/100, mínimo 10.');
  L.push('');

  // 1. Preservar márgenes de categorías existentes por nombre
  L.push('-- Preservar los márgenes curados de las categorías actuales (por nombre)');
  L.push('CREATE TEMP TABLE _cat_margenes ON COMMIT DROP AS');
  L.push('  SELECT upper(trim(nombre)) AS k, margen_default FROM categorias;');
  L.push('');

  // 2. Borrar datos de prueba
  L.push('-- Borrar datos de prueba (CASCADE limpia artículos, stock, listas, ventas, etc.)');
  L.push('TRUNCATE categorias, ventas, egresos, traspasos, cajas RESTART IDENTITY CASCADE;');
  L.push('');

  // 3. Insertar categorías + restaurar márgenes
  L.push('-- Categorías (unión de la hoja Categorias + las usadas por artículos)');
  const catValues = todasCategorias
    .map((c) => `  (${sql(c)}, ${MARGEN_DEFAULT_NUEVAS})`)
    .join(',\n');
  L.push('INSERT INTO categorias (nombre, margen_default) VALUES');
  L.push(catValues + ';');
  L.push('');
  L.push('-- Restaurar el margen_default de las categorías que ya existían (match por nombre)');
  L.push('UPDATE categorias c');
  L.push('   SET margen_default = m.margen_default');
  L.push('  FROM _cat_margenes m');
  L.push(' WHERE upper(trim(c.nombre)) = m.k;');
  L.push('');

  // 4. Insertar artículos
  L.push('-- Artículos (código nuevo KP#####, legacy_id = código viejo, IVA 21%, flete 12%)');
  L.push('INSERT INTO articulos (codigo, nombre, categoria_id, alicuota_iva_id, costo_base, costo_flete, margen_aplicado, activo, legacy_id)');
  L.push('SELECT');
  L.push('  v.codigo, v.nombre, c.id, a.id, v.costo_base, ' + FLETE_PCT + ', v.margen_aplicado, v.activo, v.legacy_id');
  L.push('FROM (VALUES');
  const artValues = articulos
    .map((a) => {
      const margen = a.margen_aplicado === null ? 'NULL::numeric' : a.margen_aplicado;
      return `  (${sql(a.codigo)}, ${sql(a.nombre)}, ${sql(a.categoria)}, ${a.costo_base}, ${margen}, ${a.activo ? 'TRUE' : 'FALSE'}, ${sql(a.legacy_id)})`;
    })
    .join(',\n');
  L.push(artValues);
  L.push(') AS v(codigo, nombre, categoria, costo_base, margen_aplicado, activo, legacy_id)');
  L.push('JOIN categorias c ON c.nombre = v.categoria');
  L.push('JOIN alicuotas_iva a ON a.codigo_afip = 5;');
  L.push('');

  // 5. Stock de prueba
  L.push('-- Stock de prueba: 100 en ambas sucursales, mínimo 10');
  L.push('INSERT INTO stock (articulo_id, sucursal_id, cantidad, stock_minimo)');
  L.push(`SELECT a.id, s.id, ${STOCK_PRUEBA}, ${STOCK_MINIMO_PRUEBA}`);
  L.push('  FROM articulos a CROSS JOIN sucursales s;');
  L.push('');

  const fs = require('fs');
  fs.writeFileSync(SALIDA, L.join('\n'), 'utf8');
  console.log(`\nSeed generado: ${SALIDA}`);
  console.log(`Resumen: ${stats.total} artículos, ${stats.categorias} categorías, ${stats.sinCosto} sin costo.`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
