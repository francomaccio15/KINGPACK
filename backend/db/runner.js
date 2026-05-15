/**
 * KINGPACK — Migration & Seed Runner
 * Aplica archivos .sql pendientes de migrations/ y seeds/ en orden numérico.
 * Tracking vía tabla _migrations (idempotente).
 */
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR      = path.join(__dirname, 'seeds');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(200) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT filename FROM _migrations');
  return new Set(rows.map(r => r.filename));
}

function getSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function applyFile(client, dir, filename, applied) {
  if (applied.has(filename)) {
    console.log(`  [skip] ${filename}`);
    return;
  }
  const sql = fs.readFileSync(path.join(dir, filename), 'utf8');
  await client.query(sql);
  await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
  console.log(`  [ok]   ${filename}`);
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    console.log('\n── Migrations ──');
    for (const f of getSqlFiles(MIGRATIONS_DIR)) {
      await applyFile(client, MIGRATIONS_DIR, f, applied);
    }

    console.log('\n── Seeds ──');
    for (const f of getSqlFiles(SEEDS_DIR)) {
      await applyFile(client, SEEDS_DIR, f, applied);
    }

    await client.query('COMMIT');
    console.log('\n✓ Runner completado sin errores.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Error — se hizo ROLLBACK completo.');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
