/**
 * Genera el seed SQL de clientes y proveedores reales a partir de la copia
 * fresca del sistema viejo (KingPack.xlsx).
 *
 * Salida: backend/db/seeds/018_clientes_proveedores_real.sql
 *
 * El seed BORRA los datos de prueba de clientes, proveedores y sus
 * movimientos, y carga los datos reales. Lo aplica el runner una sola vez,
 * dentro de una transacción.
 *
 * Reglas de mapeo (ver plan):
 *  - IDs propios (UUID de la DB). NO se importan los Id del Excel; legacy_id = NULL.
 *  - Clientes: hoja "Clientes". Cada fila con nombre = un cliente.
 *      cond IVA: Consumidor final→5, Responsable inscripto→1, IVA excento→4,
 *                Monotributista→6, vacío→5 (Consumidor Final).
 *      Sucursal: Laprida/Huaico directo; "Matias"→Laprida; vacío→NULL.
 *                El texto original siempre va a legacy_sucursal_excel.
 *      CUIT normalizado (solo dígitos); duplicados se OMITEN (primero gana).
 *      lista_precio_id = NULL.
 *  - Proveedores: hoja "Proveedores" (maestra) + los de "Datos proveedores"
 *      que falten por nombre.
 *
 * Uso:  node scripts/migracion/generar-seed-clientes-proveedores.js
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const ORIGEN = path.join(__dirname, '..', '..', 'KingPack.xlsx');
const SALIDA = path.join(__dirname, '..', '..', 'backend', 'db', 'seeds', '018_clientes_proveedores_real.sql');

function celda(row, col) {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
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

function sql(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Normaliza CUIT a solo dígitos (11). Devuelve null si no es válido. */
function normalizarCuit(v) {
  if (v === null || v === undefined) return null;
  const digits = String(typeof v === 'number' ? v.toLocaleString('fullwide', { useGrouping: false }) : v)
    .replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(0, 13) : null;
}

/** Excel serial date o Date → 'YYYY-MM-DD'. */
function fecha(v) {
  if (v === null || v === undefined || v === '') return null;
  let d;
  if (v instanceof Date) {
    d = v;
  } else if (typeof v === 'number') {
    // Serial de Excel (base 1899-12-30)
    d = new Date(Math.round((v - 25569) * 86400 * 1000));
  } else {
    const parsed = new Date(v);
    if (isNaN(parsed.getTime())) return null;
    d = parsed;
  }
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const COND_IVA = {
  'consumidor final': 5,
  'responsable inscripto': 1,
  'iva excento': 4,
  'iva exento': 4,
  'exento': 4,
  'monotributista': 6,
  'monotributo': 6,
};

function condIvaAfip(v) {
  if (!v) return 5; // vacío → Consumidor Final
  const key = String(v).toLowerCase().trim();
  return COND_IVA[key] ?? 5;
}

function mapSucursal(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'laprida') return 'Laprida';
  if (s === 'huaico') return 'Huaico';
  if (s === 'matias') return 'Laprida'; // decisión: Matias → Laprida
  return null;
}

const normNombre = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

