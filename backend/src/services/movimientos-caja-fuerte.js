/**
 * KINGPACK — Movimientos por caja fuerte
 *
 * `caja_fuerte.saldo` se mantiene solo a partir de estos helpers: cada vez que se
 * toca el saldo se deja la fila correspondiente en `movimientos_caja_fuerte`, de
 * modo que siempre valga
 *
 *   saldo = saldo_inicial + Σ(ingresos) − Σ(egresos)
 *
 * Todas las funciones reciben el `client` de la transacción en curso: el
 * movimiento tiene que confirmarse o abortarse junto con el pago/cierre que lo
 * origina, nunca por separado.
 *
 * Gemelo de `movimientos-bancarios.js` (ver migraciones 046 y 047).
 */

// Registra un movimiento y ajusta el saldo de la caja fuerte de la sucursal.
// `tipo`: 'ingreso' (entra efectivo) | 'egreso' (sale efectivo).
async function registrarMovimientoCajaFuerte(client, mov) {
  const {
    sucursal_id, tipo, monto, concepto = null,
    origen_tipo = null, origen_id = null, usuario_id = null, fecha = null,
  } = mov;

  const importe = +(parseFloat(monto) || 0).toFixed(2);
  if (!sucursal_id || importe <= 0) return null;
  if (tipo !== 'ingreso' && tipo !== 'egreso') {
    throw new Error(`tipo de movimiento de caja fuerte inválido: ${tipo}`);
  }

  const { rows } = await client.query(`
    INSERT INTO movimientos_caja_fuerte
      (sucursal_id, fecha, tipo, monto, concepto, origen_tipo, origen_id, usuario_id)
    VALUES ($1, COALESCE($2::timestamptz, NOW()), $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [sucursal_id, fecha, tipo, importe, concepto, origen_tipo, origen_id, usuario_id]);

  await ajustarSaldo(client, sucursal_id, tipo === 'ingreso' ? importe : -importe);

  return rows[0].id;
}

// Registra de una tanda las líneas de un pago dividido que salieron de una caja
// fuerte. Cada medio "Efectivo Caja Fuerte" está atado a su sucursal por
// `medios_pago.caja_fuerte_sucursal_id`; el medio genérico viejo (sin esa
// columna) cae en `sucursalFallback`, la del comprobante.
// `medios` = [{ medio_pago_id, monto }].
async function registrarEgresosCajaFuerteDeMedios(client, medios, datos, sucursalFallback = null) {
  const porSucursal = await agruparMediosCajaFuerte(client, medios, sucursalFallback);

  for (const [sucursal_id, monto] of porSucursal) {
    await registrarMovimientoCajaFuerte(client, { ...datos, tipo: 'egreso', sucursal_id, monto });
  }
}

// Suma por sucursal de caja fuerte lo pagado con medios "Efectivo Caja Fuerte".
// Devuelve un Map<sucursal_id, monto>. Exportado para poder validar saldo antes
// de registrar.
async function agruparMediosCajaFuerte(client, medios, sucursalFallback = null) {
  const porSucursal = new Map();
  if (!Array.isArray(medios) || medios.length === 0) return porSucursal;

  const ids = [...new Set(medios.map(m => m?.medio_pago_id).filter(Boolean))];
  if (ids.length === 0) return porSucursal;

  const { rows } = await client.query(
    `SELECT id, nombre, caja_fuerte_sucursal_id FROM medios_pago WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const medioMap = new Map(rows.map(r => [r.id, r]));

  for (const m of medios) {
    const mp = medioMap.get(m?.medio_pago_id);
    if (!mp || !/caja fuerte/i.test(mp.nombre)) continue;
    const suc = mp.caja_fuerte_sucursal_id || sucursalFallback;
    if (!suc) continue;
    const importe = parseFloat(m.monto) || 0;
    if (importe <= 0) continue;
    porSucursal.set(suc, +((porSucursal.get(suc) || 0) + importe).toFixed(2));
  }

  return porSucursal;
}

// Deshace todos los movimientos de un origen (anulación o borrado) y devuelve el
// saldo al estado previo. Se borran las filas: el ledger refleja lo vigente, no
// lo que se dio de baja.
async function revertirMovimientosCajaFuerte(client, origen_tipo, origen_id) {
  if (!origen_tipo || !origen_id) return;

  const { rows } = await client.query(`
    DELETE FROM movimientos_caja_fuerte
     WHERE origen_tipo = $1 AND origen_id = $2
     RETURNING sucursal_id, tipo, monto
  `, [origen_tipo, origen_id]);

  // Un egreso revertido devuelve efectivo a la caja fuerte; un ingreso lo saca.
  const porSucursal = new Map();
  for (const r of rows) {
    const delta = (r.tipo === 'egreso' ? 1 : -1) * (parseFloat(r.monto) || 0);
    porSucursal.set(r.sucursal_id, +((porSucursal.get(r.sucursal_id) || 0) + delta).toFixed(2));
  }

  for (const [sucursal_id, delta] of porSucursal) {
    if (delta === 0) continue;
    await ajustarSaldo(client, sucursal_id, delta);
  }
}

// UPSERT del saldo: una sucursal puede no tener fila todavía (el cierre de caja
// la creaba con ON CONFLICT).
async function ajustarSaldo(client, sucursal_id, delta) {
  await client.query(`
    INSERT INTO caja_fuerte (sucursal_id, saldo, saldo_inicial)
    VALUES ($1, $2, 0)
    ON CONFLICT (sucursal_id) DO UPDATE
      SET saldo = caja_fuerte.saldo + EXCLUDED.saldo,
          updated_at = NOW()
  `, [sucursal_id, delta.toFixed(2)]);
}

// Fija el saldo de una caja fuerte en un valor dado (corrección manual: el
// efectivo realmente contado). Como `saldo` es derivado, NO se escribe a secas:
// se re-basa `saldo_inicial` para que el invariante siga valiendo y los
// movimientos ya registrados se conserven.
//
//   saldo_inicial = nuevoSaldo − (Σingresos − Σegresos)
//
// No deja un movimiento de ajuste a propósito: corregir una cifra de partida no
// es plata que entró o salió de la caja. Gemelo de `fijarSaldoBancario`.
async function fijarSaldoCajaFuerte(client, sucursal_id, nuevoSaldo) {
  const saldo = +(parseFloat(nuevoSaldo) || 0).toFixed(2);

  const { rows } = await client.query(`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0)::float AS mov
      FROM movimientos_caja_fuerte WHERE sucursal_id = $1
  `, [sucursal_id]);

  const inicial = +(saldo - (rows[0].mov || 0)).toFixed(2);

  await client.query(`
    INSERT INTO caja_fuerte (sucursal_id, saldo, saldo_inicial)
    VALUES ($1, $2, $3)
    ON CONFLICT (sucursal_id) DO UPDATE
      SET saldo = EXCLUDED.saldo,
          saldo_inicial = EXCLUDED.saldo_inicial,
          updated_at = NOW()
  `, [sucursal_id, saldo, inicial]);

  return { saldo, saldo_inicial: inicial };
}

module.exports = {
  registrarMovimientoCajaFuerte,
  fijarSaldoCajaFuerte,
  registrarEgresosCajaFuerteDeMedios,
  agruparMediosCajaFuerte,
  revertirMovimientosCajaFuerte,
};
