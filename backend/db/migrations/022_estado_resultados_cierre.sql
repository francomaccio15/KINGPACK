-- KINGPACK — Migración 022: Estado de resultados por categorías + cierre mensual
-- Agrega:
--   1) categorias_resultado: agrupación de rubros para el estado de resultados
--      (5+1 categorías de gasto operativo + retiros + excluido/compras).
--   2) rubros_gastos.categoria_resultado_id: cada rubro pertenece a una categoría.
--   3) cierre_mensual: cabecera del cierre por mes; guarda el resultado acumulado
--      (arrastre mes a mes).
--   4) cierre_categoria: confirmación obligatoria por categoría y mes (cierre
--      bloqueante: el estado no se calcula hasta confirmar todas).

-- 1. Categorías de resultado ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_resultado (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  VARCHAR(100) NOT NULL UNIQUE,
  orden   INT NOT NULL DEFAULT 0,
  seccion VARCHAR(20) NOT NULL
          CHECK (seccion IN ('gasto_operativo', 'retiro', 'excluido'))
);

-- 2. Vínculo rubro → categoría ───────────────────────────────────────────────
ALTER TABLE rubros_gastos
  ADD COLUMN IF NOT EXISTS categoria_resultado_id UUID REFERENCES categorias_resultado(id);

-- 3. Cabecera de cierre mensual ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cierre_mensual (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_anio        INT NOT NULL,
  periodo_mes         INT NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  cerrado             BOOLEAN NOT NULL DEFAULT FALSE,
  resultado_acumulado NUMERIC(14,2),
  cerrado_por         UUID REFERENCES usuarios(id),
  cerrado_en          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (periodo_anio, periodo_mes)
);

-- 4. Confirmación por categoría y mes ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cierre_categoria (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_anio           INT NOT NULL,
  periodo_mes            INT NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  categoria_resultado_id UUID NOT NULL REFERENCES categorias_resultado(id),
  confirmado             BOOLEAN NOT NULL DEFAULT FALSE,
  monto_snapshot         NUMERIC(14,2),
  confirmado_por         UUID REFERENCES usuarios(id),
  confirmado_en          TIMESTAMPTZ,
  UNIQUE (periodo_anio, periodo_mes, categoria_resultado_id)
);

CREATE INDEX IF NOT EXISTS idx_cierre_categoria_periodo
  ON cierre_categoria (periodo_anio, periodo_mes);
