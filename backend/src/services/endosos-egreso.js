// Endoso de cheques recibidos (en cartera) para pagar un egreso: sueldos,
// retiros, gastos. Mismo criterio que el endoso de Pago a Proveedores (mig 055):
// el cheque pasa de 'en_cartera' a 'endosado' y queda atado a la línea de pago
// del egreso (tabla egreso_endosos, mig 072). No toca el banco de KingPack ni
// la cuenta corriente del cliente.

// Origen (de vw_cheques) → tabla concreta donde vive el cheque recibido.
const TABLA_POR_ORIGEN = {
  venta:           'venta_cheques',
  manual:          'cheques_manuales',
  movimiento_caja: 'movimiento_caja_cheques',
};

// Normaliza y valida la lista que manda el front: [{ cheque_origen, cheque_id, importe }].
// Devuelve { error } o { endosos }. Se llama ANTES del BEGIN.
function validarEndosos(lista) {
  if (lista == null) return { endosos: [] };
  if (!Array.isArray(lista)) return { error: 'endosos debe ser una lista' };
  const vistos = new Set();
  const endosos = [];
  for (const e of lista) {
    if (!e || !TABLA_POR_ORIGEN[e.cheque_origen]) return { error: 'Origen de cheque a endosar inválido' };
    if (!e.cheque_id || typeof e.cheque_id !== 'string') return { error: 'Falta el cheque a endosar' };
    const importe = parseFloat(e.importe);
    if (!(importe > 0)) return { error: 'El importe de un cheque a endosar debe ser mayor a 0' };
    if (vistos.has(e.cheque_id)) return { error: 'Elegiste el mismo cheque dos veces' };
    vistos.add(e.cheque_id);
    endosos.push({ cheque_origen: e.cheque_origen, cheque_id: e.cheque_id, importe });
  }
  return { endosos };
}

// Marca endosados los cheques y los ata a la línea de pago del egreso.
// `destino` es el texto que queda como comprobante del endoso (a quién/para qué).
async function endosarChequesEnEgreso(client, {
  egresoId, egresoPagoId, endosos, proveedorId = null, destino, usuarioId = null,
}) {
  const comprobante = (destino || 'Egreso').substring(0, 50);
  for (const en of endosos) {
    const tabla = TABLA_POR_ORIGEN[en.cheque_origen];
    if (!tabla) throw Object.assign(new Error('Origen de cheque a endosar inválido'), { status: 400 });
    // Solo cheques_manuales mezcla recibido/emitido; ahí exigimos tipo recibido.
    const tipoCond = tabla === 'cheques_manuales' ? " AND tipo = 'recibido'" : '';
    // Atómico: si otro pago ya lo usó, no devuelve fila.
    const { rows: upd } = await client.query(
      `UPDATE ${tabla} SET estado = 'endosado', fecha_estado = CURRENT_DATE,
              endoso_proveedor_id = $2, endoso_fecha = CURRENT_DATE, endoso_comprobante = $3
        WHERE id = $1 AND estado = 'en_cartera'${tipoCond}
      RETURNING importe`,
      [en.cheque_id, proveedorId, comprobante]
    );
    if (!upd[0]) throw Object.assign(new Error('Un cheque elegido ya no está disponible en cartera'), { status: 409 });
    if (Math.abs(parseFloat(upd[0].importe) - en.importe) > 0.01) {
      throw Object.assign(new Error('El importe de un cheque a endosar no coincide con el registrado'), { status: 400 });
    }

    await client.query(`
      INSERT INTO cheque_historial_estados
        (cheque_tipo, cheque_id, estado_anterior, estado_nuevo, observacion, usuario_id)
      VALUES ('recibido', $1, 'en_cartera', 'endosado', $2, $3)
    `, [en.cheque_id, `Endosado en egreso — ${destino || ''}`.substring(0, 500), usuarioId]);

    await client.query(`
      INSERT INTO egreso_endosos (egreso_pago_id, egreso_id, cheque_origen, cheque_id, importe)
      VALUES ($1, $2, $3, $4, $5)
    `, [egresoPagoId, egresoId, en.cheque_origen, en.cheque_id, en.importe]);
  }
}

// Al anular un pago de egreso: los cheques endosados vuelven a cartera.
// Un cheque que ya volvió rechazado (u otro estado) bloquea: hay que resolverlo
// desde Cheques antes, como con los cheques propios ya debitados.
async function devolverEndososDePagoEgreso(client, egresoPagoId, usuarioId = null) {
  const { rows } = await client.query(
    `SELECT cheque_origen, cheque_id FROM egreso_endosos WHERE egreso_pago_id = $1`, [egresoPagoId]
  );
  for (const e of rows) {
    const tabla = TABLA_POR_ORIGEN[e.cheque_origen];
    if (!tabla) continue;
    const { rows: upd } = await client.query(
      `UPDATE ${tabla}
          SET estado = 'en_cartera', fecha_estado = NULL,
              endoso_proveedor_id = NULL, endoso_fecha = NULL, endoso_comprobante = NULL
        WHERE id = $1 AND estado = 'endosado'
      RETURNING id`, [e.cheque_id]
    );
    if (!upd[0]) {
      const { rows: est } = await client.query(`SELECT estado FROM ${tabla} WHERE id = $1`, [e.cheque_id]);
      throw Object.assign(new Error(
        `Un cheque endosado en este pago está "${est[0]?.estado ?? 'desconocido'}": resolvelo desde Cheques antes de anular el pago`
      ), { status: 400 });
    }
    await client.query(`
      INSERT INTO cheque_historial_estados
        (cheque_tipo, cheque_id, estado_anterior, estado_nuevo, observacion, usuario_id)
      VALUES ('recibido', $1, 'endosado', 'en_cartera', 'Anulación de pago de egreso', $2)
    `, [e.cheque_id, usuarioId]);
  }
  return rows.length;
}

module.exports = { TABLA_POR_ORIGEN, validarEndosos, endosarChequesEnEgreso, devolverEndososDePagoEgreso };
