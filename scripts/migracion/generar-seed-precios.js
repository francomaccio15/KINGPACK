/**
 * Genera el seed SQL de actualización de precios a partir del Excel corregido
 * por el cliente (KingPack-Articulos-Correccion.xlsx).
 *
 * Salida: backend/db/seeds/020_actualizar_precios.sql
 *
 * El cliente cargó, por artículo: Costo (CON IVA), flete %, y Precio Venta
 * (CON IVA). El sistema guarda el costo NETO y reconstruye el precio con el
 * trigger. Por eso:
 *   costo_base      = round(costo_excel / 1.21, 2)        (neto)
 *   costo_flete     = flete %
 *   margen_aplicado = round( F / (costo_base*(1+flete/100)*1.21) - 1, 2) * 100
 * El trigger fn_trg_actualizar_precio_madre recalcula precio_madre (= F) y
 * cascada a lista_precio_items.
 *
 * Reglas:
 *  - Mapeo por NOMBRE (la columna de código quedó vacía).
 *  - Filas sin costo/precio o basura → se saltan.
 *  - Margen > 999.99 (no entra en numeric(5,2)) → NO se actualiza, se reporta
 *    (queda con su valor actual para revisión del cliente).
 *  - Los artículos activos que el cliente sacó del Excel → se desactivan.
 *
 * Uso:  node scripts/migracion/generar-seed-precios.js
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const ORIGEN = path.join(__dirname, '..', '..', 'KingPack-Articulos-Correccion.xlsx');
const SALIDA = path.join(__dirname, '..', '..', 'backend', 'db', 'seeds', '020_actualizar_precios.sql');

const IVA = 21;
const MARGEN_MAX = 999.99; // tope de numeric(5,2)

const r2 = (x) => Math.round(x * 100) / 100;

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

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const norm = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
const sql = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

async function main() {
  console.log(`Leyendo ${ORIGEN} ...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);
  const ws = wb.getWorksheet('Articulos');
  if (!ws) throw new Error('No se encontró la hoja Articulos');

  const updates = [];      // { nombre, costoBase, flete, margen }
  const keepNames = [];    // nombres normalizados que el cliente conservó (no desactivar)
  const salteadosMargen = []; // { nombre, costo, precio, margen }
  let sinDatos = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 2);
    if (!nombre) return;                       // fila vacía
    const costo = num(celda(row, 4));
    const flete = num(celda(row, 5)) ?? 0;
    const precio = num(celda(row, 6));
    if (!costo || !precio) { sinDatos++; return; } // basura / sin precio

    keepNames.push(norm(nombre));

    const costoBase = r2(costo / (1 + IVA / 100));
    const base = costoBase * (1 + flete / 100) * (1 + IVA / 100);
    const margen = r2((precio / base - 1) * 100);

    if (margen > MARGEN_MAX) {
      salteadosMargen.push({ nombre: String(nombre), costo, precio, margen });
      return; // no actualizar; el cliente lo revisa en el sistema
    }
    updates.push({ nombre: String(nombre), costoBase, flete, margen });
  });

  console.log(`Updates: ${updates.length} | salteados por margen>999.99: ${salteadosMargen.length} | filas sin costo/precio: ${sinDatos}`);

  // --- Construir SQL ---
  const L = [];
  L.push('-- 020_actualizar_precios.sql');
  L.push('-- Generado por scripts/migracion/generar-seed-precios.js');
  L.push('-- NO editar a mano: regenerar desde el Excel corregido.');
  L.push('--');
  L.push(`-- Actualiza costo_base (neto = costo/1.21), costo_flete y margen_aplicado de ${updates.length} artículos.`);
  L.push('-- El trigger recalcula precio_madre (= precio del Excel) y las listas de precios.');
  L.push(`-- Desactiva los artículos activos que el cliente sacó del Excel.`);
  if (salteadosMargen.length) {
    L.push('-- NO actualizados (margen > 999.99, quedan como están para revisión del cliente):');
    salteadosMargen.forEach((s) => L.push(`--   ${s.nombre}  (costo ${s.costo} / precio ${s.precio} -> margen ${s.margen}%)`));
  }
  L.push('');

  L.push('-- 1. Actualización de precios (por nombre)');
  for (const u of updates) {
    L.push(
      `UPDATE articulos SET costo_base = ${u.costoBase}, costo_flete = ${u.flete}, margen_aplicado = ${u.margen} ` +
      `WHERE upper(trim(nombre)) = ${sql(norm(u.nombre))} AND deleted_at IS NULL;`
    );
  }
  L.push('');
  L.push('-- 2. Desactivar los artículos que el cliente sacó del Excel');
  const keepList = [...new Set(keepNames)].map((k) => sql(k)).join(',\n  ');
  L.push('UPDATE articulos SET activo = false');
  L.push(' WHERE deleted_at IS NULL AND activo = true');
  L.push('   AND upper(trim(nombre)) NOT IN (');
  L.push('  ' + keepList);
  L.push(');');
  L.push('');

  fs.writeFileSync(SALIDA, L.join('\n'), 'utf8');
  console.log(`\nSeed generado: ${SALIDA}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
