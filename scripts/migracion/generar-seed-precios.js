/**
 * Genera el seed SQL de actualización de precios a partir del Excel corregido.
 *
 * Salida: backend/db/seeds/021_actualizar_precios_fix.sql
 *
 * Mapea por CÓDIGO (KP#####) — NO por nombre — para evitar problemas de
 * normalización (el SQL upper(trim()) no colapsa espacios dobles internos,
 * cosa que sí hace la normalización de JS). Para eso lee un dump de la DB
 * (codigo|nombre) y resuelve cada fila del Excel a su(s) código(s).
 *
 * Reglas (ver plan):
 *   costo_base      = round(costo_excel / 1.21, 2)   (neto; el cliente cargó con IVA)
 *   costo_flete     = flete %
 *   margen_aplicado = round( F / (costo_base*(1+flete/100)*1.21) - 1, 2)*100
 *   - Margen > 999.99 → NO se actualiza (queda como está; lo revisa el cliente).
 *   - Artículos del Excel → quedan activos.
 *   - Artículos de la DB que NO están en el Excel → se desactivan.
 *
 * Uso:  node scripts/migracion/generar-seed-precios.js <ruta_dump_db>
 *   donde el dump es: codigo|nombre por línea (artículos no borrados).
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const ORIGEN = path.join(__dirname, '..', '..', 'KingPack-Articulos-Correccion.xlsx');
const SALIDA = path.join(__dirname, '..', '..', 'backend', 'db', 'seeds', '022_precios_exactos.sql');
const DUMP = process.argv[2];

const IVA = 21;
const MARGEN_MAX = 999.99;
const r2 = (x) => Math.round(x * 100) / 100;
const norm = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

function celda(row, col) {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if (v.text) return String(v.text).trim();
    return null;
  }
  if (typeof v === 'string') { const s = v.trim(); return s === '' ? null : s; }
  return v;
}
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

async function main() {
  if (!DUMP || !fs.existsSync(DUMP)) throw new Error('Falta el dump de la DB (codigo|nombre). Uso: node generar-seed-precios.js <dump>');

  // Mapa nombre normalizado -> [codigos]
  const porNombre = new Map();
  for (const line of fs.readFileSync(DUMP, 'utf8').trim().split(/\r?\n/)) {
    const [codigo, nombre] = line.split('|');
    if (!codigo) continue;
    const k = norm(nombre);
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(codigo);
  }

  console.log(`Leyendo ${ORIGEN} ...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);
  const ws = wb.getWorksheet('Articulos');

  const updates = [];                 // { codigo, costoBase, flete, margen, nombre }
  const matchedCodigos = new Set();   // todos los códigos presentes en el Excel (quedan activos)
  const salteados = [];               // margen > 999.99
  const sinMatch = [];                // filas del Excel sin código en la DB
  let sinDatos = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 2);
    if (!nombre) return;
    const costo = num(celda(row, 4));
    const flete = num(celda(row, 5)) ?? 0;
    const precio = num(celda(row, 6));
    if (!costo || !precio) { sinDatos++; return; }

    const codigos = porNombre.get(norm(nombre));
    if (!codigos) { sinMatch.push(String(nombre)); return; }

    // Margen desde el costo neto "honesto" (costo con IVA / 1.21).
    const costoBase0 = r2(costo / (1 + IVA / 100));
    const margen = r2((precio / (costoBase0 * (1 + flete / 100) * (1 + IVA / 100)) - 1) * 100);

    // Ajustar el costo neto unos centavos para que el precio base (redondeado a
    // entero por fn_calcular_precio_madre) caiga EXACTO en el precio del Excel.
    const K = (1 + flete / 100) * (1 + margen / 100) * (1 + IVA / 100);
    let costoBase = r2(precio / K);
    if (Math.round(costoBase * K) !== precio) {
      // Buscar el costo (±centavos) que da el entero exacto
      for (let d = 1; d <= 5; d++) {
        if (Math.round(r2(costoBase + d / 100) * K) === precio) { costoBase = r2(costoBase + d / 100); break; }
        if (Math.round(r2(costoBase - d / 100) * K) === precio) { costoBase = r2(costoBase - d / 100); break; }
      }
    }

    for (const codigo of codigos) {
      matchedCodigos.add(codigo);     // queda activo aunque saltemos su precio
      if (margen > MARGEN_MAX) {
        salteados.push({ codigo, nombre: String(nombre), costo, precio, margen });
        continue;
      }
      updates.push({ codigo, costoBase, flete, margen, nombre: String(nombre) });
    }
  });

  // Códigos de la DB que NO están en el Excel → desactivar
  const todosCodigos = [...new Set([...porNombre.values()].flat())];
  const desactivar = todosCodigos.filter((c) => !matchedCodigos.has(c));

  console.log(`Updates: ${updates.length} | salteados (margen>999.99): ${salteados.length} | activos: ${matchedCodigos.size} | a desactivar: ${desactivar.length} | sin match en DB: ${sinMatch.length} | sin costo/precio: ${sinDatos}`);

  const L = [];
  L.push('-- 022_precios_exactos.sql');
  L.push('-- Generado por scripts/migracion/generar-seed-precios.js (mapeo por código)');
  L.push('-- Deja el precio base EXACTO al del Excel: ajusta el costo neto unos centavos para');
  L.push('-- que fn_calcular_precio_madre (redondeo a entero, migración 025) dé justo el precio.');
  L.push('-- El trigger AFTER (migración 025) recalcula las listas de precios.');
  L.push('--');
  L.push(`-- Actualiza ${updates.length} artículos | reactiva los del Excel | desactiva ${desactivar.length} que el cliente sacó.`);
  if (salteados.length) {
    L.push('-- NO actualizados (margen > 999.99, los revisa el cliente):');
    salteados.forEach((s) => L.push(`--   ${s.codigo}  ${s.nombre}  (costo ${s.costo}/precio ${s.precio} -> ${s.margen}%)`));
  }
  if (sinMatch.length) {
    L.push('-- Filas del Excel SIN artículo en la DB (ignoradas):');
    sinMatch.forEach((x) => L.push(`--   ${x}`));
  }
  L.push('');
  L.push('-- 1. Precios (costo neto = costo/1.21; el trigger recalcula precio_madre y listas)');
  for (const u of updates) {
    L.push(`UPDATE articulos SET costo_base = ${u.costoBase}, costo_flete = ${u.flete}, margen_aplicado = ${u.margen} WHERE codigo = '${u.codigo}';`);
  }
  L.push('');
  L.push('-- 2. Reactivar los artículos presentes en el Excel');
  L.push(`UPDATE articulos SET activo = true WHERE codigo IN (${[...matchedCodigos].map((c) => `'${c}'`).join(', ')});`);
  L.push('');
  L.push('-- 3. Desactivar los que el cliente sacó del Excel');
  if (desactivar.length) {
    L.push(`UPDATE articulos SET activo = false WHERE codigo IN (${desactivar.map((c) => `'${c}'`).join(', ')});`);
  } else {
    L.push('-- (ninguno)');
  }
  L.push('');

  fs.writeFileSync(SALIDA, L.join('\n'), 'utf8');
  console.log(`\nSeed generado: ${SALIDA}`);
  if (desactivar.length) { console.log('A desactivar:'); desactivar.forEach((c) => console.log('   ', c)); }
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1); });
