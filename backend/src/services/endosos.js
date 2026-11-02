// Cheques de clientes endosados a proveedores que vuelven rechazados.
//
// Un cheque endosado en un Pago a Proveedores bajó la deuda con ese proveedor
// por su importe. Si el proveedor lo devuelve rechazado, ese importe se le
// vuelve a deber: se asienta un debe en su cuenta corriente. Va como
// 'correccion' (el CHECK de la tabla no admite otro tipo) con origen_id = el
// cheque, que es como se lo encuentra después para compensarlo.

const DESCRIPCION = 'Cheque endosado rechazado';

async function saldoMovimientos(client, proveedorId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(debe) - SUM(haber), 0) AS saldo
       FROM cuentas_corrientes_proveedor WHERE proveedor_id = $1`,
    [proveedorId]
  );
  return parseFloat(rows[0].saldo) || 0;
}

// Cuánto bajó el pago cada columna (facturado / no facturado). Un pago imputado
// asienta por comprobante, con la columna de cada uno; uno a cuenta, en la
// columna que eligió el usuario.
async function columnasDelPago(client, pago) {
  const { rows } = await client.query(
    `SELECT (e.tipo_comprobante IS NOT NULL AND e.tipo_comprobante <> 'informal') AS facturado,
            SUM(a.monto_aplicado)::float AS monto
       FROM pago_proveedor_aplicaciones a
       JOIN egresos e ON e.id = a.egreso_id
      WHERE a.pago_proveedor_id = $1
      GROUP BY 1`,
    [pago.id]
  );
  const aplicado = rows.reduce((s, r) => s + r.monto, 0);
  const cols = rows.map(r => ({ facturado: r.facturado, monto: r.monto }));
  const sinAplicar = +(parseFloat(pago.monto) - aplicado).toFixed(2);
  if (sinAplicar > 0.01) cols.push({ facturado: !!pago.facturado, monto: sinAplicar });
  return cols;
}

// Reparte `importe` en proporción a las columnas; el redondeo cae en la última.
function repartir(importe, cols) {
  const total = cols.reduce((s, c) => s + c.monto, 0);
  if (!total) return [{ facturado: false, monto: importe }];
  let resto = importe;
  return cols.map((c, i) => {
    const m = i === cols.length - 1 ? +resto.toFixed(2) : +(importe * c.monto / total).toFixed(2);
    resto -= m;
    return { facturado: c.facturado, monto: m };
  }).filter(c => c.monto > 0);
}

// Devuelve { proveedor, monto } si había un pago que lo endosó, o null si fue
// un endoso "suelto" (sin pago: no había bajado ninguna deuda).
async function reponerDeudaPorRechazo(client, chequeId) {
  const { rows: [en] } = await client.query(
    `SELECT pe.importe::float AS importe, pp.id, pp.monto, pp.facturado, pp.proveedor_id,
            pr.razon_social, to_char(pp.fecha, 'DD/MM/YYYY') AS fecha
       FROM pago_proveedor_endosos pe
       JOIN pagos_proveedor pp ON pp.id = pe.pago_proveedor_id AND NOT pp.anulado
       LEFT JOIN proveedores pr ON pr.id = pp.proveedor_id
      WHERE pe.cheque_id = $1
      LIMIT 1`,
    [chequeId]
  );
  if (!en) return null;

  const { rows: [ch] } = await client.query(
    `SELECT banco, numero_cheque FROM vw_cheques WHERE id = $1 LIMIT 1`, [chequeId]
  );
  const detalle = `${DESCRIPCION} — ${ch?.banco ?? 's/banco'} #${ch?.numero_cheque ?? 's/nro'} (pago del ${en.fecha})`;

  for (const c of repartir(en.importe, await columnasDelPago(client, en))) {
    const saldoPrev = await saldoMovimientos(client, en.proveedor_id);
    await client.query(
      `INSERT INTO cuentas_corrientes_proveedor
         (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
       VALUES ($1, $2, 0, $3, 'correccion', $4, $5, $6)`,
      [en.proveedor_id, c.monto, +(saldoPrev + c.monto).toFixed(2), chequeId, detalle, c.facturado]
    );
  }
  return { proveedor: en.razon_social, monto: en.importe };
}

// Al anular un pago, la anulación ya devuelve la deuda por el total del pago.
// Si alguno de sus cheques endosados había vuelto rechazado, esa parte de la
// deuda ya se había repuesto: se compensa para no deberla dos veces.
// `chequeIds`: los endosados del pago (la anulación borra el vínculo antes).
async function compensarRechazosDelPago(client, pagoId, chequeIds) {
  if (!chequeIds.length) return;
  const { rows } = await client.query(
    `SELECT cc.proveedor_id, cc.facturado, SUM(cc.debe - cc.haber)::float AS neto
       FROM cuentas_corrientes_proveedor cc
      WHERE cc.origen_tipo = 'correccion' AND cc.origen_id = ANY($1::uuid[])
        AND cc.descripcion LIKE $2
      GROUP BY cc.proveedor_id, cc.facturado`,
    [chequeIds, `${DESCRIPCION}%`]
  );
  for (const r of rows) {
    if (Math.abs(r.neto) < 0.01) continue;
    const saldoPrev = await saldoMovimientos(client, r.proveedor_id);
    const haber = r.neto > 0 ? r.neto : 0;
    const debe  = r.neto < 0 ? -r.neto : 0;
    await client.query(
      `INSERT INTO cuentas_corrientes_proveedor
         (proveedor_id, debe, haber, saldo, origen_tipo, origen_id, descripcion, facturado)
       VALUES ($1, $2, $3, $4, 'correccion', $5, $6, $7)`,
      [r.proveedor_id, debe, haber, +(saldoPrev + debe - haber).toFixed(2), pagoId,
       'Anulación de pago: compensa cheque endosado rechazado', r.facturado]
    );
  }
}

// ¿El rechazo de este cheque repuso deuda a un proveedor y sigue vigente? Si el
// pago que lo endosó se anuló, esa deuda ya se compensó y el cheque queda libre.
async function rechazoRepusoDeuda(client, chequeId) {
  const { rows } = await client.query(
    `SELECT 1 FROM cuentas_corrientes_proveedor cc
      WHERE cc.origen_tipo = 'correccion' AND cc.origen_id = $1 AND cc.descripcion LIKE $2
        AND EXISTS (SELECT 1 FROM pago_proveedor_endosos pe
                      JOIN pagos_proveedor pp ON pp.id = pe.pago_proveedor_id AND NOT pp.anulado
                     WHERE pe.cheque_id = $1)
      LIMIT 1`,
    [chequeId, `${DESCRIPCION}%`]
  );
  return rows.length > 0;
}

module.exports = { reponerDeudaPorRechazo, compensarRechazosDelPago, rechazoRepusoDeuda };
