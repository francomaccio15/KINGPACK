/**
 * Crea el usuario administrador para Distribuidora King Pack.
 * Ejecutar una sola vez: node db/seeds/seed-distribuidora-admin.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool } = require('../../src/config/db');

async function run() {
  const email = 'Distribuidorakingpack@gmail.com';
  const password = 'Francesco17m';
  const nombre = 'Distribuidora King Pack';
  const rol = 'administrador';

  const hash = await bcrypt.hash(password, 10);

  const { rowCount } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           nombre        = EXCLUDED.nombre,
           rol           = EXCLUDED.rol,
           activo        = TRUE,
           updated_at    = NOW()`,
    [email, hash, nombre, rol]
  );

  const status = rowCount > 0 ? 'creado/actualizado' : 'sin cambios';
  console.log(`[administrador]  ${email}  →  ${status}`);

  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
