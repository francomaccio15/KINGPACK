-- KINGPACK — Migración 053: corregir la tabla de alícuotas de IVA
--
-- Contexto: el seed original cargó el código AFIP 4 como "Exento 0%", pero para
-- AFIP el id 4 es la alícuota de 10,5%. Además faltaba tener 10,5% disponible.
-- El cliente va a vender algunos artículos a 0% (sin IVA) y a 10,5%.
--
-- Estrategia (para NO cambiarle el precio a ningún artículo):
--   1. Repuntar los artículos que hoy usan la fila AFIP 4 (0%) a la fila AFIP 3
--      (0% "No Gravado"), que representa lo mismo (0%).
--   2. Recién ahí corregir la fila AFIP 4 a 10,5%.
--   3. Dejar descripciones claras para el selector del frontend.
--
-- Guardas: cada paso solo actúa si la fila AFIP 4 sigue en 0% (idempotente ante
-- re-ejecución). El trigger de precio_madre NO se dispara al repuntar a otra
-- alícuota de 0% (mismo porcentaje) ni cambia el precio.

-- 1) Repuntar artículos de la fila AFIP 4 (0%) hacia la fila AFIP 3 (0%).
UPDATE articulos a
   SET alicuota_iva_id = (SELECT id FROM alicuotas_iva WHERE codigo_afip = 3)
 WHERE a.alicuota_iva_id = (SELECT id FROM alicuotas_iva WHERE codigo_afip = 4 AND porcentaje = 0);

-- 2) Corregir la fila AFIP 4 → 10,5% (solo si todavía está en 0%).
UPDATE alicuotas_iva
   SET porcentaje = 10.50, descripcion = 'IVA 10.5%'
 WHERE codigo_afip = 4 AND porcentaje = 0;

-- 3) Descripciones claras para el selector (el cliente elige por descripción).
UPDATE alicuotas_iva SET descripcion = 'Sin IVA (0%)' WHERE codigo_afip = 3;
UPDATE alicuotas_iva SET descripcion = 'IVA 21%'      WHERE codigo_afip = 5;
