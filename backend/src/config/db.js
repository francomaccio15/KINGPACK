const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en cliente idle:', err.message);
});

/**
 * Ejecuta una query con SET LOCAL app.usuario_id para que los triggers
 * de auditoría puedan registrar qué usuario hizo el cambio.
 */
async function queryWithUser(sql, params, usuarioId) {
  const client = await pool.connect();
  try {
    if (usuarioId) {
      await client.query(`SET LOCAL app.usuario_id = '${usuarioId}'`);
    }
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = { pool, queryWithUser };
