#!/usr/bin/env node
/**
 * KINGPACK — Verificación de integridad del circuito Egresos ↔ Pagos a Proveedor
 *
 * Corre los cuatro chequeos de la auditoría del 2026-08-31 y falla (exit ≠ 0) si
 * alguno encuentra inconsistencias. Es solo lectura: nunca escribe.
 *
 *   1. Saldo de cuenta corriente vs deuda real de cada proveedor
 *   2. Invariante de cuentas bancarias y cajas fuertes
 *   3. `estado_pago` de los egresos vs lo realmente pagado
 *   4. Restos: cuenta corriente de egresos eliminados, pagos sobre-imputados,
 *      y cruces entre el saldo facturado y el no facturado
 *
 * Uso:
 *   node -r dotenv/config scripts/verificar-integridad-proveedores.js [--verbose]
 */

const { pool } = require('../src/config/db');

const TOLERANCIA = 0.01;
const ars = (v) => '$' + (parseFloat(v) || 0).toFixed(2);

// ─── Chequeo 1 ────────────────────────────────────────────────────────────────
// Para cada proveedor: lo que figura impago menos lo que ya se pagó sin imputar
// tiene que dar exactamente el saldo de su cuenta corriente.
const SQL_SALDOS = `
  WITH cc AS (
    SELECT proveedor_id, COALESCE(SUM(debe) - SUM(haber), 0) AS saldo_cc
      FROM cuentas_corrientes_proveedor GROUP BY proveedor_id),
  pend AS (
    SELECT e.proveedor_id,
           SUM(e.total - COALESCE(
             (SELECT SUM(ep.monto) FROM egreso_pagos ep WHERE ep.egreso_id = e.id), 0)) AS pendiente
      FROM egresos e
     WHERE e.deleted_at IS NULL AND e.estado_pago IN ('pendiente','parcial')
     GROUP BY e.proveedor_id),
  sin AS (
    SELECT pp.proveedor_id,
           SUM(pp.monto - COALESCE(
             (SELECT SUM(a.monto_aplicado) FROM pago_proveedor_aplicaciones a
               WHERE a.pago_proveedor_id = pp.id), 0)) AS sin_imputar
      FROM pagos_proveedor pp WHERE pp.anulado = FALSE
     GROUP BY pp.proveedor_id)
  SELECT p.razon_social,
         COALESCE(pend.pendiente, 0)   AS pendiente,
         COALESCE(sin.sin_imputar, 0)  AS sin_imputar,
         COALESCE(cc.saldo_cc, 0) + COALESCE(p.saldo_inicial, 0) AS saldo_cc,
         ROUND((COALESCE(pend.pendiente, 0) - COALESCE(sin.sin_imputar, 0))
               - (COALESCE(cc.saldo_cc, 0) + COALESCE(p.saldo_inicial, 0)), 2) AS descuadre
    FROM proveedores p
    LEFT JOIN cc   ON cc.proveedor_id   = p.id
    LEFT JOIN pend ON pend.proveedor_id = p.id
    LEFT JOIN sin  ON sin.proveedor_id  = p.id
   WHERE p.deleted_at IS NULL
   ORDER BY p.razon_social`;

// ─── Chequeo 2 ────────────────────────────────────────────────────────────────
// saldo = saldo_inicial + Σ ingresos − Σ egresos, en banco y en caja fuerte.
const SQL_BANCOS = `
  SELECT cb.nombre,
         cb.saldo,
         ROUND(cb.saldo - (cb.saldo_inicial + COALESCE(
           (SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END)
              FROM movimientos_cuenta_bancaria m WHERE m.cuenta_bancaria_id = cb.id), 0)), 2) AS descuadre
    FROM cuentas_bancarias_empresa cb ORDER BY cb.nombre`;

const SQL_CAJAS = `
  SELECT COALESCE(s.nombre, 'sin sucursal') AS nombre,
         cf.saldo,
         ROUND(cf.saldo - (cf.saldo_inicial + COALESCE(
           (SELECT SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END)
              FROM movimientos_caja_fuerte m WHERE m.sucursal_id = cf.sucursal_id), 0)), 2) AS descuadre
    FROM caja_fuerte cf LEFT JOIN sucursales s ON s.id = cf.sucursal_id ORDER BY 1`;

