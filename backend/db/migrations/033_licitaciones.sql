-- =============================================================================
-- 033 — Módulo de Licitaciones
-- =============================================================================
-- Permite al administrador armar listas de artículos con precios ad-hoc
-- para presentar a clientes en licitaciones comerciales. Los precios de
-- licitación son completamente independientes del precio_madre y de las
-- listas de precios regulares — no los modifican ni los referencian.

CREATE TABLE licitaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        SERIAL,
  titulo        VARCHAR(200),
  cliente_id    UUID REFERENCES clientes(id),
  observaciones TEXT,
  estado        VARCHAR(20) NOT NULL DEFAULT 'borrador', -- borrador | enviada
  created_by    UUID NOT NULL REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE licitacion_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacion_id     UUID NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  articulo_id       UUID REFERENCES articulos(id),
  codigo            VARCHAR(80),
  nombre            VARCHAR(200) NOT NULL,
  cantidad          NUMERIC(12,3) NOT NULL DEFAULT 1,
  precio_madre_ref  NUMERIC(14,2),   -- Referencia visual; nunca se modifica
  precio_licitacion NUMERIC(14,2) NOT NULL,
  subtotal          NUMERIC(14,2) NOT NULL,
  orden             INTEGER DEFAULT 0
);
