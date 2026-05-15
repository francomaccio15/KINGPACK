-- =============================================================================
-- KINGPACK — Triggers de auditoría
-- Migración: 003_audit_triggers.sql
-- =============================================================================

-- Función genérica de auditoría: registra en audit_log antes de UPDATE o DELETE
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  -- Intentar obtener el usuario de la sesión (si se setea con SET LOCAL)
  BEGIN
    v_usuario_id := current_setting('app.usuario_id', TRUE)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (tabla, registro_id, accion, datos_antes, datos_despues, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', row_to_json(OLD)::JSONB, NULL, v_usuario_id);
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (tabla, registro_id, accion, datos_antes, datos_despues, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, v_usuario_id);
    RETURN NEW;

  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (tabla, registro_id, accion, datos_antes, datos_despues, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', NULL, row_to_json(NEW)::JSONB, v_usuario_id);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tablas que requieren auditoría completa (legal AFIP + operaciones críticas)
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'ventas',
    'facturaciones',
    'notas_credito',
    'clientes',
    'articulos',
    'correcciones_saldo_cliente',
    'ajustes_stock',
    'cajas',
    'movimientos_caja',
    'usuarios'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION fn_audit_log()',
      t, t
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
