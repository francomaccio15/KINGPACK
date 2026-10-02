-- KINGPACK — Migración 059: datos del librador, forma (físico/ECHEQ),
-- destino de depósito/endoso y causal de rechazo tipificada.
--
-- Hasta acá un cheque se identificaba solo por banco + número. Para control
-- contable y reclamo al cliente hace falta saber QUIÉN lo libró (CUIT y nombre),
-- de qué sucursal/CBU salió, si es físico o ECHEQ, y —cuando sale de cartera—
-- a dónde fue (cuenta de depósito o proveedor endosado, con el comprobante que
-- cancela). Al rechazarse, la causal deja de ser texto libre.
--
-- ⚠ TODO el histórico queda en NULL a propósito. Estos campos se exigen SOLO en
-- altas nuevas, desde la aplicación — nunca con NOT NULL acá, o se rompe cada
-- pantalla que lista cheques viejos.
--
-- Nombre de la columna: `forma`, no `tipo`. `cheques_manuales.tipo` ya existe y
-- significa recibido/emitido; pisarlo sería un desastre silencioso.
--
-- `forma` y `modalidad` son dos ejes distintos y los dos hacen falta:
--   forma      fisico | echeq      — soporte del instrumento
--   modalidad  al_dia | diferido   — define la vigencia máxima emisión→vencimiento
--                                    (común: 30 días corridos; diferido: hasta 360)
-- Sin `modalidad` la regla de los 30 días no se puede decidir: un ECHEQ también
-- puede ser al día, y un cheque físico también puede ser de pago diferido.
--
-- Causales de rechazo (CHECK y no tabla: son pocas, estables, nadie las administra):
--   sin_fondos         Causal 1 — sin fondos suficientes
--   defecto_formal     Causal 2 — defecto formal (firma, fecha, importe en letras)
--   orden_no_pagar     Orden de no pagar del librador
--   cuenta_cerrada     Cuenta cerrada / inhabilitada
--   firma_falsa        Firma falsificada o adulteración
--   denuncia_extravio  Denunciado como extraviado o robado
--   otro               Cualquier otra (se detalla en observaciones)

-- ─── Columnas en cada tabla de cheques ───────────────────────────────────────
-- Son cinco tablas porque un cheque entra al sistema por cinco puertas
-- distintas (venta, egreso, carga manual, pago a proveedor, movimiento de caja).
-- vw_cheques las unifica más abajo.

DO $mig$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'venta_cheques',
    'egreso_cheques',
    'cheques_manuales',
    'pago_proveedor_cheques',
    'movimiento_caja_cheques'
  ]
  LOOP
    EXECUTE format($f$
      ALTER TABLE %I
        ADD COLUMN IF NOT EXISTS forma               VARCHAR(10),
        ADD COLUMN IF NOT EXISTS modalidad           VARCHAR(10),
        ADD COLUMN IF NOT EXISTS librador_cuit       VARCHAR(13),
        ADD COLUMN IF NOT EXISTS librador_nombre     VARCHAR(120),
        ADD COLUMN IF NOT EXISTS banco_sucursal      VARCHAR(80),
        ADD COLUMN IF NOT EXISTS banco_cbu           VARCHAR(22),
        ADD COLUMN IF NOT EXISTS rechazo_causal      VARCHAR(20),
        ADD COLUMN IF NOT EXISTS deposito_cuenta_id  UUID REFERENCES cuentas_bancarias_empresa(id),
        ADD COLUMN IF NOT EXISTS endoso_proveedor_id UUID REFERENCES proveedores(id),
        ADD COLUMN IF NOT EXISTS endoso_comprobante  VARCHAR(50),
        ADD COLUMN IF NOT EXISTS endoso_fecha        DATE
    $f$, t);

    -- Los CHECK van aparte: ADD CONSTRAINT no tiene IF NOT EXISTS, así que se
    -- consulta el catálogo para que la migración sea idempotente.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_forma_chk') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (forma IS NULL OR forma IN (''fisico'',''echeq''))',
        t, t || '_forma_chk');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_modalidad_chk') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (modalidad IS NULL OR modalidad IN (''al_dia'',''diferido''))',
        t, t || '_modalidad_chk');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_rechazo_causal_chk') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (rechazo_causal IS NULL OR rechazo_causal IN
           (''sin_fondos'',''defecto_formal'',''orden_no_pagar'',''cuenta_cerrada'',
            ''firma_falsa'',''denuncia_extravio'',''otro''))',
        t, t || '_rechazo_causal_chk');
    END IF;
  END LOOP;
END $mig$;

-- Búsqueda por librador: es el reclamo típico ("¿qué me rebotó de este CUIT?").
CREATE INDEX IF NOT EXISTS idx_venta_cheques_librador    ON venta_cheques(librador_cuit)    WHERE librador_cuit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cheques_manuales_librador ON cheques_manuales(librador_cuit) WHERE librador_cuit IS NOT NULL;

