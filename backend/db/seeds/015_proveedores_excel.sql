-- KINGPACK — Seed 015: Proveedores reales (datos del legacy)
-- Fuente: KingPack.xlsx > hoja "Proveedores"
-- legacy_id preserva el ID del sistema anterior para trazabilidad.
-- Idempotente: no inserta si el legacy_id ya existe.

INSERT INTO proveedores (razon_social, telefono, email, direccion, activo, legacy_id)
SELECT v.razon_social, v.telefono, v.email, v.direccion, TRUE, v.legacy_id
FROM (VALUES
  ('NORTE POLIETILENO',         NULL,               NULL,                            'Palpalá, Jujuy',                    '66b99e04'),
  ('MIRCOPEL S.R.L',            NULL,               NULL,                            'El Palomar, Buenos Aires',           'a26ddaeb'),
  ('HIPERPEL',                  '01151835677',      NULL,                            NULL,                                 'b8d32870'),
  ('DPM',                       '3401597797',       NULL,                            NULL,                                 'dd545c51'),
  ('PETROQUIM',                 '01159812368',      NULL,                            NULL,                                 'b142d42c'),
  ('ENRIQUE VARELA (GUANTES)',   NULL,               NULL,                            NULL,                                 '60a1951b'),
  ('JJ PLAST',                  NULL,               NULL,                            'Dean Funes 210',                    'ddfbe0bd'),
  ('ENVAR S.A. POLIETILENO',    NULL,               'ventas@envar.com.ar',           'Berazategui, Buenos Aires',          '580c771c'),
  ('CORRUGADOS BURZACO S.A.',   NULL,               'corrugadosburzaco@gmail.com',   'Amenedo 434, Adrogué, Buenos Aires', '10f465c3'),
  ('POLIMUNDI',                 NULL,               NULL,                            NULL,                                 'da580639'),
  ('GARCIA OSVALDO',            NULL,               NULL,                            NULL,                                 '58fdb924'),
  ('GERMAN BIGPLAST',           NULL,               NULL,                            NULL,                                 '0f604ed9'),
  ('TITO PATOGENAS',            NULL,               NULL,                            NULL,                                 'e795dbab'),
  ('JAIME ANDIAS',              NULL,               NULL,                            NULL,                                 '76984910'),
  ('PETTIT PLAST',              NULL,               NULL,                            NULL,                                 '7ea43499')
) AS v(razon_social, telefono, email, direccion, legacy_id)
WHERE NOT EXISTS (
  SELECT 1 FROM proveedores p WHERE p.legacy_id = v.legacy_id
);
