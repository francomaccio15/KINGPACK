-- KINGPACK — Migración 049: cuenta bancaria donde caen los cheques
--
-- Todos los cheques, recibidos y emitidos, se cobran/pagan por la misma cuenta.
-- En vez de clavar el nombre en el código, la cuenta se marca con una bandera:
-- así se cambia desde la base el día que dejen de operar por GALICIA
-- DISTRIBUIDORA, sin tocar código ni deployar.
--
-- El impacto ocurre cuando el banco efectivamente movió la plata:
--   recibido → 'acreditado'  ⇒ ingreso
--   emitido  → 'debitado'    ⇒ egreso
-- Un cheque en cartera, depositado o endosado NO toca el saldo.
--
-- No se reconstruye el histórico: los saldos vigentes ya son los reales del
-- home banking (se fijaron a mano el 21/07/2026), así que los cheques que ya
-- estaban acreditados/debitados están contemplados en esa cifra de partida.

ALTER TABLE cuentas_bancarias_empresa
  ADD COLUMN IF NOT EXISTS es_cuenta_cheques BOOLEAN NOT NULL DEFAULT FALSE;

-- Una sola cuenta puede ser la de cheques.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cuenta_cheques_unica
  ON cuentas_bancarias_empresa (es_cuenta_cheques) WHERE es_cuenta_cheques;

UPDATE cuentas_bancarias_empresa
   SET es_cuenta_cheques = TRUE
 WHERE nombre = 'GALICIA DISTRIBUIDORA';
