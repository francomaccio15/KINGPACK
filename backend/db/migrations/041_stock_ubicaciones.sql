-- =============================================================================
-- KINGPACK — Stock por ubicación (Adelante + Depósito)
-- Migración: 041_stock_ubicaciones.sql
--
-- El stock de cada artículo/sucursal se desglosa en dos ubicaciones físicas:
--   • cantidad_adelante  → mostrador / frente del local
--   • cantidad_deposito  → depósito
-- El total (columna `cantidad`, que usa TODO el resto del sistema) es SIEMPRE
-- la suma de ambas. Un trigger mantiene ese invariante automáticamente, sin
-- tocar los ~15 lugares que descuentan/suman stock (ventas, traspasos,
-- devoluciones, notas de crédito, recepción de pedidos, licitaciones).
--
-- Regla de redistribución cuando cambia el total sin fijar componentes:
--   • Egreso (venta, etc.): descuenta primero de "adelante"; si no alcanza,
--     del "depósito".
--   • Ingreso (recepción, devolución, traspaso entrante): suma al "depósito".
--   • Conteo (fija ambos componentes explícitamente): el total = adelante + dep.
-- =============================================================================

ALTER TABLE stock
  ADD COLUMN IF NOT EXISTS cantidad_adelante NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_deposito NUMERIC(12,3) NOT NULL DEFAULT 0;

-- Backfill: el stock existente arranca todo en el depósito.
-- (Al momento de esta migración el stock está en 0 por el conteo en curso, así
--  que en la práctica ambos quedan en 0; la asignación es por robustez general.)
UPDATE stock
   SET cantidad_deposito = cantidad,
       cantidad_adelante = 0
 WHERE cantidad_adelante = 0 AND cantidad_deposito = 0;

-- ── Trigger de sincronización ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_stock_sync_ubicaciones()
RETURNS TRIGGER AS $$
DECLARE
  v_delta    NUMERIC(12,3);
  v_reduce   NUMERIC(12,3);
  v_take_ade NUMERIC(12,3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Si no vinieron componentes explícitos, el stock inicial va al depósito.
    IF NEW.cantidad_adelante = 0 AND NEW.cantidad_deposito = 0 AND NEW.cantidad <> 0 THEN
      NEW.cantidad_deposito := NEW.cantidad;
    END IF;
    NEW.cantidad := NEW.cantidad_adelante + NEW.cantidad_deposito;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.cantidad_adelante IS DISTINCT FROM OLD.cantidad_adelante
     OR NEW.cantidad_deposito IS DISTINCT FROM OLD.cantidad_deposito THEN
    -- Se fijaron los componentes explícitamente (conteo) → total = suma.
    NEW.cantidad := NEW.cantidad_adelante + NEW.cantidad_deposito;
    RETURN NEW;
  END IF;

  -- Solo cambió el total (venta, devolución, recepción, traspaso): redistribuir.
  v_delta := NEW.cantidad - OLD.cantidad;
  IF v_delta < 0 THEN
    v_reduce   := -v_delta;
    v_take_ade := LEAST(v_reduce, OLD.cantidad_adelante);
    NEW.cantidad_adelante := OLD.cantidad_adelante - v_take_ade;
    NEW.cantidad_deposito := GREATEST(0, OLD.cantidad_deposito - (v_reduce - v_take_ade));
  ELSIF v_delta > 0 THEN
    NEW.cantidad_adelante := OLD.cantidad_adelante;
    NEW.cantidad_deposito := OLD.cantidad_deposito + v_delta;
  END IF;
  NEW.cantidad := NEW.cantidad_adelante + NEW.cantidad_deposito;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_sync_ubicaciones ON stock;
CREATE TRIGGER trg_stock_sync_ubicaciones
BEFORE INSERT OR UPDATE ON stock
FOR EACH ROW EXECUTE FUNCTION fn_stock_sync_ubicaciones();
