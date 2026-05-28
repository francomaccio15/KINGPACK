/**
 * migrate-ventas-a-caja.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sincroniza ventas históricas con movimientos_caja.
 *
 * Ejecutar UNA SOLA VEZ en el VPS:
 *   set -a && . /var/www/KINGPACK/.env && set +a
 *   cd /var/www/KINGPACK/backend
 *   node db/seeds/migrate-ventas-a-caja.js
 *
 * Qué hace:
 *   1. Busca ventas confirmadas/facturadas cuyos pagos NO tienen movimiento_caja.
 *   2. Para cada pago, encuentra la caja de la misma sucursal correspondiente a
 *      la fecha de la venta (exacta → fallback más cercana).
 *   3. Inserta los movimientos faltantes.
 *   4. Recalcula saldo_final_sistema en cajas cerradas que fueron modificadas.
 *   5. Imprime un resumen detallado.
 *
 * Idempotente: si se ejecuta dos veces no duplica registros.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/db');

async function run() {
  const client = await pool.connect();
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  migrate-ventas-a-caja  —  KingPack');
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // ── 1. Pagos de ventas confirmadas sin movimiento_caja ────────────────────
    const { rows: pagosHuerfanos } = await client.query(`
      SELECT
        v.id          AS venta_id,
        v.numero      AS venta_numero,
        v.sucursal_id,
        s.nombre      AS sucursal_nombre,
        v.fecha,
        vp.medio_pago_id,
        vp.monto,
        mp.nombre     AS medio_pago_nombre
      FROM ventas v
      JOIN sucursales s  ON s.id = v.sucursal_id
      JOIN venta_pagos vp ON vp.venta_id = v.id
      JOIN medios_pago mp ON mp.id = vp.medio_pago_id
      WHERE v.estado IN ('confirmada', 'facturada')
        AND v.deleted_at IS NULL
        AND mp.nombre != 'Saldo a favor'
        AND NOT EXISTS (
          SELECT 1
          FROM movimientos_caja mc
          WHERE mc.origen_tipo = 'venta'
            AND mc.origen_id   = v.id
            AND mc.medio_pago_id = vp.medio_pago_id
        )
      ORDER BY v.sucursal_id, v.fecha
    `);

    if (pagosHuerfanos.length === 0) {
      console.log('✓ No hay ventas pendientes de sincronizar. Todo está al día.\n');
      return;
    }

    console.log(`Encontrados ${pagosHuerfanos.length} pago(s) sin movimiento de caja.\n`);

    let insertados  = 0;
    let sinCaja     = 0;
    const cajasAfectadas = new Set();

    for (const pago of pagosHuerfanos) {
      // ── 2a. Caja exacta: apertura ≤ fecha_venta ≤ cierre ─────────────────
      let { rows: cajaRows } = await client.query(`
        SELECT id, estado FROM cajas
        WHERE sucursal_id    = $1
          AND fecha_apertura <= $2
          AND (fecha_cierre IS NULL OR fecha_cierre >= $2)
        ORDER BY fecha_apertura DESC
        LIMIT 1
      `, [pago.sucursal_id, pago.fecha]);

      // ── 2b. Fallback: caja más cercana anterior (misma fecha o antes) ─────
      if (cajaRows.length === 0) {
        ({ rows: cajaRows } = await client.query(`
          SELECT id, estado FROM cajas
          WHERE sucursal_id        = $1
            AND fecha_apertura::date <= $2::date
          ORDER BY fecha_apertura DESC
          LIMIT 1
        `, [pago.sucursal_id, pago.fecha]));
      }

      if (cajaRows.length === 0) {
        console.log(`  ⚠  Venta #${pago.venta_numero} (${pago.sucursal_nombre}) — sin caja para ${pago.fecha.toISOString().split('T')[0]} [OMITIDA]`);
        sinCaja++;
        continue;
      }

      const caja = cajaRows[0];

      await client.query(`
        INSERT INTO movimientos_caja
          (caja_id, tipo, concepto, monto, medio_pago_id, origen_tipo, origen_id)
        VALUES ($1, 'venta', $2, $3, $4, 'venta', $5)
        ON CONFLICT DO NOTHING
      `, [
        caja.id,
        `Venta #${pago.venta_numero}`,
        parseFloat(pago.monto),
        pago.medio_pago_id,
        pago.venta_id,
      ]);

      cajasAfectadas.add(caja.id);
      insertados++;
      console.log(`  ✓  Venta #${pago.venta_numero}  ${pago.sucursal_nombre}  ${pago.medio_pago_nombre}  $${parseFloat(pago.monto).toFixed(2)}${caja.estado === 'cerrada' ? '  [caja cerrada]' : ''}`);
    }

    // ── 3. Recalcular saldo_final_sistema en cajas cerradas afectadas ─────────
    let cajasRecalculadas = 0;
    for (const cajaId of cajasAfectadas) {
      const { rowCount } = await client.query(`
        UPDATE cajas
        SET saldo_final_sistema = (
          saldo_inicial
          + COALESCE((
              SELECT SUM(monto) FROM movimientos_caja
              WHERE caja_id = $1 AND tipo IN ('ingreso','venta')
            ), 0)
          - COALESCE((
              SELECT SUM(monto) FROM movimientos_caja
              WHERE caja_id = $1 AND tipo IN ('egreso','retiro')
            ), 0)
        ),
        diferencia = saldo_final_real - (
          saldo_inicial
          + COALESCE((
              SELECT SUM(monto) FROM movimientos_caja
              WHERE caja_id = $1 AND tipo IN ('ingreso','venta')
            ), 0)
          - COALESCE((
              SELECT SUM(monto) FROM movimientos_caja
              WHERE caja_id = $1 AND tipo IN ('egreso','retiro')
            ), 0)
        )
        WHERE id = $1 AND estado = 'cerrada'
      `, [cajaId]);

      if (rowCount > 0) cajasRecalculadas++;
    }

    // ── 4. Resumen ─────────────────────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────');
    console.log(`  Movimientos insertados : ${insertados}`);
    console.log(`  Cajas afectadas        : ${cajasAfectadas.size}`);
    console.log(`  Cajas cerradas recalc. : ${cajasRecalculadas}`);
    if (sinCaja > 0)
      console.log(`  ⚠  Sin caja asignable  : ${sinCaja}`);
    console.log('──────────────────────────────────────────────────────');
    console.log('\n✓ Migración completada.\n');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('\n✗ Error durante la migración:', err.message);
  process.exit(1);
});
