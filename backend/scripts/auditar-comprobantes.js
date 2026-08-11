#!/usr/bin/env node
/**
 * KINGPACK — Auditoría de comprobantes ARCA huérfanos
 *
 * Un comprobante "huérfano" es uno que ARCA autorizó (tiene CAE) pero que no
 * quedó registrado en `facturaciones`. Pasa cuando FECAESolicitar corta por
 * timeout o error de red DESPUÉS de que ARCA lo procesó: el cajero ve un 500,
 * KingPack no guarda nada, pero la factura existe y es legalmente válida.
 *
 * Ocurrió el 11/08/2026 con la Factura B 0006-00000207: ese día ARCA producción
 * respondía en 25-40s contra un timeout de cliente de 20s.
 *
 * Cómo detecta: por cada (punto de venta, tipo) compara el último número
 * autorizado en ARCA contra el máximo registrado en `facturaciones`. Todo número
 * en el medio es un huérfano. Después lo consulta con FECompConsultar y busca la
 * venta que le corresponde por sucursal + importe + fecha.
 *
 * Es idempotente: los ya registrados no aparecen en la corrida siguiente.
 *
 * Uso:
 *   node -r dotenv/config scripts/auditar-comprobantes.js              # solo informa
 *   node -r dotenv/config scripts/auditar-comprobantes.js --aplicar    # registra
 *
 * Sin --aplicar no escribe absolutamente nada: es el modo por defecto a propósito.
 */

const { pool } = require('../src/config/db');
const arca     = require('../src/services/arca');
const config   = require('../src/services/arca/config');

const log = (...a) => console.log(...a);

