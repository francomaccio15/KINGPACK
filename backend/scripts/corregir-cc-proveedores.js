#!/usr/bin/env node
/**
 * KINGPACK — Corrección de la cuenta corriente de proveedores
 *
 * Arregla los dos desvíos que dejó el circuito viejo de pagos, sin tocar un solo
 * asiento existente: todo se corrige agregando asientos `correccion`, que es como
 * se corrige la cuenta corriente en el resto del sistema.
 *
 *   A) Egresos ELIMINADOS que dejaron su deuda viva. El DELETE no revertía la
 *      cuenta corriente (arreglado en esta misma versión), así que el proveedor
 *      sigue debiendo por un comprobante que ya no existe.
 *
 *   B) Proveedores con el desglose facturado / no facturado CRUZADO: el pago se
 *      cargó en una columna y los comprobantes que salda están en la otra. El
 *      total que se le debe está bien; el desglose que mira el contador, no.
 *      Se mueve el importe cruzado de la columna que quedó con crédito a la que
 *      quedó con deuda. El saldo total del proveedor NO cambia.
 *
 * Es idempotente: al terminar, ninguno de los dos casos vuelve a seleccionarse.
 *
 * Uso:
 *   node -r dotenv/config scripts/corregir-cc-proveedores.js              (dry-run)
 *   node -r dotenv/config scripts/corregir-cc-proveedores.js --aplicar
 */

const { pool } = require('../src/config/db');

const ars = (v) => '$' + (parseFloat(v) || 0).toFixed(2);

