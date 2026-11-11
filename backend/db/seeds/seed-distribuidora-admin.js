/**
 * Crea el usuario administrador para Distribuidora King Pack.
 * Ejecutar una sola vez: ADMIN_PASSWORD='...' node db/seeds/seed-distribuidora-admin.js
 * La contraseña se pasa por variable de entorno: nunca va en el código.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool } = require('../../src/config/db');

async function run() {
  const email = 'distribuidorakingpack@gmail.com';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    console.error('Definí ADMIN_PASSWORD (mínimo 12 caracteres).');
    process.exit(1);
  }
  const nombre = 'Distribuidora King Pack';
  const rol = 'administrador';

  const hash = await bcrypt.hash(password, 12);

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
