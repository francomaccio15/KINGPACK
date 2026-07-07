-- =============================================================================
-- 035 — Pago a Proveedores dividido en varios medios de pago
-- Permite que un pago se abone con más de un medio (p. ej. parte efectivo, parte
-- cheque, parte transferencia). Cada línea guarda su medio, monto y cuenta.
-- La suma de las líneas debe igualar el monto del pago (validado en la ruta).
-- =============================================================================

CREATE TABLE pago_proveedor_medios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_proveedor_id   UUID NOT NULL REFERENCES pagos_proveedor(id) ON DELETE CASCADE,
  medio_pago_id       UUID NOT NULL REFERENCES medios_pago(id),
  monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  UUID REFERENCES cuentas_bancarias_empresa(id)
);

CREATE INDEX idx_pago_prov_medios ON pago_proveedor_medios(pago_proveedor_id);