async function main() {
  console.log(`Leyendo ${ORIGEN} ...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ORIGEN);

  // ── PROVEEDORES ──────────────────────────────────────────────────────────
  const hojaProv = wb.getWorksheet('Proveedores');
  const hojaProvDatos = wb.getWorksheet('Datos proveedores');
  const proveedores = [];
  const provPorNombre = new Set();

  // Maestra "Proveedores": A=Id, B=Nombre, C=contacto, D=tel, E=mail, F=dir
  hojaProv.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 2);
    if (!nombre) return;
    const key = normNombre(nombre);
    if (provPorNombre.has(key)) return;
    provPorNombre.add(key);
    proveedores.push({
      razon_social: String(nombre),
      telefono: celda(row, 4),
      email: celda(row, 5),
      direccion: celda(row, 6),
    });
  });

  // Completar con "Datos proveedores": A=Nombre, B=contacto, C=tel, D=mail, E=dir
  if (hojaProvDatos) {
    hojaProvDatos.eachRow((row, n) => {
      if (n === 1) return;
      const nombre = celda(row, 1);
      if (!nombre) return;
      const key = normNombre(nombre);
      if (provPorNombre.has(key)) return;
      provPorNombre.add(key);
      proveedores.push({
        razon_social: String(nombre),
        telefono: celda(row, 3),
        email: celda(row, 4),
        direccion: celda(row, 5),
      });
    });
  }

  // ── CLIENTES ─────────────────────────────────────────────────────────────
  // A=Id, B=Cliente, C=Telefono, D=Direccion, E=Descuento, F=CondIVA, G=CUIT,
  // H=Sucursal, K=Fecha saldo 0, L=Saldo inicial
  const hojaCli = wb.getWorksheet('Clientes');
  const clientes = [];
  const cuitsVistos = new Set();
  const ivaDist = {};
  let omitidosCuit = 0;
  let sinSucursal = 0;
  const omitidosDetalle = [];

  hojaCli.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = celda(row, 2);
    if (!nombre) return;

    const cuit = normalizarCuit(celda(row, 7));
    if (cuit && cuitsVistos.has(cuit)) {
      omitidosCuit++;
      omitidosDetalle.push(`${cuit} — ${String(nombre)}`);
      return; // CUIT duplicado: se omite (el primero ya entró)
    }
    if (cuit) cuitsVistos.add(cuit);

    const sucExcel = celda(row, 8);
    const suc = mapSucursal(sucExcel);
    if (!suc) sinSucursal++;

    const ivaAfip = condIvaAfip(celda(row, 6));
    ivaDist[ivaAfip] = (ivaDist[ivaAfip] || 0) + 1;

    // El Excel guarda el descuento como fracción (0.1 = 10%); la DB lo quiere en %.
    const descFrac = num(celda(row, 5)) ?? 0;
    const descuento = Math.round(descFrac * 100 * 100) / 100;

    clientes.push({
      razon_social: String(nombre),
      telefono: celda(row, 3),
      direccion: celda(row, 4),
      descuento,
      iva_afip: ivaAfip,
      cuit,
      sucursal: suc,
      legacy_sucursal_excel: sucExcel ? String(sucExcel) : null,
      fecha_saldo_0: fecha(celda(row, 11)),
      saldo_inicial: num(celda(row, 12)) ?? 0,
    });
  });

  console.log(`Proveedores: ${proveedores.length}`);
  console.log(`Clientes: ${clientes.length} | omitidos por CUIT duplicado: ${omitidosCuit} | sin sucursal: ${sinSucursal}`);
  console.log('Distribución cond IVA (afip):', JSON.stringify(ivaDist));

  // ── Construir SQL ──────────────────────────────────────────────────────────
  const L = [];
  L.push('-- 018_clientes_proveedores_real.sql');
  L.push('-- Generado por scripts/migracion/generar-seed-clientes-proveedores.js');
  L.push('-- NO editar a mano: regenerar desde KingPack.xlsx.');
  L.push('--');
  L.push(`-- Proveedores: ${proveedores.length} | Clientes: ${clientes.length}`);
  L.push(`-- Clientes omitidos por CUIT duplicado: ${omitidosCuit}`);
  if (omitidosDetalle.length) {
    L.push('-- Detalle de omitidos (revisar con el cliente):');
    omitidosDetalle.forEach((d) => L.push(`--   ${d}`));
  }
  L.push('-- IDs propios (UUID). No se importan los Id del Excel; legacy_id = NULL.');
  L.push('');

  L.push('-- Limpiar datos de prueba: clientes, proveedores y sus movimientos.');
  L.push('-- CASCADE alcanza cuentas corrientes, notas de crédito, preventas, pagos,');
  L.push('-- anticipos, pedidos, ventas/egresos y sus ítems, facturaciones y movimientos de caja.');
  L.push('-- NO toca artículos, categorías, stock, listas, sucursales, cond_iva ni usuarios.');
  L.push('TRUNCATE clientes, proveedores, ventas, egresos, cajas RESTART IDENTITY CASCADE;');
  L.push('');

  // Proveedores
  L.push('-- Proveedores');
  L.push('INSERT INTO proveedores (razon_social, telefono, email, direccion, activo)');
  L.push('VALUES');
  L.push(proveedores
    .map((p) => `  (${sql(p.razon_social)}, ${sql(p.telefono)}, ${sql(p.email)}, ${sql(p.direccion)}, TRUE)`)
    .join(',\n') + ';');
  L.push('');

  // Clientes
  L.push('-- Clientes (cond_iva por código AFIP; sucursal por nombre)');
  L.push('INSERT INTO clientes');
  L.push('  (razon_social, telefono, direccion, descuento_adicional, cond_iva_id,');
  L.push('   cuit, sucursal_default_id, legacy_sucursal_excel, fecha_saldo_0, saldo_inicial, activo)');
  L.push('SELECT');
  L.push('  v.razon_social, v.telefono, v.direccion, v.descuento, ci.id,');
  L.push('  v.cuit, s.id, v.legacy_sucursal_excel, v.fecha_saldo_0::date, v.saldo_inicial, TRUE');
  L.push('FROM (VALUES');
  L.push(clientes
    .map((c) => {
      return `  (${sql(c.razon_social)}, ${sql(c.telefono)}, ${sql(c.direccion)}, ${c.descuento}, ` +
        `${c.iva_afip}, ${sql(c.cuit)}, ${sql(c.sucursal)}, ${sql(c.legacy_sucursal_excel)}, ` +
        `${sql(c.fecha_saldo_0)}, ${c.saldo_inicial})`;
    })
    .join(',\n'));
  L.push(') AS v(razon_social, telefono, direccion, descuento, iva_afip, cuit, sucursal, legacy_sucursal_excel, fecha_saldo_0, saldo_inicial)');
  L.push('JOIN cond_iva ci ON ci.codigo_afip = v.iva_afip');
  L.push('LEFT JOIN sucursales s ON s.nombre = v.sucursal;');
  L.push('');

  fs.writeFileSync(SALIDA, L.join('\n'), 'utf8');
  console.log(`\nSeed generado: ${SALIDA}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
