-- =============================================================================
-- 027 — Cheques manuales (carga independiente, no atados a venta/egreso)
-- =============================================================================
-- Permite dar de alta cheques a mano desde la pestaña de Cheques. Pensado para
-- la carga inicial de cheques de clientes (recibidos, en cartera) que vencen en
-- los meses entrantes, y también cheques emitidos propios. No genera movimientos
-- de caja ni cuenta corriente al crearse: solo registra el cheque para poder
-- gestionar su estado.

CREATE TABLE IF NOT EXISTS cheques_manuales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              VARCHAR(10)   NOT NULL CHECK (tipo IN ('recibido','emitido')),
  banco             VARCHAR(80)   NOT NULL,
  numero_cheque     VARCHAR(30)   NOT NULL,
  fecha_emision     DATE,
  fecha_vencimiento DATE          NOT NULL,
  importe           NUMERIC(14,2) NOT NULL CHECK (importe > 0),
  estado            VARCHAR(20)   NOT NULL DEFAULT 'en_cartera'
    CHECK (estado IN ('en_cartera','depositado','acreditado','endosado',
                      'emitido','presentado','debitado','rechazado','anulado')),
  fecha_estado      DATE,
  observaciones     TEXT,
  sucursal_id       UUID          NOT NULL REFERENCES sucursales(id),
  cliente_id        UUID          REFERENCES clientes(id),
  proveedor_id      UUID          REFERENCES proveedores(id),
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cheques_manuales_venc   ON cheques_manuales(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cheques_manuales_estado ON cheques_manuales(estado);

-- ─── Vista unificada: se agrega la rama de cheques manuales ──────────────────
CREATE OR REPLACE VIEW vw_cheques AS
SELECT
  'recibido'          AS tipo,
  vc.id,
  vc.banco,
  vc.numero_cheque,
  vc.fecha_emision,
  vc.fecha_vencimiento,
  vc.importe,
  vc.estado,
  vc.fecha_estado,
  vc.observaciones,
  v.id                AS origen_id,
  'venta'             AS origen_tipo,
  COALESCE(cl.razon_social, 'Consumidor Final') AS origen_nombre,
  v.sucursal_id,
  s.nombre            AS sucursal_nombre
FROM venta_cheques vc
JOIN ventas   v  ON v.id  = vc.venta_id
LEFT JOIN clientes cl ON cl.id = v.cliente_id
JOIN sucursales s ON s.id = v.sucursal_id
WHERE v.deleted_at IS NULL

UNION ALL

SELECT
  'emitido'           AS tipo,
  ec.id,
  ec.banco,
  ec.numero_cheque,
  ec.fecha_emision,
  ec.fecha_vencimiento,
  ec.importe,
  ec.estado,
  ec.fecha_estado,
  ec.observaciones,
  e.id                AS origen_id,
  'egreso'            AS origen_tipo,
  COALESCE(pr.razon_social, 'Sin proveedor') AS origen_nombre,
  e.sucursal_id,
  s.nombre            AS sucursal_nombre
FROM egreso_cheques ec
JOIN egreso_pagos   ep ON ep.id  = ec.egreso_pago_id
JOIN egresos        e  ON e.id   = ep.egreso_id
LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
JOIN sucursales     s  ON s.id   = e.sucursal_id
WHERE e.deleted_at IS NULL

UNION ALL

SELECT
  cm.tipo             AS tipo,
  cm.id,
  cm.banco,
  cm.numero_cheque,
  cm.fecha_emision,
  cm.fecha_vencimiento,
  cm.importe,
  cm.estado,
  cm.fecha_estado,
  cm.observaciones,
  cm.id               AS origen_id,
  'manual'            AS origen_tipo,
  COALESCE(cl.razon_social, pr.razon_social, 'Carga manual') AS origen_nombre,
  cm.sucursal_id,
  s.nombre            AS sucursal_nombre
FROM cheques_manuales cm
LEFT JOIN clientes    cl ON cl.id = cm.cliente_id
LEFT JOIN proveedores pr ON pr.id = cm.proveedor_id
JOIN sucursales       s  ON s.id  = cm.sucursal_id
WHERE cm.deleted_at IS NULL;
