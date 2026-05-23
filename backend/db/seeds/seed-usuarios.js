/**
 * Seed inicial de usuarios.
 * Ejecutar una sola vez en el VPS: node db/seeds/seed-usuarios.js
 *
 * Usuarios creados:
 *   admin@kingpack.com      / Admin2026!       (administrador)
 *   supervisor@kingpack.com / Super2026!       (supervisor)
 *   cajero@kingpack.com     / Cajero2026!      (cajero)
 *   vendedor@kingpack.com   / Vendedor2026!    (vendedor)
 *
 * Cambiar contraseñas en producción después del primer login.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { pool } = require('../../src/config/db');

const USUARIOS = [
  { email: 'admin@kingpack.com',      password: 'Admin2026!',    nombre: 'Administrador', rol: 'administrador' },
  { email: 'supervisor@kingpack.com', password: 'Super2026!',    nombre: 'Supervisor',    rol: 'supervisor'    },
  { email: 'cajero@kingpack.com',     password: 'Cajero2026!',   nombre: 'Cajero',        rol: 'cajero'        },
  { email: 'vendedor@kingpack.com',   password: 'Vendedor2026!', nombre: 'Vendedor',      rol: 'vendedor'      },
];

async function run() {
  console.log('Seeding usuarios...\n');

  for (const u of USUARIOS) {
    const hash = await bcrypt.hash(u.password, 10);
    const { rowCount } = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, hash, u.nombre, u.rol]
    );
    const status = rowCount > 0 ? 'creado' : 'ya existía';
    console.log(`  [${u.rol}]  ${u.email}  →  ${status}`);
  }

  await pool.end();
  console.log('\nSeed completado.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
