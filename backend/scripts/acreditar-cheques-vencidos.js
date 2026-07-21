#!/usr/bin/env node
/**
 * KINGPACK — Acreditación automática de cheques vencidos
 *
 * Pasa a su estado final los cheques que vencieron hace más de DIAS_GRACIA días
 * y que nadie marcó a mano:
 *
 *   recibido (en_cartera | depositado)  →  acreditado
 *   emitido  (emitido | presentado)     →  debitado
 *
 * Los `endosado` quedan afuera a propósito: ese cheque ya no es nuestro.
 *
 * Efecto en el banco, siempre sobre la cuenta marcada `es_cuenta_cheques`:
 *   - EMITIDO: egreso.
 *   - RECIBIDO: normalmente nada, porque ya acreditó al cargarse en el sistema.
 *     La excepción son los cargados antes de esa regla (21/07/2026), que no
 *     tienen movimiento: esos acreditan acá, si no el saldo del banco queda
 *     corto para siempre.
 * El criterio no es el tipo sino si el cheque ya movió el saldo alguna vez, así
 * que nunca duplica — ver mig 049.
 *
 * Es idempotente: al terminar, el cheque queda en un estado que esta consulta ya
 * no selecciona. Si un día no corre, la corrida siguiente barre el atraso.
 *
 * Uso:
 *   node -r dotenv/config scripts/acreditar-cheques-vencidos.js [--dry-run]
 *
 * Cron (instalado en el VPS, corre después del backup de las 3):
 *   30 3 * * * cd /var/www/KINGPACK/backend && /usr/bin/node -r dotenv/config \
 *     scripts/acreditar-cheques-vencidos.js >> /var/log/kingpack-cheques.log 2>&1
 */

const { pool } = require('../src/config/db');
const {
  registrarMovimientoBancario,
  cuentaChequesId,
} = require('../src/services/movimientos-bancarios');

const DIAS_GRACIA = 2;

// `vw_cheques` unifica las 5 tablas donde vive un cheque; para escribir hay que
// volver a la tabla concreta según de dónde salió.
const TABLA_POR_ORIGEN = {
  venta:           'venta_cheques',
  egreso:          'egreso_cheques',
  manual:          'cheques_manuales',
  pago_proveedor:  'pago_proveedor_cheques',
  movimiento_caja: 'movimiento_caja_cheques',
};

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();

  let acreditados = 0, debitados = 0, omitidos = 0, montoBanco = 0;

  try {
    const { rows: pendientes } = await client.query(`
      SELECT tipo, id, origen_tipo, banco, numero_cheque, importe::float, estado,
             fecha_vencimiento,
             (fecha_vencimiento + ($1 || ' days')::interval)::date AS fecha_efectiva
        FROM vw_cheques
       WHERE fecha_vencimiento < CURRENT_DATE - ($1 || ' days')::interval
         AND ( (tipo = 'recibido' AND estado IN ('en_cartera','depositado'))
            OR (tipo = 'emitido'  AND estado IN ('emitido','presentado')) )
       ORDER BY fecha_vencimiento
    `, [DIAS_GRACIA]);

    log(`${pendientes.length} cheque(s) vencidos hace más de ${DIAS_GRACIA} días${dryRun ? ' [DRY RUN]' : ''}`);

    for (const ch of pendientes) {
      const tabla = TABLA_POR_ORIGEN[ch.origen_tipo];
      if (!tabla) { log(`  ! origen desconocido (${ch.origen_tipo}) en #${ch.numero_cheque}, se omite`); omitidos++; continue; }

      const estadoNuevo = ch.tipo === 'recibido' ? 'acreditado' : 'debitado';
      const etiqueta = `${ch.tipo} ${ch.banco ?? 's/banco'} #${ch.numero_cheque ?? 's/nro'} $${ch.importe} (venció ${ch.fecha_vencimiento.toISOString().slice(0, 10)})`;

      if (dryRun) { log(`  · ${etiqueta}: ${ch.estado} → ${estadoNuevo}`); continue; }

      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE ${tabla} SET estado = $1, fecha_estado = $2 WHERE id = $3`,
          [estadoNuevo, ch.fecha_efectiva, ch.id]
        );

        await client.query(`
          INSERT INTO cheque_historial_estados
            (cheque_tipo, cheque_id, estado_anterior, estado_nuevo, observacion, usuario_id)
          VALUES ($1, $2, $3, $4, $5, NULL)
        `, [ch.tipo, ch.id, ch.estado, estadoNuevo,
            `Automático: vencido hace más de ${DIAS_GRACIA} días`]);

        // El emitido descuenta al debitarse. El recibido normalmente ya acreditó
        // al cargarse, salvo los cargados antes de esa regla (21/07/2026): esos
        // no tienen movimiento y hay que acreditarlos al cobrarse, o el saldo
        // del banco queda corto para siempre. Por eso se mira si el cheque ya
        // movió el saldo, en vez de asumirlo por el tipo.
        const { rows: ya } = await client.query(
          `SELECT 1 FROM movimientos_cuenta_bancaria WHERE origen_tipo='cheque' AND origen_id=$1`,
          [ch.id]
        );
        const cuenta = ya.length ? null : await cuentaChequesId(client);
        if (cuenta) {
          const esIngreso = ch.tipo === 'recibido';
          await registrarMovimientoBancario(client, {
            cuenta_bancaria_id: cuenta,
            tipo: esIngreso ? 'ingreso' : 'egreso',
            monto: ch.importe,
            concepto: `Cheque ${esIngreso ? 'acreditado' : 'debitado'} — ${ch.banco ?? 's/banco'} #${ch.numero_cheque ?? 's/nro'} (automático)`,
            origen_tipo: 'cheque',
            origen_id: ch.id,
            usuario_id: null,
            fecha: ch.fecha_efectiva,
          });
          montoBanco += esIngreso ? ch.importe : -ch.importe;
        }

        await client.query('COMMIT');
        if (ch.tipo === 'recibido') acreditados++; else debitados++;
        log(`  ✓ ${etiqueta}: ${ch.estado} → ${estadoNuevo}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        omitidos++;
        log(`  ✗ ${etiqueta}: ${err.message}`);
      }
    }

    log(`Listo — ${acreditados} acreditado(s), ${debitados} debitado(s), ${omitidos} con error. ` +
        `Impacto neto en el banco: $${montoBanco.toFixed(2)}`);

    // Que el cron falle si algo quedó a medias, para que se note en el log.
    process.exitCode = omitidos > 0 ? 1 : 0;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { log('ERROR FATAL:', err.message); process.exit(1); });