-- ─── Vista unificada: se exponen los campos nuevos ───────────────────────────
-- Se agregan AL FINAL para que CREATE OR REPLACE funcione sin DROP (Postgres
-- permite apéndices, no reordenar ni renombrar lo existente).
-- movimiento_caja_cheques no tiene fecha_emision; sigue dando NULL.
CREATE OR REPLACE VIEW vw_cheques AS
SELECT
  'recibido'          AS tipo,
  vc.id, vc.banco, vc.numero_cheque, vc.fecha_emision, vc.fecha_vencimiento,
  vc.importe, vc.estado, vc.fecha_estado, vc.observaciones,
  v.id                AS origen_id,
  'venta'             AS origen_tipo,
  COALESCE(cl.razon_social, 'Consumidor Final') AS origen_nombre,
  v.sucursal_id, s.nombre AS sucursal_nombre,
  vc.forma, vc.modalidad, vc.librador_cuit,
  COALESCE(vc.librador_nombre, cl.razon_social) AS librador_nombre,
  vc.banco_sucursal, vc.banco_cbu, vc.rechazo_causal,
  vc.deposito_cuenta_id, vc.endoso_proveedor_id, vc.endoso_comprobante, vc.endoso_fecha
FROM venta_cheques vc
JOIN ventas   v  ON v.id  = vc.venta_id
LEFT JOIN clientes cl ON cl.id = v.cliente_id
JOIN sucursales s ON s.id = v.sucursal_id
WHERE v.deleted_at IS NULL

UNION ALL

SELECT
  'emitido'           AS tipo,
  ec.id, ec.banco, ec.numero_cheque, ec.fecha_emision, ec.fecha_vencimiento,
  ec.importe, ec.estado, ec.fecha_estado, ec.observaciones,
  e.id                AS origen_id,
  'egreso'            AS origen_tipo,
  COALESCE(pr.razon_social, 'Sin proveedor') AS origen_nombre,
  e.sucursal_id, s.nombre AS sucursal_nombre,
  ec.forma, ec.modalidad, ec.librador_cuit, ec.librador_nombre,
  ec.banco_sucursal, ec.banco_cbu, ec.rechazo_causal,
  ec.deposito_cuenta_id, ec.endoso_proveedor_id, ec.endoso_comprobante, ec.endoso_fecha
FROM egreso_cheques ec
JOIN egreso_pagos   ep ON ep.id  = ec.egreso_pago_id
JOIN egresos        e  ON e.id   = ep.egreso_id
LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
JOIN sucursales     s  ON s.id   = e.sucursal_id
WHERE e.deleted_at IS NULL

UNION ALL

SELECT
  cm.tipo             AS tipo,
  cm.id, cm.banco, cm.numero_cheque, cm.fecha_emision, cm.fecha_vencimiento,
  cm.importe, cm.estado, cm.fecha_estado, cm.observaciones,
  cm.id               AS origen_id,
  'manual'            AS origen_tipo,
  COALESCE(cl.razon_social, pr.razon_social, 'Carga manual') AS origen_nombre,
  cm.sucursal_id, s.nombre AS sucursal_nombre,
  cm.forma, cm.modalidad, cm.librador_cuit,
  COALESCE(cm.librador_nombre, cl.razon_social) AS librador_nombre,
  cm.banco_sucursal, cm.banco_cbu, cm.rechazo_causal,
  cm.deposito_cuenta_id, cm.endoso_proveedor_id, cm.endoso_comprobante, cm.endoso_fecha
FROM cheques_manuales cm
LEFT JOIN clientes    cl ON cl.id = cm.cliente_id
LEFT JOIN proveedores pr ON pr.id = cm.proveedor_id
JOIN sucursales       s  ON s.id  = cm.sucursal_id
WHERE cm.deleted_at IS NULL

UNION ALL

SELECT
  'emitido'           AS tipo,
  ppc.id, ppc.banco, ppc.numero_cheque, ppc.fecha_emision, ppc.fecha_vencimiento,
  ppc.importe, ppc.estado, ppc.fecha_estado,
  COALESCE(ppc.observaciones, pp.observaciones) AS observaciones,
  pp.id               AS origen_id,
  'pago_proveedor'    AS origen_tipo,
  COALESCE(pr.razon_social, 'Sin proveedor') AS origen_nombre,
  pp.sucursal_id, s.nombre AS sucursal_nombre,
  ppc.forma, ppc.modalidad, ppc.librador_cuit, ppc.librador_nombre,
  ppc.banco_sucursal, ppc.banco_cbu, ppc.rechazo_causal,
  ppc.deposito_cuenta_id, ppc.endoso_proveedor_id, ppc.endoso_comprobante, ppc.endoso_fecha
FROM pago_proveedor_cheques ppc
JOIN pagos_proveedor pp ON pp.id = ppc.pago_proveedor_id
LEFT JOIN proveedores pr ON pr.id = pp.proveedor_id
LEFT JOIN sucursales  s  ON s.id  = pp.sucursal_id
WHERE pp.anulado = FALSE

UNION ALL

SELECT
  'recibido'          AS tipo,
  mcc.id, mcc.banco, mcc.numero_cheque,
  NULL                AS fecha_emision,
  mcc.fecha_vencimiento,
  mcc.importe, mcc.estado, mcc.fecha_estado, mcc.observaciones,
  mc.id               AS origen_id,
  'movimiento_caja'   AS origen_tipo,
  mc.concepto         AS origen_nombre,
  c.sucursal_id,      s.nombre AS sucursal_nombre,
  mcc.forma, mcc.modalidad, mcc.librador_cuit, mcc.librador_nombre,
  mcc.banco_sucursal, mcc.banco_cbu, mcc.rechazo_causal,
  mcc.deposito_cuenta_id, mcc.endoso_proveedor_id, mcc.endoso_comprobante, mcc.endoso_fecha
FROM movimiento_caja_cheques mcc
JOIN movimientos_caja mc ON mc.id = mcc.movimiento_id
JOIN cajas            c  ON c.id  = mc.caja_id
JOIN sucursales       s  ON s.id  = c.sucursal_id;
