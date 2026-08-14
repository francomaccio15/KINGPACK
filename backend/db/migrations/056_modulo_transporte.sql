-- Módulo Transporte: transportistas con cuenta corriente.
-- El saldo sale del historial de movimientos: "pedidos" (cargos/fletes que le
-- debemos al transporte) y "pagos" (lo que le abonamos). Positivo = le debemos.

CREATE TABLE IF NOT EXISTS transportes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social  TEXT NOT NULL,
  cuit          VARCHAR(20),
  telefono      TEXT,
  email         TEXT,
  direccion     TEXT,
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,  -- deuda previa al sistema
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ
);

-- CUIT único entre los transportes vigentes (ignora los borrados).
CREATE UNIQUE INDEX IF NOT EXISTS uq_transportes_cuit
  ON transportes(cuit) WHERE cuit IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS movimientos_transporte (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporte_id UUID NOT NULL REFERENCES transportes(id),
  tipo          VARCHAR(20) NOT NULL
                  CHECK (tipo IN ('pedido','pago','correccion')),
  debe          NUMERIC(14,2) NOT NULL DEFAULT 0,  -- cargo (pedido/flete): sube lo que le debemos
  haber         NUMERIC(14,2) NOT NULL DEFAULT 0,  -- pago: baja lo que le debemos
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  descripcion   TEXT,
  medio_pago    TEXT,                              -- informativo, solo para pagos
  created_by    UUID REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_transporte
  ON movimientos_transporte(transporte_id, fecha DESC);
