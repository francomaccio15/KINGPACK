/**
 * Seed inicial de usuarios.
 * Ejecutar una sola vez en el VPS: node db/seeds/seed-usuarios.js
 *
 * Usuarios creados: admin@, supervisor@, cajero@ y vendedor@kingpack.com.
 * Las contraseñas NO van en el código (el repo es público): se generan al azar
 * y se muestran una sola vez por consola. Anotarlas y cambiarlas desde Usuarios.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pass = () => crypto.randomBytes(12).toString('base64url');
const { pool } = require('../../src/config/db');

const USUARIOS = [
  { email: 'admin@kingpack.com',      password: pass(),    nombre: 'Administrador', rol: 'administrador' },
  { email: 'supervisor@kingpack.com', password: pass(),    nombre: 'Supervisor',    rol: 'supervisor'    },
  { email: 'cajero@kingpack.com',     password: pass(),   nombre: 'Cajero',        rol: 'cajero'        },
  { email: 'vendedor@kingpack.com',   password: pass(), nombre: 'Vendedor',      rol: 'vendedor'      },
];

async function run() {
  console.log('Seeding usuarios...\n');

  for (const u of USUARIOS) {
    const hash = await bcrypt.hash(u.password, 12);
    const { rowCount } = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, hash, u.nombre, u.rol]
    );
    const status = rowCount > 0 ? 'creado' : 'ya existía';
    console.log(`  [${u.rol}]  ${u.email}  →  ${status}${rowCount > 0 ? `  (contraseña: ${u.password})` : ''}`);
  }

  await pool.end();
  console.log('\nSeed completado.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
