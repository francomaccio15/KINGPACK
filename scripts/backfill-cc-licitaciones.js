/**
 * Backfill: registrar en cuenta corriente las licitaciones adjudicadas cuya
 * venta quedó sin el movimiento de deuda (bug previo al fix de adjudicar).
 *
 * Para cada licitación 'adjudicada' con cliente y venta vinculada, si NO existe
 * un renglón en cuentas_corrientes_cliente para esa venta, inserta el débito por
 * el total de la venta y recalcula el saldo corrido del cliente.
 *
 * Uso (en el VPS, con DATABASE_URL en el entorno del backend):
 *   node scripts/backfill-cc-licitaciones.js          # aplica
 *   node scripts/backfill-cc-licitaciones.js --dry     # solo muestra
 */
const { pool } = require('../backend/src/config/db');

const DRY = process.argv.includes('--dry');

async function recomputarSaldosCliente(client, cliente_id) {
  const { rows: [base] } = await client.query(
    `SELECT COALESCE(c.saldo_inicial, 0) + COALESCE(cs.total_correcciones, 0) AS base
       FROM clientes c
       LEFT JOIN (SELECT cliente_id, SUM(monto) AS total_correcciones
                    FROM correcciones_saldo_cliente GROUP BY cliente_id) cs
         ON cs.cliente_id = c.id
      WHERE c.id = $1`,
    [cliente_id]
  );
  let saldo = parseFloat(base?.base ?? '0');
  const { rows: movs } = await client.query(
    `SELECT id, debe, haber FROM cuentas_corrientes_cliente
      WHERE cliente_id = $1 ORDER BY fecha ASC, id ASC`,
    [cliente_id]
  );
  for (const m of movs) {
    saldo = parseFloat((saldo + parseFloat(m.debe) - parseFloat(m.haber)).toFixed(2));
    await client.query(
      `UPDATE cuentas_corrientes_cliente SET saldo = $1 WHERE id = $2`,
      [saldo, m.id]
    );
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows: pendientes } = await client.query(`
      SELECT l.id AS licitacion_id, l.numero AS lic_numero,
             v.id AS venta_id, v.numero AS venta_numero, v.total, v.cliente_id
        FROM licitaciones l
        JOIN ventas v ON v.id = l.venta_id
       WHERE l.estado = 'adjudicada'
         AND l.deleted_at IS NULL
         AND v.deleted_at IS NULL
         AND v.cliente_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM cuentas_corrientes_cliente cc
            WHERE cc.origen_tipo = 'venta' AND cc.origen_id = v.id
         )
       ORDER BY l.numero ASC
    `);

    if (!pendientes.length) {
      console.log('No hay licitaciones adjudicadas sin movimiento de CC. Nada que hacer.');
      return;
    }

    console.log(`Encontradas ${pendientes.length} licitación(es) a corregir:`);
    for (const p of pendientes) {
      console.log(`  Lic #${p.lic_numero} → Venta #${p.venta_numero} | cliente ${p.cliente_id} | total $${p.total}`);
    }

    if (DRY) { console.log('\n[--dry] No se aplicaron cambios.'); return; }

    await client.query('BEGIN');
    const clientesTocados = new Set();
    for (const p of pendientes) {
      // saldo se recalcula al final; se inserta con 0 temporal.
      await client.query(`
        INSERT INTO cuentas_corrientes_cliente
          (cliente_id, debe, haber, saldo, origen_tipo, origen_id)
        VALUES ($1, $2, 0, 0, 'venta', $3)
      `, [p.cliente_id, parseFloat(p.total).toFixed(2), p.venta_id]);
      clientesTocados.add(p.cliente_id);
    }
    for (const cid of clientesTocados) {
      await recomputarSaldosCliente(client, cid);
    }
    await client.query('COMMIT');
    console.log(`\nOK. Insertados ${pendientes.length} movimiento(s) y recalculados ${clientesTocados.size} cliente(s).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error, se hizo ROLLBACK:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
