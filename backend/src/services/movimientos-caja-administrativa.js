/**
 * KINGPACK — Movimientos de la Caja Administrativa
 *
 * Caja única de la empresa: recibe el efectivo contado en los cierres de las
 * cajas diarias de todas las sucursales y se usa como medio de pago "Caja
 * Administrativa" en egresos y pagos a proveedor. `caja_administrativa.saldo`
 * se mantiene solo a partir de estos helpers, de modo que siempre valga
 *
 *   saldo = saldo_inicial + Σ(ingresos) − Σ(egresos)
 *
 * Todas las funciones reciben el `client` de la transacción en curso.
 *
 * Gemelo de `movimientos-caja-fuerte.js` (ver migración 061).
 */

// Registra un movimiento y ajusta el saldo.
// `tipo`: 'ingreso' (entra efectivo) | 'egreso' (sale efectivo).
// `sucursal_id` es informativo (de qué sucursal vino o para cuál se pagó).
async function registrarMovimientoCajaAdministrativa(client, mov) {
  const {
    tipo, monto, concepto = null, sucursal_id = null,
    origen_tipo = null, origen_id = null, usuario_id = null, fecha = null,
  } = mov;

  const importe = +(parseFloat(monto) || 0).toFixed(2);
  if (importe <= 0) return null;
  if (tipo !== 'ingreso' && tipo !== 'egreso') {
    throw new Error(`tipo de movimiento de caja administrativa inválido: ${tipo}`);
  }

  const { rows } = await client.query(`
    INSERT INTO movimientos_caja_administrativa
      (fecha, tipo, monto, concepto, sucursal_id, origen_tipo, origen_id, usuario_id)
    VALUES (COALESCE($1::timestamptz, NOW()), $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [fecha, tipo, importe, concepto, sucursal_id, origen_tipo, origen_id, usuario_id]);

  await ajustarSaldo(client, tipo === 'ingreso' ? importe : -importe);

  return rows[0].id;
}

// Suma lo pagado con el medio "Caja Administrativa" en una lista de medios
// (`[{ medio_pago_id, monto }]`).
async function montoCajaAdministrativaDeMedios(client, medios) {
  if (!Array.isArray(medios) || medios.length === 0) return 0;
  const ids = [...new Set(medios.map(m => m?.medio_pago_id).filter(Boolean))];
  if (ids.length === 0) return 0;

  const { rows } = await client.query(
    `SELECT id FROM medios_pago WHERE id = ANY($1::uuid[]) AND es_caja_administrativa`,
    [ids]
  );
  const adm = new Set(rows.map(r => r.id));

  let total = 0;
  for (const m of medios) {
    if (!adm.has(m?.medio_pago_id)) continue;
    const importe = parseFloat(m.monto) || 0;
    if (importe > 0) total += importe;
  }
  return +total.toFixed(2);
}

// Descuenta de la Caja Administrativa lo que se pagó con su medio.
async function registrarEgresosCajaAdministrativaDeMedios(client, medios, datos) {
  const monto = await montoCajaAdministrativaDeMedios(client, medios);
  if (monto <= 0) return;
  await registrarMovimientoCajaAdministrativa(client, { ...datos, tipo: 'egreso', monto });
}

// La Caja Administrativa es de uso exclusivo del administrador: tira 403 si
// otro rol intenta pagar con ella.
async function exigirAdminSiUsaCajaAdministrativa(client, medios, rol) {
  if (rol === 'administrador') return;
  const monto = await montoCajaAdministrativaDeMedios(client, medios);
  if (monto > 0) {
    throw Object.assign(new Error('Solo un administrador puede pagar con la Caja Administrativa'), { status: 403 });
  }
}

// Deshace todos los movimientos de un origen (anulación o borrado). Se borran
// las filas: el ledger refleja lo vigente, no lo que se dio de baja.
async function revertirMovimientosCajaAdministrativa(client, origen_tipo, origen_id) {
  if (!origen_tipo || !origen_id) return;

  const { rows } = await client.query(`
    DELETE FROM movimientos_caja_administrativa
     WHERE origen_tipo = $1 AND origen_id = $2
     RETURNING tipo, monto
  `, [origen_tipo, origen_id]);

  // Un egreso revertido devuelve efectivo; un ingreso lo saca.
  const delta = rows.reduce(
    (s, r) => s + (r.tipo === 'egreso' ? 1 : -1) * (parseFloat(r.monto) || 0), 0
  );
  if (Math.abs(delta) >= 0.005) await ajustarSaldo(client, +delta.toFixed(2));
}

async function ajustarSaldo(client, delta) {
  await client.query(`
    INSERT INTO caja_administrativa (id, saldo, saldo_inicial)
    VALUES (1, $1, 0)
    ON CONFLICT (id) DO UPDATE
      SET saldo = caja_administrativa.saldo + EXCLUDED.saldo,
          updated_at = NOW()
  `, [delta.toFixed(2)]);
}

// Fija el saldo en el efectivo realmente contado re-basando `saldo_inicial`
// (no escribe `saldo` a secas ni deja movimiento). Gemelo de `fijarSaldoCajaFuerte`.
async function fijarSaldoCajaAdministrativa(client, nuevoSaldo) {
  const saldo = +(parseFloat(nuevoSaldo) || 0).toFixed(2);

  const { rows } = await client.query(`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END), 0)::float AS mov
      FROM movimientos_caja_administrativa
  `);

  const inicial = +(saldo - (rows[0].mov || 0)).toFixed(2);

  await client.query(`
    INSERT INTO caja_administrativa (id, saldo, saldo_inicial)
    VALUES (1, $1, $2)
    ON CONFLICT (id) DO UPDATE
      SET saldo = EXCLUDED.saldo,
          saldo_inicial = EXCLUDED.saldo_inicial,
          updated_at = NOW()
  `, [saldo, inicial]);

  return { saldo, saldo_inicial: inicial };
}

module.exports = {
  registrarMovimientoCajaAdministrativa,
  registrarEgresosCajaAdministrativaDeMedios,
  montoCajaAdministrativaDeMedios,
  exigirAdminSiUsaCajaAdministrativa,
  revertirMovimientosCajaAdministrativa,
  fijarSaldoCajaAdministrativa,
};