// Saldo acumulado del proveedor, mismo criterio que usan las rutas.
async function saldoProveedor(client, proveedorId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
       FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`, [proveedorId]
  );
  return parseFloat(rows[0].saldo) || 0;
}

async function insertarCorreccion(client, { proveedorId, debe, haber, descripcion, facturado, origenId }) {
  const saldo = await saldoProveedor(client, proveedorId);
  await client.query(`
    INSERT INTO cuentas_corrientes_proveedor
      (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
    VALUES ($1, $2, $3, $4, 'correccion', $5, $6, $7)
  `, [proveedorId, debe, haber, +(saldo + debe - haber).toFixed(2), origenId,
      descripcion.substring(0, 200), facturado]);
}

// ─── A) Egresos eliminados con deuda viva ─────────────────────────────────────
const SQL_BORRADOS = `
  SELECT e.id AS egreso_id, cc.proveedor_id, p.razon_social, cc.facturado,
         COALESCE(SUM(cc.debe), 0)  AS debe,
         COALESCE(SUM(cc.haber), 0) AS haber
    FROM egresos e
    JOIN cuentas_corrientes_proveedor cc
      ON cc.origen_id = e.id AND cc.origen_tipo = 'egreso'
    JOIN proveedores p ON p.id = cc.proveedor_id
   WHERE e.deleted_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM cuentas_corrientes_proveedor c2
                      WHERE c2.origen_id = e.id AND c2.origen_tipo = 'correccion')
   GROUP BY e.id, cc.proveedor_id, p.razon_social, cc.facturado
   HAVING ABS(COALESCE(SUM(cc.debe), 0) - COALESCE(SUM(cc.haber), 0)) > 0.01`;

// ─── B) Blanco y negro cruzados ───────────────────────────────────────────────
// Una columna con crédito y la otra con deuda. Se mueve el menor de los dos, que
// es exactamente la parte cruzada; lo que exceda es saldo a favor real y queda
// donde está.
const SQL_CRUCES = `
  WITH cc AS (
    SELECT proveedor_id,
           COALESCE(SUM(debe) FILTER (WHERE facturado), 0)
             - COALESCE(SUM(haber) FILTER (WHERE facturado), 0)     AS mov_fact,
           COALESCE(SUM(debe) FILTER (WHERE NOT facturado), 0)
             - COALESCE(SUM(haber) FILTER (WHERE NOT facturado), 0) AS mov_nofact
      FROM cuentas_corrientes_proveedor GROUP BY proveedor_id)
  SELECT p.id AS proveedor_id, p.razon_social,
         ROUND(p.saldo_inicial_facturado + COALESCE(cc.mov_fact, 0), 2)      AS blanco,
         ROUND(p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0), 2) AS negro
    FROM proveedores p JOIN cc ON cc.proveedor_id = p.id
   WHERE p.deleted_at IS NULL
     AND (p.saldo_inicial_facturado + COALESCE(cc.mov_fact, 0))
       * (p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0)) < 0
     AND ABS(p.saldo_inicial_facturado + COALESCE(cc.mov_fact, 0)) > 1
     AND ABS(p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0)) > 1
   ORDER BY p.razon_social`;

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const client = await pool.connect();
  let correcciones = 0;

  try {
    console.log(aplicar ? '\nMODO APLICAR — se van a escribir asientos.\n'
                        : '\nDRY-RUN — no se escribe nada. Usá --aplicar para confirmar.\n');
    if (aplicar) await client.query('BEGIN');

    // A)
    const { rows: borrados } = await client.query(SQL_BORRADOS);
    console.log(`[A] Egresos eliminados con deuda viva: ${borrados.length} asiento(s)`);
    for (const r of borrados) {
      const debe  = +(parseFloat(r.haber) || 0).toFixed(2);
      const haber = +(parseFloat(r.debe)  || 0).toFixed(2);
      const col = r.facturado ? 'facturado' : 'no facturado';
      console.log(`    ${r.razon_social} (${col}): debe ${ars(r.debe)} / haber ${ars(r.haber)} ` +
                  `→ corrección debe ${ars(debe)} / haber ${ars(haber)}`);
      if (aplicar) {
        await insertarCorreccion(client, {
          proveedorId: r.proveedor_id, debe, haber, facturado: r.facturado,
          origenId: r.egreso_id,
          descripcion: 'Egreso eliminado — baja de la deuda que había quedado viva',
        });
        correcciones++;
      }
    }

    // B)
    const { rows: cruces } = await client.query(SQL_CRUCES);
    console.log(`\n[B] Proveedores con blanco y negro cruzados: ${cruces.length}`);
    for (const r of cruces) {
      const blanco = parseFloat(r.blanco);
      const negro  = parseFloat(r.negro);
      const monto  = +Math.min(Math.abs(blanco), Math.abs(negro)).toFixed(2);
      // El crédito está en la columna negativa y tiene que ir a la positiva.
      const desdeFacturado = blanco < 0;
      console.log(`    ${r.razon_social}: blanco ${ars(blanco)} / negro ${ars(negro)} ` +
                  `→ mover ${ars(monto)} de ${desdeFacturado ? 'facturado a no facturado' : 'no facturado a facturado'}`);
      if (aplicar) {
        // Saca el crédito de la columna donde sobra…
        await insertarCorreccion(client, {
          proveedorId: r.proveedor_id, debe: monto, haber: 0, facturado: desdeFacturado,
          origenId: r.proveedor_id,
          descripcion: 'Reclasificación facturado / no facturado — pago cargado en la columna equivocada',
        });
        // …y lo pone en la que corresponde. Neto cero sobre el saldo total.
        await insertarCorreccion(client, {
          proveedorId: r.proveedor_id, debe: 0, haber: monto, facturado: !desdeFacturado,
          origenId: r.proveedor_id,
          descripcion: 'Reclasificación facturado / no facturado — pago cargado en la columna equivocada',
        });
        correcciones += 2;
      }
    }

    if (aplicar) {
      await client.query('COMMIT');
      console.log(`\n✓ Listo — ${correcciones} asiento(s) de corrección insertados.`);
      console.log('  Verificá con: node -r dotenv/config scripts/verificar-integridad-proveedores.js\n');
    } else {
      console.log('\nNada escrito. Repetí con --aplicar para confirmar.\n');
    }
  } catch (err) {
    if (aplicar) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('ERROR FATAL:', err.message); process.exit(1); });
