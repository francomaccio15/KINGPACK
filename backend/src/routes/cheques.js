const express = require('express');
const { pool } = require('../config/db');
const { sucursalEfectiva } = require('../middleware/auth');
const {
  registrarMovimientoBancario,
  revertirMovimientosBancarios,
  cuentaChequesId,
  cuentaDestinoCheque,
} = require('../services/movimientos-bancarios');
const { validarAltaCheque, CAUSALES_RECHAZO } = require('../services/cheques-validacion');

const router = express.Router();

const ESTADOS_RECIBIDO = ['en_cartera', 'depositado', 'acreditado', 'endosado', 'rechazado', 'anulado'];
const ESTADOS_EMITIDO  = ['emitido', 'presentado', 'debitado', 'rechazado', 'anulado'];

// Transiciones válidas
const TRANSICIONES = {
  recibido: {
    en_cartera: ['depositado', 'endosado', 'rechazado', 'anulado'],
    depositado:  ['acreditado', 'rechazado'],
    acreditado:  [],
    endosado:    [],
    rechazado:   ['anulado'],
    anulado:     [],
  },
  emitido: {
    emitido:    ['presentado', 'debitado', 'rechazado', 'anulado'],
    presentado: ['debitado', 'rechazado'],
    debitado:   [],
    rechazado:  ['anulado'],
    anulado:    [],
  },
};

