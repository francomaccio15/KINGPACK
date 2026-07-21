-- KINGPACK — Migración 046: ledger de movimientos por cuenta bancaria
--
-- Hasta ahora `cuentas_bancarias_empresa.saldo` era un número de carga manual
-- (ver migración 039): ningún pago lo movía. A partir de acá el saldo se
-- mantiene solo, con un registro de cada movimiento que lo respalda.
--
-- Punto de partida: el saldo manual vigente queda congelado en `saldo_inicial`
-- y el ledger arranca vacío desde hoy. NO se reconstruye el histórico porque
-- los cobros por transferencia nunca guardaron a qué cuenta entraron — no hay
-- dato para hacerlo. En todo momento debe cumplirse:
--
--   saldo = saldo_inicial + Σ(ingresos) − Σ(egresos)
--
-- Los movimientos se escriben SIEMPRE junto con el UPDATE del saldo, dentro de
-- la misma transacción del pago/cobro que los origina, y se borran al anularlo
-- (mismo criterio que egreso_pagos, que no usa soft-delete).

-- ── 1. Ledger ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_cuenta_bancaria (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_bancaria_id  UUID NOT NULL REFERENCES cuentas_bancarias_empresa(id),
  fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo                VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  concepto            TEXT,
  -- De dónde salió el movimiento, para poder revertirlo al anular el origen.
  --   egreso | pago_proveedor | movimiento_caja | ajuste
  origen_tipo         VARCHAR(30),
  origen_id           UUID,
  usuario_id          UUID REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_cta_banco_cuenta
  ON movimientos_cuenta_bancaria(cuenta_bancaria_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_cta_banco_origen
  ON movimientos_cuenta_bancaria(origen_tipo, origen_id);

-- ── 2. Saldo inicial (congela el valor manual actual) ────────────────────────
ALTER TABLE cuentas_bancarias_empresa
  ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(14,2);

UPDATE cuentas_bancarias_empresa SET saldo_inicial = saldo WHERE saldo_inicial IS NULL;

ALTER TABLE cuentas_bancarias_empresa
  ALTER COLUMN saldo_inicial SET DEFAULT 0;
ALTER TABLE cuentas_bancarias_empresa
  ALTER COLUMN saldo_inicial SET NOT NULL;

-- ── 3. Los cobros necesitan saber a qué cuenta entró la plata ────────────────
-- Sin esto el saldo sólo bajaría: hoy hay cobros por Transferencia en
-- movimientos_caja que no registran cuenta destino.
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES cuentas_bancarias_empresa(id);

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_cuenta
  ON movimientos_caja(cuenta_bancaria_id) WHERE cuenta_bancaria_id IS NOT NULL;

-- `venta_pagos.cuenta_destino` ya existía pero guarda sólo el NOMBRE de la cuenta
-- (texto libre), que no sirve para imputar. Al editar una venta el backend
-- reconstruye los pagos desde esta tabla: sin el ID acá, la edición borraría el
-- crédito bancario del cobro original y no podría reponerlo.
ALTER TABLE venta_pagos
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES cuentas_bancarias_empresa(id);
