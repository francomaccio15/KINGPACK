-- =============================================================================
-- 033 — MÓDULO PAGO A PROVEEDORES
-- Registra pagos a proveedores desde una pantalla dedicada. Un pago puede:
--   • Imputarse a uno o más egresos pendientes (los marca pagado/parcial), o
--   • Registrarse como "pago a cuenta" (crédito global en la cuenta corriente).
-- El haber correspondiente se vuelca en cuentas_corrientes_proveedor.
-- Si el medio es efectivo, la ruta genera además un movimiento de egreso en la
-- caja abierta de la sucursal elegida (impacta el arqueo).
-- =============================================================================

-- ── Cabecera del pago ────────────────────────────────────────────────────────
CREATE TABLE pagos_proveedor (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id        UUID NOT NULL REFERENCES proveedores(id),
  fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
  medio_pago_id       UUID NOT NULL REFERENCES medios_pago(id),
  monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  UUID REFERENCES cuentas_bancarias_empresa(id),
  sucursal_id         UUID REFERENCES sucursales(id),   -- caja afectada si es efectivo
  observaciones       TEXT,
  facturado           BOOLEAN NOT NULL DEFAULT FALSE,    -- concepto del pago a cuenta
  anulado             BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion    TEXT,
  usuario_id          UUID REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagos_proveedor_prov  ON pagos_proveedor(proveedor_id, fecha DESC);
CREATE INDEX idx_pagos_proveedor_fecha ON pagos_proveedor(fecha DESC);

-- ── Imputaciones a egresos (modo "aplicado a comprobantes") ─────────────────
CREATE TABLE pago_proveedor_aplicaciones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_proveedor_id  UUID NOT NULL REFERENCES pagos_proveedor(id) ON DELETE CASCADE,
  egreso_id          UUID NOT NULL REFERENCES egresos(id),
  monto_aplicado     NUMERIC(14,2) NOT NULL CHECK (monto_aplicado > 0)
);

CREATE INDEX idx_pago_prov_aplic_pago   ON pago_proveedor_aplicaciones(pago_proveedor_id);
CREATE INDEX idx_pago_prov_aplic_egreso ON pago_proveedor_aplicaciones(egreso_id);

-- ── Cheques del pago (medio = cheque) ────────────────────────────────────────
CREATE TABLE pago_proveedor_cheques (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_proveedor_id  UUID NOT NULL REFERENCES pagos_proveedor(id) ON DELETE CASCADE,
  banco              VARCHAR(80) NOT NULL,
  numero_cheque      VARCHAR(30) NOT NULL,
  fecha_vencimiento  DATE NOT NULL,
  importe            NUMERIC(14,2) NOT NULL CHECK (importe > 0)
);

CREATE INDEX idx_pago_prov_cheques_venc ON pago_proveedor_cheques(fecha_vencimiento);

-- ── Vínculo desde egreso_pagos al pago de proveedor que lo generó ────────────
-- Permite revertir con precisión los pagos imputados cuando se anula el pago.
ALTER TABLE egreso_pagos
  ADD COLUMN pago_proveedor_id UUID REFERENCES pagos_proveedor(id) ON DELETE SET NULL;

CREATE INDEX idx_egreso_pagos_pago_prov ON egreso_pagos(pago_proveedor_id);