// ARCA producción devuelve 503 de forma intermitente y a veces demora decenas de
// segundos. Estas consultas son de solo lectura, así que reintentar es seguro.
async function conReintentos(fn, etiqueta, intentos = 5) {
  for (let i = 1; i <= intentos; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === intentos) throw new Error(`${etiqueta}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

// El QR de AFIP es un JSON en base64 con un formato fijo (RG 4892).
function construirQR(cbte, pv, tipo, docTipo, docNro) {
  const f = cbte.fecha;
  const data = {
    ver: 1,
    fecha: `${f.slice(0,4)}-${f.slice(4,6)}-${f.slice(6,8)}`,
    cuit: config.cuit,
    ptoVta: pv,
    tipoCmp: tipo,
    nroCmp: cbte.nroComprobante,
    importe: cbte.total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: docTipo,
    nroDocRec: Number(docNro),
    tipoCodAut: 'E',
    codAut: cbte.CAE,
  };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');

  if (config.esDemo) {
    log('Modo demo: no hay comprobantes reales que auditar.');
    return;
  }
  log(`Auditoría de comprobantes ARCA — modo ${config.modo}${aplicar ? ' — APLICANDO CAMBIOS' : ' (solo lectura)'}\n`);

  // Puntos de venta y tipos efectivamente usados, según lo ya facturado.
  const { rows: combos } = await pool.query(`
    SELECT f.punto_venta, t.codigo_afip, t.id AS tipo_id, t.letra,
           MAX(f.numero) AS ultimo_db
      FROM facturaciones f
      JOIN tipos_comprobante t ON t.id = f.tipo_comprobante_id
     WHERE f.ok AND f.deleted_at IS NULL
     GROUP BY 1, 2, 3, 4
     ORDER BY 1, 2
  `);

  // PV → sucursal, invirtiendo AFIP_PV_MAP ({"Laprida":4,...}).
  const sucursalPorPV = {};
  for (const [nombre, pv] of Object.entries(config.pvPorSucursal)) sucursalPorPV[pv] = nombre;

  let huerfanos = 0, registrados = 0, sinMatch = 0;

  for (const c of combos) {
    const pv   = c.punto_venta;
    const tipo = c.codigo_afip;

    let ultimoArca;
    try {
      ultimoArca = await conReintentos(
        () => arca.ultimoComprobante(pv, tipo), `PV ${pv} tipo ${tipo}`);
    } catch (e) {
      log(`  ⚠ PV ${pv} tipo ${tipo}: no se pudo consultar ARCA — ${e.message}`);
      continue;
    }

    if (ultimoArca <= c.ultimo_db) {
      log(`  ✓ PV ${pv} ${c.letra} (tipo ${tipo}): ARCA ${ultimoArca} = KingPack ${c.ultimo_db}`);
      continue;
    }

    log(`  ✗ PV ${pv} ${c.letra} (tipo ${tipo}): ARCA ${ultimoArca} vs KingPack ${c.ultimo_db} ` +
        `→ ${ultimoArca - c.ultimo_db} huérfano(s)`);

    for (let nro = c.ultimo_db + 1; nro <= ultimoArca; nro++) {
      huerfanos++;
      const res = await procesarHuerfano({ pv, tipo, nro, tipoId: c.tipo_id, letra: c.letra,
                                           sucursal: sucursalPorPV[pv], aplicar });
      if (res === 'registrado') registrados++;
      else if (res === 'sin-match') sinMatch++;
    }
  }

  log('\n─────────────────────────────────────────');
  log(`Huérfanos encontrados : ${huerfanos}`);
  log(`Registrados           : ${registrados}`);
  log(`Sin venta asociable   : ${sinMatch}`);
  if (huerfanos && !aplicar) log('\nCorrida en solo lectura. Volvé a correr con --aplicar para registrarlos.');
}

async function procesarHuerfano({ pv, tipo, nro, tipoId, letra, sucursal, aplicar }) {
  let cbte;
  try {
    cbte = await conReintentos(
      () => arca.consultarComprobante(pv, tipo, nro), `consulta ${pv}-${nro}`);
  } catch (e) {
    log(`      ${pv}-${String(nro).padStart(8,'0')}: no se pudo consultar — ${e.message}`);
    return 'error';
  }
  if (!cbte) {
    log(`      ${pv}-${String(nro).padStart(8,'0')}: ARCA no lo devuelve (¿anulado?)`);
    return 'error';
  }

  const fechaIso = `${cbte.fecha.slice(0,4)}-${cbte.fecha.slice(4,6)}-${cbte.fecha.slice(6,8)}`;
  log(`      ${pv}-${String(nro).padStart(8,'0')}  ${fechaIso}  $${cbte.total}  CAE ${cbte.CAE}`);

  // Candidata: misma sucursal, mismo importe, misma fecha, todavía sin facturar.
  const { rows: candidatas } = await pool.query(`
    SELECT v.id, v.numero, v.fecha, v.total, c.razon_social
      FROM ventas v
      JOIN sucursales s ON s.id = v.sucursal_id
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN facturaciones f ON f.venta_id = v.id AND f.deleted_at IS NULL
     WHERE v.deleted_at IS NULL
       AND f.id IS NULL
       AND s.nombre = $1
       AND v.total = $2
       AND v.fecha::date = $3::date
     ORDER BY v.fecha
  `, [sucursal, cbte.total, fechaIso]);

  if (candidatas.length === 0) {
    log(`         → sin venta asociable. Registrar a mano o emitir nota de crédito.`);
    return 'sin-match';
  }
  if (candidatas.length > 1) {
    log(`         → ${candidatas.length} ventas con el mismo importe y fecha: ` +
        candidatas.map(v => `#${v.numero}`).join(', ') + '. Resolver a mano.');
    return 'sin-match';
  }

  const venta = candidatas[0];
  log(`         → venta #${venta.numero} (${venta.razon_social || 'Consumidor Final'})`);

  if (!aplicar) return 'pendiente';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const qr = construirQR(cbte, pv, tipo, cbte.docTipo, cbte.docNro);
    const { rowCount } = await client.query(`
      INSERT INTO facturaciones
        (venta_id, sucursal_id, tipo_comprobante_id, punto_venta, numero,
         cae, cae_vencimiento, total, qr_url, respuesta_afip, ok, mensaje_afip, fecha_emision)
      SELECT $1, v.sucursal_id, $2, $3, $4, $5, $6::date, $7,
             $8, $9::jsonb, true, $10, $11::date
        FROM ventas v WHERE v.id = $1
      ON CONFLICT DO NOTHING
    `, [
      venta.id, tipoId, pv, nro, cbte.CAE, cbte.CAEFchVto, cbte.total,
      `https://www.afip.gob.ar/fe/qr/?p=${qr}`,
      JSON.stringify({ ...cbte, origen: 'auditar-comprobantes', recuperadoEn: new Date().toISOString() }),
      `Factura ${letra} ARCA (${config.modo}) — recuperada de ARCA tras falla de red`,
      fechaIso,
    ]);

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      log(`         ⚠ ya existía una facturación con ese número — sin cambios`);
      return 'error';
    }

    await client.query(
      `UPDATE ventas SET estado = 'facturada' WHERE id = $1 AND deleted_at IS NULL`, [venta.id]);
    await client.query('COMMIT');
    log(`         ✔ registrada y venta #${venta.numero} marcada como facturada`);
    return 'registrado';
  } catch (e) {
    await client.query('ROLLBACK');
    log(`         ✗ error al registrar: ${e.message}`);
    return 'error';
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(e => { console.error('ERROR:', e.message); pool.end(); process.exit(1); });