// ─── Chequeo 3 ────────────────────────────────────────────────────────────────
// El estado tiene que salir de lo pagado. Los gastos manuales sin proveedor se
// marcan pagados sin dejar registro de pago (es el diseño), así que no cuentan.
const SQL_ESTADOS = `
  WITH x AS (
    SELECT e.id, e.total, e.estado_pago, e.descripcion, e.tipo_operacion, e.proveedor_id,
           COALESCE((SELECT SUM(ep.monto) FROM egreso_pagos ep WHERE ep.egreso_id = e.id), 0) AS pagado
      FROM egresos e WHERE e.deleted_at IS NULL)
  SELECT id, LEFT(descripcion, 40) AS descripcion, total, pagado, estado_pago,
         CASE WHEN pagado - total > ${TOLERANCIA} THEN 'pagado de más'
              ELSE 'estado no coincide con lo pagado' END AS problema
    FROM x
   WHERE NOT (tipo_operacion = 'gasto_manual' AND proveedor_id IS NULL)
     AND ( (pagado <= ${TOLERANCIA} AND estado_pago <> 'pendiente')
        OR (pagado > ${TOLERANCIA} AND ABS(pagado - total) <= ${TOLERANCIA} AND estado_pago <> 'pagado')
        OR (pagado > ${TOLERANCIA} AND ABS(pagado - total) > ${TOLERANCIA} AND estado_pago <> 'parcial')
        OR (pagado - total > ${TOLERANCIA}) )
   ORDER BY total DESC`;

// ─── Chequeo 4 ────────────────────────────────────────────────────────────────
const SQL_EGRESOS_BORRADOS = `
  SELECT p.razon_social, COUNT(*) AS asientos, SUM(cc.debe - cc.haber) AS neto
    FROM egresos e
    JOIN cuentas_corrientes_proveedor cc
      ON cc.origen_id = e.id AND cc.origen_tipo IN ('egreso','pago','anticipo')
    JOIN proveedores p ON p.id = cc.proveedor_id
   WHERE e.deleted_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM cuentas_corrientes_proveedor c2
                      WHERE c2.origen_id = e.id AND c2.origen_tipo = 'correccion')
   GROUP BY p.razon_social HAVING ABS(SUM(cc.debe - cc.haber)) > ${TOLERANCIA}`;

const SQL_SOBRE_IMPUTADOS = `
  SELECT pp.id, p.razon_social, pp.monto,
         COALESCE((SELECT SUM(a.monto_aplicado) FROM pago_proveedor_aplicaciones a
                    WHERE a.pago_proveedor_id = pp.id), 0) AS imputado
    FROM pagos_proveedor pp JOIN proveedores p ON p.id = pp.proveedor_id
   WHERE COALESCE((SELECT SUM(a.monto_aplicado) FROM pago_proveedor_aplicaciones a
                    WHERE a.pago_proveedor_id = pp.id), 0) - pp.monto > ${TOLERANCIA}`;

// Blanco y negro cruzados: una columna a favor y la otra en contra. El neto
// puede estar bien y el desglose del contador igual estar mal.
const SQL_CRUCE_FACTURADO = `
  WITH cc AS (
    SELECT proveedor_id,
           COALESCE(SUM(debe) FILTER (WHERE facturado), 0)
             - COALESCE(SUM(haber) FILTER (WHERE facturado), 0)     AS mov_fact,
           COALESCE(SUM(debe) FILTER (WHERE NOT facturado), 0)
             - COALESCE(SUM(haber) FILTER (WHERE NOT facturado), 0) AS mov_nofact
      FROM cuentas_corrientes_proveedor GROUP BY proveedor_id)
  SELECT p.razon_social,
         ROUND(p.saldo_inicial_facturado + COALESCE(cc.mov_fact, 0), 2)      AS saldo_blanco,
         ROUND(p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0), 2) AS saldo_negro
    FROM proveedores p JOIN cc ON cc.proveedor_id = p.id
   WHERE p.deleted_at IS NULL
     AND (p.saldo_inicial_facturado + COALESCE(cc.mov_fact, 0))
       * (p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0)) < 0
     AND ABS(p.saldo_inicial_facturado + COALESCE(cc.mov_fact, 0)) > 1
     AND ABS(p.saldo_inicial_no_facturado + COALESCE(cc.mov_nofact, 0)) > 1
   ORDER BY p.razon_social`;

