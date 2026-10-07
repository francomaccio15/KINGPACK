-- KINGPACK — Migración 063: venta por unidad (bulto o suelto) — campos vacíos
--
-- Paso 3 de docs/PLAN_VENTA_POR_UNIDAD.md. Agrega los campos con TODO en factor
-- 1: el sistema se comporta exactamente igual que hoy. La conversión del stock
-- (paso 4) la hace backend/scripts/convertir-stock-por-unidad.js, por separado.
--
-- Regla de fondo: el stock se guarda en la unidad más chica (la suelta). Cada
-- línea de comprobante congela su unidad y su factor (unidades de stock por
-- unidad de la línea), igual que el precio madre congelado (mig 050/051).

-- ── Artículos ────────────────────────────────────────────────────────────────
ALTER TABLE articulos
  ADD COLUMN IF NOT EXISTS vende_por_unidad   BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unidades_por_bulto INTEGER       NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS precio_unidad      NUMERIC(14,3);

ALTER TABLE articulos DROP CONSTRAINT IF EXISTS articulos_unidades_por_bulto_check;
ALTER TABLE articulos ADD CONSTRAINT articulos_unidades_por_bulto_check
  CHECK (unidades_por_bulto >= 1);

-- Solo se vende suelto un artículo con bulto real y precio por unidad propio.
ALTER TABLE articulos DROP CONSTRAINT IF EXISTS articulos_vende_por_unidad_check;
ALTER TABLE articulos ADD CONSTRAINT articulos_vende_por_unidad_check
  CHECK (NOT vende_por_unidad OR (unidades_por_bulto > 1 AND precio_unidad > 0));

-- ── Ítems de venta ───────────────────────────────────────────────────────────
ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS unidad_venta VARCHAR(10) NOT NULL DEFAULT 'bulto',
  ADD COLUMN IF NOT EXISTS factor       INTEGER     NOT NULL DEFAULT 1;

ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_unidad_venta_check;
ALTER TABLE venta_items ADD CONSTRAINT venta_items_unidad_venta_check
  CHECK (unidad_venta IN ('bulto','unidad'));
ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_factor_check;
ALTER TABLE venta_items ADD CONSTRAINT venta_items_factor_check CHECK (factor >= 1);

-- La PK era (venta_id, articulo_id): no dejaba vender el mismo artículo por
-- bulto y suelto en un mismo ticket. Ahora la unidad es parte de la clave.
ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_pkey;
ALTER TABLE venta_items ADD CONSTRAINT venta_items_pkey
  PRIMARY KEY (venta_id, articulo_id, unidad_venta);

-- ── Traspasos ────────────────────────────────────────────────────────────────
-- Devoluciones y NC guardan los ítems en JSONB: ahí la unidad y el factor
-- viajan dentro de cada ítem (los viejos, sin factor, eran por bulto).
-- Compras y licitaciones son siempre por bulto: usan el factor del artículo.
ALTER TABLE traspaso_items
  ADD COLUMN IF NOT EXISTS unidad_venta VARCHAR(10) NOT NULL DEFAULT 'bulto',
  ADD COLUMN IF NOT EXISTS factor       INTEGER     NOT NULL DEFAULT 1;
ALTER TABLE traspaso_items DROP CONSTRAINT IF EXISTS traspaso_items_unidad_venta_check;
ALTER TABLE traspaso_items ADD CONSTRAINT traspaso_items_unidad_venta_check
  CHECK (unidad_venta IN ('bulto','unidad'));
ALTER TABLE traspaso_items DROP CONSTRAINT IF EXISTS traspaso_items_factor_check;
ALTER TABLE traspaso_items ADD CONSTRAINT traspaso_items_factor_check CHECK (factor >= 1);
