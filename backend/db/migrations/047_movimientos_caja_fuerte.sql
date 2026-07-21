-- KINGPACK — Migración 047: ledger de movimientos por caja fuerte
--
-- `caja_fuerte` (migración 038) era un número suelto: el cierre de caja lo sumaba
-- y los pagos con "Efectivo Caja Fuerte" lo restaban con UPDATEs directos, sin
-- dejar rastro. No se podía auditar de dónde salió cada peso, ni detectar un
-- descuento aplicado dos veces o ninguna.
--
-- Mismo patrón que las cuentas bancarias (migración 046): el saldo manual vigente
-- queda congelado en `saldo_inicial`, el ledger arranca vacío desde hoy y en todo
-- momento debe cumplirse:
--
--   saldo = saldo_inicial + Σ(ingresos) − Σ(egresos)
--
-- NO se reconstruye el histórico: los cierres de caja y pagos anteriores movieron
-- el saldo sin registrar nada, así que ese acumulado es parte del punto de partida.
--
-- Los movimientos se escriben SIEMPRE junto con el UPDATE del saldo, dentro de la
-- misma transacción del pago/cierre que los origina, y se borran al anularlo
-- (mismo criterio que movimientos_cuenta_bancaria).

-- ── 1. Ledger ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_caja_fuerte (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id  UUID NOT NULL REFERENCES sucursales(id),
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  monto        NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  concepto     TEXT,
  -- De dónde salió el movimiento, para poder revertirlo al anular el origen.
  --   egreso | pago_proveedor | cierre_caja | movimiento_caja | ajuste
  origen_tipo  VARCHAR(30),
  origen_id    UUID,
  usuario_id   UUID REFERENCES usuarios(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_caja_fuerte_sucursal
  ON movimientos_caja_fuerte(sucursal_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_caja_fuerte_origen
  ON movimientos_caja_fuerte(origen_tipo, origen_id);

-- ── 2. Saldo inicial (congela el valor acumulado actual) ─────────────────────
ALTER TABLE caja_fuerte
  ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(14,2);

UPDATE caja_fuerte SET saldo_inicial = saldo WHERE saldo_inicial IS NULL;

ALTER TABLE caja_fuerte
  ALTER COLUMN saldo_inicial SET DEFAULT 0;
ALTER TABLE caja_fuerte
  ALTER COLUMN saldo_inicial SET NOT NULL;

-- ── 3. Toda sucursal tiene su caja fuerte ────────────────────────────────────
-- Los helpers hacen UPSERT, pero dejar la fila creada evita que una sucursal
-- nueva arranque sin saldo_inicial explícito.
INSERT INTO caja_fuerte (sucursal_id, saldo, saldo_inicial)
SELECT id, 0, 0 FROM sucursales
ON CONFLICT (sucursal_id) DO NOTHING;
