-- 039_cuentas_bancarias_saldo.sql
-- Saldo actual por cuenta bancaria de la empresa. Es un saldo de carga/edición
-- manual (se setea desde la pantalla de Cuentas Bancarias), no se recalcula
-- automáticamente con los movimientos.
--
-- Valores iniciales acordados con el cliente (07/2026):
--   Banco Hipotecario MAXIMILIANO MORCOS → $1.128.254
--   GALICIA DISTRIBUIDORA                → $3.974.451
--   BRUBANK - Norma Hinojosa             → $605.048
--   SANTANDER DISTRIBUIDORA              → $306.185
--   GALICIA - Maximiliano Morcos         → $84.202

ALTER TABLE cuentas_bancarias_empresa
  ADD COLUMN IF NOT EXISTS saldo NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE cuentas_bancarias_empresa SET saldo = 1128254 WHERE nombre = 'Banco Hipotecario MAXIMILIANO MORCOS';
UPDATE cuentas_bancarias_empresa SET saldo = 3974451 WHERE nombre = 'GALICIA DISTRIBUIDORA';
UPDATE cuentas_bancarias_empresa SET saldo = 605048  WHERE nombre = 'BRUBANK - Norma Hinojosa';
UPDATE cuentas_bancarias_empresa SET saldo = 306185  WHERE nombre = 'SANTANDER DISTRIBUIDORA';
UPDATE cuentas_bancarias_empresa SET saldo = 84202   WHERE nombre = 'GALICIA - Maximiliano Morcos';