// ─── GET /api/cheques/resumen ─────────────────────────────────────────────────
router.get('/resumen', async (req, res, next) => {
  try {
    const sucId = sucursalEfectiva(req);
    const sucFiltro = sucId ? `AND sucursal_id = $1` : '';
    const params = sucId ? [sucId] : [];
    const hoy = new Date().toISOString().slice(0, 10);

    const sql = `
      SELECT
        -- Recibidos en cartera
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
        ), 0) AS recibidos_en_cartera,

        -- Recibidos por vencer en 7 días
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
            AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        ), 0) AS recibidos_por_vencer_7d,

        -- Recibidos vencidos sin depositar
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
            AND fecha_vencimiento < CURRENT_DATE
        ), 0) AS recibidos_vencidos,

        COUNT(*) FILTER (
          WHERE tipo = 'recibido' AND estado = 'en_cartera'
            AND fecha_vencimiento < CURRENT_DATE
        ) AS recibidos_vencidos_cant,

        -- Recibidos rechazados este mes
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'recibido' AND estado = 'rechazado'
            AND fecha_estado >= DATE_TRUNC('month', CURRENT_DATE)
        ), 0) AS recibidos_rechazados_mes,

        -- Emitidos comprometidos
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'emitido' AND estado IN ('emitido','presentado')
        ), 0) AS emitidos_comprometidos,

        -- Emitidos a vencer en 7 días
        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'emitido' AND estado IN ('emitido','presentado')
            AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        ), 0) AS emitidos_por_vencer_7d,

        -- Emitidos rechazados (crítico)
        COUNT(*) FILTER (
          WHERE tipo = 'emitido' AND estado = 'rechazado'
        ) AS emitidos_rechazados_cant,

        COALESCE(SUM(importe) FILTER (
          WHERE tipo = 'emitido' AND estado = 'rechazado'
        ), 0) AS emitidos_rechazados_monto

      FROM vw_cheques
      WHERE 1=1 ${sucFiltro}
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─── GET /api/cheques ─────────────────────────────────────────────────────────
// ?tipo=          recibido | emitido
// ?estado=        en_cartera | depositado | …
// ?banco=         texto libre
// ?fecha_venc_desde= ISO date
// ?fecha_venc_hasta= ISO date
// ?limit=         default 100
// ?offset=        default 0
router.get('/', async (req, res, next) => {
  try {
    const {
      tipo, estado, banco,
      fecha_venc_desde, fecha_venc_hasta,
      limit = 100, offset = 0,
    } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    const sucId = sucursalEfectiva(req);
    if (sucId) {
      conditions.push(`sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (tipo && ['recibido','emitido'].includes(tipo)) {
      conditions.push(`tipo = $${idx++}`);
      params.push(tipo);
    }
    if (estado) {
      conditions.push(`estado = $${idx++}`);
      params.push(estado);
    }
    if (banco) {
      conditions.push(`LOWER(banco) LIKE $${idx++}`);
      params.push(`%${banco.toLowerCase()}%`);
    }
    if (fecha_venc_desde) {
      conditions.push(`fecha_vencimiento >= $${idx++}`);
      params.push(fecha_venc_desde);
    }
    if (fecha_venc_hasta) {
      conditions.push(`fecha_vencimiento <= $${idx++}`);
      params.push(fecha_venc_hasta);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          tipo, id, banco, numero_cheque,
          fecha_emision, fecha_vencimiento,
          importe, estado, fecha_estado, observaciones,
          origen_id, origen_tipo, origen_nombre,
          sucursal_id, sucursal_nombre,
          CASE
            WHEN fecha_vencimiento < CURRENT_DATE AND estado NOT IN ('acreditado','debitado','rechazado','anulado')
            THEN true ELSE false
          END AS vencido
        FROM vw_cheques
        ${where}
        ORDER BY fecha_vencimiento ASC, importe DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`SELECT COUNT(*) FROM vw_cheques ${where}`, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), cheques: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/cheques ────────────────────────────────────────────────────────
// Alta manual de un cheque (no atado a una venta ni a un egreso).
// Pensado para la carga inicial de cheques de clientes / cheques propios.
// Body: { tipo, banco, numero_cheque, fecha_emision, fecha_vencimiento,
//         importe, estado?, sucursal_id, cliente_id?, proveedor_id?, observaciones?,
//         forma, modalidad, banco_sucursal | banco_cbu,
//         librador_cuit + librador_nombre (obligatorios si es recibido) }
// Las reglas de la mig 059 (CUIT, CBU, vigencia) viven en cheques-validacion.js.
router.post('/', async (req, res, next) => {
  try {
    const {
      tipo, banco, numero_cheque, fecha_emision, fecha_vencimiento,
      importe, estado, sucursal_id, cliente_id, proveedor_id, observaciones,
    } = req.body;

    if (!['recibido', 'emitido'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser recibido o emitido' });
    }
    if (!banco?.trim())         return res.status(400).json({ error: 'banco es requerido' });
    if (!numero_cheque?.trim()) return res.status(400).json({ error: 'numero_cheque es requerido' });
    if (!fecha_vencimiento)     return res.status(400).json({ error: 'fecha_vencimiento es requerida' });
    if (!sucursal_id)           return res.status(400).json({ error: 'sucursal_id es requerido' });
    const importeNum = parseFloat(importe);
    if (!importeNum || importeNum <= 0) return res.status(400).json({ error: 'importe debe ser mayor a 0' });
    if (!/^\d+(\.\d{1,2})?$/.test(String(importe).trim())) {
      return res.status(400).json({ error: 'El importe admite como máximo 2 decimales' });
    }

    const validacion = validarAltaCheque(req.body);
    if (validacion.error) return res.status(400).json({ error: validacion.error });
    const extra = validacion.datos;

    const estadosValidos = tipo === 'recibido' ? ESTADOS_RECIBIDO : ESTADOS_EMITIDO;
    const estadoInicial = estado || (tipo === 'recibido' ? 'en_cartera' : 'emitido');
    if (!estadosValidos.includes(estadoInicial)) {
      return res.status(400).json({ error: `Estado inválido para cheque ${tipo}: ${estadoInicial}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Un mismo cheque no puede existir dos veces: banco + número (+ librador si
      // se conoce). Es el error de carga más caro — duplica cartera y banco.
      const { rows: dup } = await client.query(`
        SELECT origen_nombre, estado FROM vw_cheques
         WHERE LOWER(TRIM(banco)) = LOWER($1) AND TRIM(numero_cheque) = $2
           AND ($3::text IS NULL OR librador_cuit IS NULL OR librador_cuit = $3)
           AND estado <> 'anulado'
         LIMIT 1`, [banco.trim(), numero_cheque.trim(), extra.librador_cuit]);
      if (dup.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Ya existe el cheque ${banco.trim()} #${numero_cheque.trim()} (${dup[0].origen_nombre}, ${dup[0].estado})`,
        });
      }

      const { rows } = await client.query(`
        INSERT INTO cheques_manuales
          (tipo, banco, numero_cheque, fecha_emision, fecha_vencimiento,
           importe, estado, fecha_estado, sucursal_id, cliente_id, proveedor_id, observaciones,
           forma, modalidad, librador_cuit, librador_nombre, banco_sucursal, banco_cbu)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING id
      `, [
        tipo,
        banco.trim(),
        numero_cheque.trim(),
        fecha_emision || null,
        fecha_vencimiento,
        importeNum,
        estadoInicial,
        estado ? new Date().toISOString().slice(0, 10) : null,
        sucursal_id,
        tipo === 'recibido' ? (cliente_id || null) : null,
        tipo === 'emitido'  ? (proveedor_id || null) : null,
        observaciones?.trim() || null,
        extra.forma,
        extra.modalidad,
        extra.librador_cuit,
        extra.librador_nombre,
        extra.banco_sucursal,
        extra.banco_cbu,
      ]);

      // Un cheque RECIBIDO impacta el banco recién cuando efectivamente se cobra:
      // solo si nace ya 'acreditado' (plata que ya está en la cuenta) se registra el
      // ingreso ahora. En 'en_cartera'/'depositado'/'endosado' NO toca el saldo — lo
      // hará al pasar a 'acreditado' (por el PATCH, cuya guarda evita duplicar, o por
      // el cron al vencer). Los emitidos recién descuentan al pasar a 'debitado'.
      if (tipo === 'recibido' && estadoInicial === 'acreditado') {
        const cuenta = await cuentaChequesId(client);
        if (cuenta) {
          await registrarMovimientoBancario(client, {
            cuenta_bancaria_id: cuenta,
            tipo: 'ingreso',
            monto: importeNum,
            concepto: `Cheque recibido — ${banco.trim()} #${numero_cheque.trim()}`,
            origen_tipo: 'cheque',
            origen_id: rows[0].id,
            usuario_id: req.usuario?.id ?? null,
          });
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ ok: true, id: rows[0].id });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ─── GET /api/cheques/causales-rechazo ────────────────────────────────────────
router.get('/causales-rechazo', (req, res) => {
  res.json({ causales: Object.entries(CAUSALES_RECHAZO).map(([value, label]) => ({ value, label })) });
});

// ─── GET /api/cheques/:tipo/:id ───────────────────────────────────────────────
router.get('/:tipo/:id', async (req, res, next) => {
  try {
    const { tipo, id } = req.params;
    if (!['recibido','emitido'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser recibido o emitido' });
    }

    const [{ rows: chequeRows }, { rows: historialRows }] = await Promise.all([
      pool.query(
        `SELECT vw.*, CASE
            WHEN vw.fecha_vencimiento < CURRENT_DATE AND vw.estado NOT IN ('acreditado','debitado','rechazado','anulado')
            THEN true ELSE false
         END AS vencido,
         cb.nombre        AS deposito_cuenta_nombre,
         pe.razon_social  AS endoso_proveedor_nombre
         FROM vw_cheques vw
         LEFT JOIN cuentas_bancarias_empresa cb ON cb.id = vw.deposito_cuenta_id
         LEFT JOIN proveedores               pe ON pe.id = vw.endoso_proveedor_id
         WHERE vw.tipo = $1 AND vw.id = $2`,
        [tipo, id]
      ),
      pool.query(
        `SELECT h.*, u.nombre AS usuario_nombre
         FROM cheque_historial_estados h
         LEFT JOIN usuarios u ON u.id = h.usuario_id
         WHERE h.cheque_tipo = $1 AND h.cheque_id = $2
         ORDER BY h.created_at DESC`,
        [tipo, id]
      ),
    ]);

    if (chequeRows.length === 0) return res.status(404).json({ error: 'Cheque no encontrado' });
    res.json({ cheque: chequeRows[0], historial: historialRows });
  } catch (err) { next(err); }
});

// ─── PATCH /api/cheques/:tipo/:id/estado ──────────────────────────────────────
// Body: { estado_nuevo, observacion, fecha_estado, ...datos de la transición }
//   depositado (recibido) → deposito_cuenta_id   (opcional: default cuenta de cheques)
//   endosado   (recibido) → endoso_proveedor_id, endoso_fecha, endoso_comprobante
//   rechazado             → rechazo_causal  (ver CAUSALES_RECHAZO)
router.patch('/:tipo/:id/estado', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { tipo, id } = req.params;
    const {
      estado_nuevo, observacion, fecha_estado,
      deposito_cuenta_id, endoso_proveedor_id, endoso_fecha, endoso_comprobante,
      rechazo_causal,
    } = req.body;

    // Lo que cada transición exige, ANTES de abrir la transacción.
    if (estado_nuevo === 'endosado') {
      if (!endoso_proveedor_id)        return res.status(400).json({ error: 'Al endosar, indicá el proveedor que lo recibe' });
      if (!endoso_fecha)               return res.status(400).json({ error: 'Al endosar, indicá la fecha de entrega' });
      if (!endoso_comprobante?.trim()) return res.status(400).json({ error: 'Al endosar, indicá la orden de pago o factura que cancela' });
    }
    if (estado_nuevo === 'rechazado') {
      if (!rechazo_causal || !CAUSALES_RECHAZO[rechazo_causal]) {
        return res.status(400).json({ error: 'Al rechazar, indicá la causal del rechazo' });
      }
      if (rechazo_causal === 'otro' && !observacion?.trim()) {
        return res.status(400).json({ error: 'Causal "Otro": detallá el motivo en la observación' });
      }
    }

    if (!['recibido','emitido'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser recibido o emitido' });
    }

    const estadosValidos = tipo === 'recibido' ? ESTADOS_RECIBIDO : ESTADOS_EMITIDO;
    if (!estadosValidos.includes(estado_nuevo)) {
      return res.status(400).json({ error: `Estado inválido: ${estado_nuevo}` });
    }

    await client.query('BEGIN');

    // ¿Es un cheque cargado manualmente? (no atado a venta/egreso)
    const { rows: manualRows } = await client.query(
      `SELECT id FROM cheques_manuales WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const esManual = manualRows.length > 0;

    // ¿Es un cheque emitido desde Pago a Proveedores?
    let esPagoProveedor = false;
    if (!esManual) {
      const { rows: ppcRows } = await client.query(
        `SELECT id FROM pago_proveedor_cheques WHERE id = $1`, [id]
      );
      esPagoProveedor = ppcRows.length > 0;
    }

    // ¿Es un cheque recibido en un movimiento de caja manual? (origen 'movimiento_caja'
    // en vw_cheques). Sin esta rama caería a venta_cheques y devolvería 404.
    let esMovCaja = false;
    if (!esManual && !esPagoProveedor) {
      const { rows: mccRows } = await client.query(
        `SELECT id FROM movimiento_caja_cheques WHERE id = $1`, [id]
      );
      esMovCaja = mccRows.length > 0;
    }

    // Obtener estado actual
    const tabla = esManual
      ? 'cheques_manuales'
      : esPagoProveedor
        ? 'pago_proveedor_cheques'
        : esMovCaja
          ? 'movimiento_caja_cheques'
          : (tipo === 'recibido' ? 'venta_cheques' : 'egreso_cheques');
    const { rows: actual } = await client.query(
      `SELECT id, estado FROM ${tabla} WHERE id = $1`,
      [id]
    );
    if (actual.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cheque no encontrado' });
    }

    const estadoActual = actual[0].estado;

    // Verificar transición válida
    const transicionesValidas = TRANSICIONES[tipo][estadoActual] || [];
    if (!transicionesValidas.includes(estado_nuevo)) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: `Transición inválida: ${estadoActual} → ${estado_nuevo}`,
        transiciones_validas: transicionesValidas,
      });
    }

    const fechaEstado = fecha_estado || new Date().toISOString().slice(0, 10);
    const usuario_id = req.usuario?.id ?? null;

    // Validar los destinos contra la base (no alcanza con que vengan).
    let cuentaDeposito = null;
    if (estado_nuevo === 'depositado' && deposito_cuenta_id) {
      const { rows: cta } = await client.query(
        `SELECT id FROM cuentas_bancarias_empresa WHERE id = $1 AND activo`, [deposito_cuenta_id]
      );
      if (!cta.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La cuenta de depósito no existe o está inactiva' });
      }
      cuentaDeposito = deposito_cuenta_id;
    }
    if (estado_nuevo === 'endosado') {
      const { rows: prov } = await client.query(
        `SELECT id FROM proveedores WHERE id = $1`, [endoso_proveedor_id]
      );
      if (!prov.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El proveedor del endoso no existe' });
      }
    }

    // Actualizar estado (+ el dato propio de la transición; el resto se preserva)
    await client.query(
      `UPDATE ${tabla}
       SET estado = $1, fecha_estado = $2, observaciones = COALESCE($3, observaciones),
           deposito_cuenta_id  = COALESCE($5, deposito_cuenta_id),
           endoso_proveedor_id = COALESCE($6, endoso_proveedor_id),
           endoso_fecha        = COALESCE($7, endoso_fecha),
           endoso_comprobante  = COALESCE($8, endoso_comprobante),
           rechazo_causal      = COALESCE($9, rechazo_causal)
       WHERE id = $4`,
      [
        estado_nuevo, fechaEstado, observacion || null, id,
        cuentaDeposito,
        estado_nuevo === 'endosado' ? endoso_proveedor_id : null,
        estado_nuevo === 'endosado' ? endoso_fecha : null,
        estado_nuevo === 'endosado' ? endoso_comprobante.trim() : null,
        estado_nuevo === 'rechazado' ? rechazo_causal : null,
      ]
    );

    // Registrar en historial (con la causal / el destino escritos, para que la
    // auditoría se lea sola sin cruzar tablas)
    const detalle = [
      estado_nuevo === 'rechazado' ? CAUSALES_RECHAZO[rechazo_causal] : null,
      estado_nuevo === 'endosado' ? `Endoso — comprobante ${endoso_comprobante.trim()}` : null,
      observacion?.trim() || null,
    ].filter(Boolean).join(' · ') || null;
    await client.query(
      `INSERT INTO cheque_historial_estados
         (cheque_tipo, cheque_id, estado_anterior, estado_nuevo, observacion, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tipo, id, estadoActual, estado_nuevo, detalle, usuario_id]
    );

    // ── Efecto en el banco (mig 049) ───────────────────────────────────────────
    // Todos los cheques se cobran/pagan por la cuenta marcada `es_cuenta_cheques`.
    //
    // Los EMITIDOS descuentan cuando el banco los debita de verdad.
    //
    // Los RECIBIDOS normalmente ya acreditaron al cargarse (ver POST de arriba),
    // así que acá no se vuelven a sumar. La excepción son los cargados ANTES de
    // esa regla (21/07/2026): no tienen movimiento, y si no se acreditaran al
    // cobrarse el saldo del banco quedaría corto para siempre. Por eso se mira
    // si el cheque ya movió el saldo alguna vez, en vez de asumirlo.
    const impactaBanco =
      (tipo === 'emitido'  && estado_nuevo === 'debitado') ||
      (tipo === 'recibido' && estado_nuevo === 'acreditado');

    if (impactaBanco) {
      const { rows: yaMovio } = await client.query(
        `SELECT 1 FROM movimientos_cuenta_bancaria
          WHERE origen_tipo = 'cheque' AND origen_id = $1 LIMIT 1`, [id]
      );
      const cuenta = yaMovio.length ? null : await cuentaDestinoCheque(client, id);
      if (cuenta) {
        const { rows: chq } = await client.query(
          `SELECT importe, banco, numero_cheque FROM ${tabla} WHERE id = $1`, [id]
        );
        const c = chq[0];
        const esIngreso = tipo === 'recibido';
        await registrarMovimientoBancario(client, {
          cuenta_bancaria_id: cuenta,
          tipo: esIngreso ? 'ingreso' : 'egreso',
          monto: c.importe,
          concepto: `Cheque ${esIngreso ? 'acreditado' : 'debitado'} — ${c.banco ?? 's/banco'} #${c.numero_cheque ?? 's/nro'}`,
          origen_tipo: 'cheque',
          origen_id: id,
          usuario_id,
          fecha: fechaEstado,
        });
      }
    }

    // Si el cheque se rechaza, se deshace lo que hubiera impactado en el banco.
    // Hoy las transiciones no permiten rechazar uno ya acreditado/debitado, así
    // que esto es una red de seguridad: sin movimientos, no hace nada.
    if (estado_nuevo === 'rechazado' || estado_nuevo === 'anulado') {
      await revertirMovimientosBancarios(client, 'cheque', id);
    }

    // ── Efecto en Caja ─────────────────────────────────────────────────────────
    // Cheque RECIBIDO rechazado → reversal en caja (el ingreso original queda anulado)
    if (tipo === 'recibido' && estado_nuevo === 'rechazado') {
      const { rows: chequeInfo } = await client.query(`
        SELECT vc.banco, vc.numero_cheque, vc.importe,
               v.numero AS venta_numero, v.sucursal_id,
               cl.razon_social AS cliente_nombre
          FROM venta_cheques vc
          JOIN ventas v    ON v.id  = vc.venta_id
          LEFT JOIN clientes cl ON cl.id = v.cliente_id
         WHERE vc.id = $1
      `, [id]);

      if (chequeInfo[0]) {
        const ch = chequeInfo[0];
        const { rows: cajaRows } = await client.query(
          `SELECT id FROM cajas WHERE sucursal_id = $1 AND estado = 'abierta' LIMIT 1`,
          [ch.sucursal_id]
        );
        if (cajaRows[0]) {
          const motivo = ` (${[CAUSALES_RECHAZO[rechazo_causal], observacion?.trim()].filter(Boolean).join(' — ')})`;
          await client.query(`
            INSERT INTO movimientos_caja (caja_id, tipo, concepto, monto, medio_pago_id)
            SELECT $1, 'egreso',
                   $2,
                   $3,
                   mp.id
              FROM medios_pago mp
             WHERE LOWER(mp.nombre) LIKE '%cheque%' LIMIT 1
          `, [
            cajaRows[0].id,
            `Cheque rechazado — ${ch.banco} #${ch.numero_cheque} — ${ch.cliente_nombre ?? 'Cliente'}${motivo} [Venta #${ch.venta_numero}]`,
            parseFloat(ch.importe),
          ]);
        }
      }
    }

    // Cheque RECIBIDO acreditado → NO se registra nada extra en caja: la venta ya
    // dejó su movimiento (`Venta #N`) al momento de la venta, y la acreditación se
    // refleja en el banco (bloque `impactaBanco` de arriba). Volver a insertarlo acá
    // duplicaba el cheque en caja. La plata entra al banco recién al acreditarse, que
    // es cuando el cheque efectivamente impacta.

    await client.query('COMMIT');

    res.json({ ok: true, estado_anterior: estadoActual, estado_nuevo });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/cheques/por-cliente ─────────────────────────────────────────────
// Cheques recibidos agrupados por cliente con detalle
router.get('/por-cliente', async (req, res, next) => {
  try {
    const { estado, banco } = req.query;
    const sucId = sucursalEfectiva(req);

    const conditions = [`v.deleted_at IS NULL`];
    const params = [];
    let idx = 1;

    if (sucId) {
      conditions.push(`v.sucursal_id = $${idx++}`);
      params.push(sucId);
    }
    if (estado) {
      conditions.push(`vc.estado = $${idx++}`);
      params.push(estado);
    }
    if (banco) {
      conditions.push(`LOWER(vc.banco) LIKE $${idx++}`);
      params.push(`%${banco.toLowerCase()}%`);
    }

    const where = conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        cl.id            AS cliente_id,
        cl.razon_social  AS cliente_nombre,
        cl.telefono      AS cliente_telefono,
        COUNT(vc.id)     AS cantidad,
        COALESCE(SUM(vc.importe), 0)                                                  AS total,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'en_cartera'),  0)         AS en_cartera,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'depositado'),  0)         AS depositado,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'acreditado'),  0)         AS acreditado,
        COALESCE(SUM(vc.importe) FILTER (WHERE vc.estado = 'rechazado'),   0)         AS rechazado,
        COUNT(vc.id)     FILTER (WHERE vc.estado = 'rechazado')                       AS rechazado_cant,
        COUNT(vc.id)     FILTER (WHERE vc.fecha_vencimiento < CURRENT_DATE
                                   AND vc.estado NOT IN ('acreditado','rechazado','anulado')) AS vencidos_cant,
        json_agg(
          json_build_object(
            'id',                vc.id,
            'banco',             vc.banco,
            'numero_cheque',     vc.numero_cheque,
            'fecha_emision',     vc.fecha_emision,
            'fecha_vencimiento', vc.fecha_vencimiento,
            'importe',           vc.importe,
            'estado',            vc.estado,
            'fecha_estado',      vc.fecha_estado,
            'venta_numero',      v.numero,
            'venta_id',          v.id,
            'vencido',           (vc.fecha_vencimiento < CURRENT_DATE AND vc.estado NOT IN ('acreditado','rechazado','anulado'))
          ) ORDER BY vc.fecha_vencimiento ASC
        ) AS cheques
      FROM venta_cheques vc
      JOIN ventas   v  ON v.id  = vc.venta_id
      JOIN clientes cl ON cl.id = v.cliente_id
      WHERE ${where}
      GROUP BY cl.id, cl.razon_social, cl.telefono
      ORDER BY SUM(vc.importe) FILTER (WHERE vc.estado IN ('en_cartera','depositado')) DESC NULLS LAST,
               cl.razon_social
    `, params);

    res.json({ clientes: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/cheques/emitidos-resumen ────────────────────────────────────────
// Cheques emitidos por proveedor + nro factura, con columnas por mes
router.get('/emitidos-resumen', async (req, res, next) => {
  try {
    const { meses = 6 } = req.query;
    const sucId = sucursalEfectiva(req);

    const conditions = [`ec.estado NOT IN ('anulado')`];
    const params = [];
    let idx = 1;

    if (sucId) {
      conditions.push(`e.sucursal_id = $${idx++}`);
      params.push(sucId);
    }

    const where = conditions.join(' AND ');

    // Cheques emitidos con info del proveedor y egreso
    const { rows } = await pool.query(`
      SELECT
        COALESCE(pr.razon_social, 'Sin proveedor')  AS proveedor_nombre,
        pr.id                                        AS proveedor_id,
        e.numero_comprobante                         AS nro_factura,
        e.id                                         AS egreso_id,
        ec.id                                        AS cheque_id,
        ec.banco,
        ec.numero_cheque,
        ec.fecha_emision,
        ec.fecha_vencimiento,
        ec.importe,
        ec.estado,
        ec.fecha_estado,
        DATE_TRUNC('month', ec.fecha_vencimiento)    AS mes_venc,
        s.nombre                                     AS sucursal_nombre
      FROM egreso_cheques ec
      JOIN egreso_pagos   ep ON ep.id  = ec.egreso_pago_id
      JOIN egresos        e  ON e.id   = ep.egreso_id
      LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
      JOIN sucursales     s  ON s.id   = e.sucursal_id
      WHERE ${where}
        AND ec.fecha_vencimiento >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
        AND ec.fecha_vencimiento <  DATE_TRUNC('month', CURRENT_DATE) + (${parseInt(meses) || 6} || ' months')::INTERVAL
      ORDER BY ec.fecha_vencimiento ASC, pr.razon_social
    `, params);

    // Extraer meses únicos presentes
    const mesesSet = new Set(rows.map(r => r.mes_venc?.toISOString?.().slice(0, 7) ?? ''));
    const mesesOrdenados = [...mesesSet].filter(Boolean).sort();

    res.json({ cheques: rows, meses: mesesOrdenados });
  } catch (err) { next(err); }
});

module.exports = router;
