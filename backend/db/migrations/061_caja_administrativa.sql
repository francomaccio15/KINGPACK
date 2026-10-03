-- KINGPACK — Migración 061: Caja Administrativa
--
-- Caja única de la empresa (no por sucursal) que junta el efectivo contado en
-- los cierres de las cajas diarias de Laprida y Huaico. Hasta ahora ese
-- efectivo entraba a la caja fuerte de cada sucursal; desde esta migración el
-- cierre lo manda acá (las cajas fuertes conservan su saldo y siguen pudiendo
-- usarse con sus medios "Efectivo Caja Fuerte …").
--
-- Se usa como medio de pago "Caja Administrativa" en egresos y pagos a
-- proveedor, y la ven solo los administradores.
--
-- Mismo patrón que la caja fuerte (mig 047): ledger + saldo derivado, con el
-- invariante
--
--   saldo = saldo_inicial + Σ(ingresos) − Σ(egresos)
--
-- Arranca en $0 desde hoy (decisión del usuario, 03/10/2026).

-- ── 1. Saldo (fila única) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caja_administrativa (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  saldo          NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_inicial  NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO caja_administrativa (id, saldo, saldo_inicial)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Ledger ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_caja_administrativa (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  monto        NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  concepto     TEXT,
  -- Sucursal de donde vino la plata (cierre de caja) o del comprobante pagado.
  -- Solo informativo: el saldo es uno solo.
  sucursal_id  UUID REFERENCES sucursales(id),
  -- De dónde salió el movimiento, para poder revertirlo al anular el origen.
  --   cierre_caja | egreso | pago_proveedor
  origen_tipo  VARCHAR(30),
  origen_id    UUID,
  usuario_id   UUID REFERENCES usuarios(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_caja_adm_fecha
  ON movimientos_caja_administrativa(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_caja_adm_origen
  ON movimientos_caja_administrativa(origen_tipo, origen_id);

-- ── 3. Medio de pago ─────────────────────────────────────────────────────────
-- Se identifica por bandera, no por nombre (el nombre no dice "efectivo" a
-- propósito: así no lo cuentan el arqueo ni la anulación de ventas).
ALTER TABLE medios_pago
  ADD COLUMN IF NOT EXISTS es_caja_administrativa BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO medios_pago (nombre, requiere_cuenta, activo, es_caja_administrativa)
VALUES ('Caja Administrativa', FALSE, TRUE, TRUE)
ON CONFLICT (nombre) DO UPDATE
  SET es_caja_administrativa = TRUE, requiere_cuenta = FALSE, activo = TRUE;