async function main() {
  const verbose = process.argv.includes('--verbose');
  const fallas = [];
  const ok = (t) => console.log(`  OK   ${t}`);
  const mal = (t) => { console.log(`  FALLA ${t}`); fallas.push(t); };

  try {
    // 1
    console.log('\n[1/4] Cuentas corrientes de proveedores');
    const { rows: saldos } = await pool.query(SQL_SALDOS);
    const descuadrados = saldos.filter(r => Math.abs(parseFloat(r.descuadre)) > TOLERANCIA);
    if (descuadrados.length === 0) {
      ok(`${saldos.length} proveedores, todos cuadran`);
    } else {
      mal(`${descuadrados.length} proveedor(es) descuadrado(s)`);
      for (const r of descuadrados) {
        console.log(`         ${r.razon_social}: pendiente ${ars(r.pendiente)} − sin imputar ` +
          `${ars(r.sin_imputar)} ≠ saldo ${ars(r.saldo_cc)} (diferencia ${ars(r.descuadre)})`);
      }
    }
    if (verbose) {
      for (const r of saldos.filter(x => Math.abs(parseFloat(x.saldo_cc)) > TOLERANCIA)) {
        console.log(`         ${r.razon_social}: saldo ${ars(r.saldo_cc)}, sin imputar ${ars(r.sin_imputar)}`);
      }
    }

    // 2
    console.log('\n[2/4] Saldos de bancos y cajas fuertes');
    for (const [titulo, sql] of [['Cuenta', SQL_BANCOS], ['Caja fuerte', SQL_CAJAS]]) {
      const { rows } = await pool.query(sql);
      const malas = rows.filter(r => Math.abs(parseFloat(r.descuadre)) > TOLERANCIA);
      if (malas.length === 0) ok(`${rows.length} ${titulo.toLowerCase()}(s), todas cuadran`);
      else for (const r of malas) mal(`${titulo} ${r.nombre}: saldo ${ars(r.saldo)}, descuadre ${ars(r.descuadre)}`);
    }

    // 3
    console.log('\n[3/4] Estado de pago de los egresos');
    const { rows: estados } = await pool.query(SQL_ESTADOS);
    if (estados.length === 0) ok('todos los egresos tienen el estado que corresponde a lo pagado');
    else {
      mal(`${estados.length} egreso(s) con el estado mal`);
      for (const r of estados.slice(0, 15)) {
        console.log(`         ${r.descripcion} — total ${ars(r.total)}, pagado ${ars(r.pagado)}, ` +
          `estado "${r.estado_pago}" (${r.problema})`);
      }
      if (estados.length > 15) console.log(`         … y ${estados.length - 15} más`);
    }

    // 4
    console.log('\n[4/4] Egresos eliminados, sobre-imputaciones y cruces blanco/negro');
    const { rows: borrados } = await pool.query(SQL_EGRESOS_BORRADOS);
    if (borrados.length === 0) ok('ningún egreso eliminado dejó saldo en la cuenta corriente');
    else for (const r of borrados) mal(`${r.razon_social}: ${r.asientos} asiento(s) de egresos eliminados, neto ${ars(r.neto)}`);

    const { rows: sobre } = await pool.query(SQL_SOBRE_IMPUTADOS);
    if (sobre.length === 0) ok('ningún pago imputado por encima de su monto');
    else for (const r of sobre) mal(`${r.razon_social}: pago de ${ars(r.monto)} con ${ars(r.imputado)} imputados`);

    const { rows: cruces } = await pool.query(SQL_CRUCE_FACTURADO);
    if (cruces.length === 0) ok('ningún proveedor con blanco y negro cruzados');
    else for (const r of cruces) {
      mal(`${r.razon_social}: blanco ${ars(r.saldo_blanco)} / negro ${ars(r.saldo_negro)} (cruzados)`);
    }

    console.log(fallas.length === 0
      ? '\n✓ Integridad OK — los cuatro chequeos pasaron.\n'
      : `\n✗ ${fallas.length} problema(s) detectado(s).\n`);
    process.exitCode = fallas.length === 0 ? 0 : 1;
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('ERROR FATAL:', err.message); process.exit(1); });
