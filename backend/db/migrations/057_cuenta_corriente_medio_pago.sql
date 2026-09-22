-- =============================================================================
-- KINGPACK — 057: guardar el medio de pago en el cobro de cliente
-- =============================================================================
-- Hasta ahora el cobro (cuentas_corrientes_cliente.origen_tipo='pago') no
-- guardaba con qué medio se cobró: el medio quedaba sólo aguas abajo (caja,
-- banco o cheques). Eso hacía imposible corregir el medio de un pago después de
-- registrarlo, porque no se sabía qué revertir.
--
-- Estas columnas dejan el medio y —si es bancario— la cuenta destino en el
-- propio renglón del pago, para poder revertir el impacto correcto al editar.
-- Los pagos históricos quedan en NULL: para esos, la edición de medio se
-- bloquea y la ajusta el administrador a mano.
-- =============================================================================

ALTER TABLE cuentas_corrientes_cliente
  ADD COLUMN IF NOT EXISTS medio_pago_id      UUID REFERENCES medios_pago(id),
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES cuentas_bancarias_empresa(id);
