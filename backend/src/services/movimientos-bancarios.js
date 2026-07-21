/**
 * KINGPACK — Movimientos por cuenta bancaria
 *
 * `cuentas_bancarias_empresa.saldo` se mantiene solo a partir de estos helpers:
 * cada vez que se toca el saldo se deja la fila correspondiente en
 * `movimientos_cuenta_bancaria`, de modo que siempre valga
 *
 *   saldo = saldo_inicial + Σ(ingresos) − Σ(egresos)
 *
 * Todas las funciones reciben el `client` de la transacción en curso: el
 * movimiento tiene que confirmarse o abortarse junto con el pago/cobro que lo
 * origina, nunca por separado.
 */

// Registra un movimiento y ajusta el saldo de la cuenta.
// `tipo`: 'ingreso' (entra plata) | 'egreso' (sale plata).
async function registrarMovimientoBancario(client, mov) {
  const {
    cuenta_bancaria_id, tipo, monto, concepto = null,
    origen_tipo = null, origen_id = null, usuario_id = null, fecha = null,
  } = mov;

  const importe = +(parseFloat(monto) || 0).toFixed(2);
  if (!cuenta_bancaria_id || importe <= 0) return null;
  if (tipo !== 'ingreso' && tipo !== 'egreso') {
    throw new Error(`tipo de movimiento bancario inválido: ${tipo}`);
  }

  const { rows } = await client.query(`
    INSERT INTO movimientos_cuenta_bancaria
      (cuenta_bancaria_id, fecha, tipo, monto, concepto, origen_tipo, origen_id, usuario_id)
    VALUES ($1, COALESCE($2::timestamptz, NOW()), $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [cuenta_bancaria_id, fecha, tipo, importe, concepto, origen_tipo, origen_id, usuario_id]);

  const signo = tipo === 'ingreso' ? '+' : '-';
  await client.query(
    `UPDATE cuentas_bancarias_empresa
        SET saldo = saldo ${signo} $1, updated_at = NOW()
      WHERE id = $2`,
    [importe, cuenta_bancaria_id]
  );

  return rows[0].id;
}

// Registra de una tanda las líneas de un pago dividido. Sólo impactan las que
// traen cuenta bancaria (Transferencia y similares); el efectivo, los cheques y
// la caja fuerte se manejan por otro lado.
// `medios` = [{ cuenta_bancaria_id, monto }].
async function registrarMovimientosDeMedios(client, medios, datos) {
  if (!Array.isArray(medios) || medios.length === 0) return;

  // Agrupar por cuenta para no dejar varias filas de un mismo pago a la misma cuenta.
  const porCuenta = new Map();
  for (const m of medios) {
    if (!m?.cuenta_bancaria_id) continue;
    const importe = parseFloat(m.monto) || 0;
    if (importe <= 0) continue;
    porCuenta.set(m.cuenta_bancaria_id, +((porCuenta.get(m.cuenta_bancaria_id) || 0) + importe).toFixed(2));
  }

  for (const [cuenta_bancaria_id, monto] of porCuenta) {
    await registrarMovimientoBancario(client, { ...datos, cuenta_bancaria_id, monto });
  }
}

// Deshace todos los movimientos de un origen (anulación o borrado) y devuelve
// el saldo al estado previo. Se borran las filas, igual que hace `egreso_pagos`
// al anular un pago: el ledger refleja lo vigente, no lo que se dio de baja.
async function revertirMovimientosBancarios(client, origen_tipo, origen_id) {
  if (!origen_tipo || !origen_id) return;

  const { rows } = await client.query(`
    DELETE FROM movimientos_cuenta_bancaria
     WHERE origen_tipo = $1 AND origen_id = $2
     RETURNING cuenta_bancaria_id, tipo, monto
  `, [origen_tipo, origen_id]);

  // Un egreso revertido devuelve plata a la cuenta; un ingreso revertido la saca.
  const porCuenta = new Map();
  for (const r of rows) {
    const delta = (r.tipo === 'egreso' ? 1 : -1) * (parseFloat(r.monto) || 0);
    porCuenta.set(r.cuenta_bancaria_id, +((porCuenta.get(r.cuenta_bancaria_id) || 0) + delta).toFixed(2));
  }

  for (const [cuenta_bancaria_id, delta] of porCuenta) {
    if (delta === 0) continue;
    await client.query(
      `UPDATE cuentas_bancarias_empresa
          SET saldo = saldo + $1, updated_at = NOW()
        WHERE id = $2`,
      [delta.toFixed(2), cuenta_bancaria_id]
    );
  }
}

// Fija el saldo de una cuenta en un valor dado (corrección manual: el saldo real
// del home banking). Como `saldo` es derivado, NO se puede escribir a secas: se
// re-basa `saldo_inicial` para que el invariante siga valiendo y los movimientos
// ya registrados se conserven.
//
//   saldo_inicial = nuevoSaldo − (Σingresos − Σegresos)
//
// No registra un movimiento de ajuste a propósito: corregir una cifra de partida
// mal cargada no es plata que entró o salió de la cuenta.
async function fijarSaldoBancario(client, cuenta_bancaria_id, nuevoSaldo) {
  const saldo = +(parseFloat(nuevoSaldo) || 0).toFixed(2);

  const { rows } = await client.query(`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0)::float AS mov
      FROM movimientos_cuenta_bancaria WHERE cuenta_bancaria_id = $1
  `, [cuenta_bancaria_id]);

  const inicial = +(saldo - (rows[0].mov || 0)).toFixed(2);

  const { rowCount } = await client.query(`
    UPDATE cuentas_bancarias_empresa
       SET saldo = $1, saldo_inicial = $2, updated_at = NOW()
     WHERE id = $3
  `, [saldo, inicial, cuenta_bancaria_id]);

  return rowCount > 0;
}

module.exports = {
  registrarMovimientoBancario,
  registrarMovimientosDeMedios,
  revertirMovimientosBancarios,
  fijarSaldoBancario,
};
