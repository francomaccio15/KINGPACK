-- KINGPACK — Seed: Usuario administrador inicial
-- Password por defecto: Kingpack2026!
-- IMPORTANTE: cambiar en el primer login o antes del deploy a producción.
-- Hash bcrypt generado con saltRounds=10 para 'Kingpack2026!'
INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
VALUES (
  'admin@kingpack.com.ar',
  '$2a$10$bXMMJiw/V06LH6WTJ0dScewp.mpslMsiVqyWYdL787BsZSkLXlDiW',
  'Administrador',
  'administrador',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Nota: el hash real se genera con:
--   node -e "const bcrypt=require('bcrypt'); bcrypt.hash('Kingpack2026!',10).then(h=>console.log(h))"
-- y se reemplaza arriba antes del primer deploy.
