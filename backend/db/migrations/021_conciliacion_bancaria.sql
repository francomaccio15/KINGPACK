-- =============================================================================
-- KINGPACK — Migración 021: Conciliación bancaria mensual
-- =============================================================================
-- Guarda el monto total acreditado en el banco por mes, para compararlo contra
-- lo facturado en ARCA (SUM facturaciones.total con ok=true) del mismo período
-- y detectar diferencias. Un registro por mes (periodo = primer día del mes).

CREATE TABLE IF NOT EXISTS conciliacion_bancaria (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo          DATE NOT NULL UNIQUE,            -- primer día del mes conciliado
  monto_acreditado NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacion      TEXT,
  usuario_id       UUID REFERENCES usuarios(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conciliacion_periodo ON conciliacion_bancaria(periodo DESC);
