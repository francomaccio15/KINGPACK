-- =============================================================================
-- MÓDULO: DEVOLUCIÓN DE MERCADERÍA (ventas sin factura / "en negro")
-- =============================================================================
-- Documento NO fiscal: no tiene tipo de comprobante AFIP, letra ni CAE.
-- Sirve para devolver mercadería de ventas que no se facturaron. Restaura el
-- stock y, según la forma de devolución, devuelve el dinero (efectivo desde la
-- caja, transferencia), lo acredita a la cuenta corriente del cliente, o es solo
-- un cambio de mercadería (sin movimiento de dinero).

CREATE TABLE IF NOT EXISTS devoluciones_mercaderia (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            INT,
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado            VARCHAR(10) NOT NULL DEFAULT 'emitida'
                      CHECK (estado IN ('emitida','anulada')),
  cliente_id        UUID REFERENCES clientes(id),
  sucursal_id       UUID REFERENCES sucursales(id),
  motivo            TEXT NOT NULL,
  numero_referencia TEXT,
  items             JSONB,
  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  total             NUMERIC(14,2) NOT NULL DEFAULT 0,
  forma_devolucion  VARCHAR(20) NOT NULL DEFAULT 'efectivo'
                      CHECK (forma_devolucion IN ('efectivo','cuenta_corriente','transferencia','cambio')),
  emitida_por       UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_cliente ON devoluciones_mercaderia(cliente_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha   ON devoluciones_mercaderia(fecha DESC);
