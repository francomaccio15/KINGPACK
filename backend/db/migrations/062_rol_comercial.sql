-- KINGPACK — Migración 062: rol "comercial"
--
-- Rol para quien maneja redes sociales y pasa presupuestos (05/10/2026, Andrea).
-- Consulta artículos con precios y stock de ambas sucursales, carga y edita
-- clientes y arma presupuestos (preventas). NO opera ventas, caja ni cuentas
-- corrientes. Las restricciones viven en el backend (middleware/auth.js →
-- soloRutasComercial) y en el frontend (lib/permissions.ts).

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('administrador','supervisor','cajero','vendedor','comercial'));

ALTER TABLE rol_permisos DROP CONSTRAINT IF EXISTS rol_permisos_rol_check;
ALTER TABLE rol_permisos ADD CONSTRAINT rol_permisos_rol_check
  CHECK (rol IN ('administrador','supervisor','cajero','vendedor','comercial'));
