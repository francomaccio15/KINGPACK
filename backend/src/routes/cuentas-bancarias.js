const express = require('express');
const { pool } = require('../config/db');
const { fijarSaldoBancario } = require('../services/movimientos-bancarios');

const router = express.Router();

// ─── GET /api/cuentas-bancarias ───────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { activo = 'true' } = req.query;
    const conditions = [];
    const params = [];

    if (activo !== 'all') {
      conditions.push(`activo = $1`);
      params.push(activo !== 'false');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, nombre, banco, titular, alias, cbu, activo, saldo::float, sucursal_id, es_cuenta_cheques FROM cuentas_bancarias_empresa ${where} ORDER BY nombre`,
      params
    );
    res.json({ cuentas: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/cuentas-bancarias ──────────────────────────────────────────────
// Body: { nombre, banco?, titular?, alias?, cbu? }
router.post('/', async (req, res, next) => {
  try {
    const { nombre, banco, titular, alias, cbu, saldo, sucursal_id } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' });

    // El saldo de alta es el punto de partida del ledger: va en las dos columnas,
    // si no la cuenta nace con descuadre (saldo ≠ saldo_inicial + 0 movimientos).
    const saldoInicial = parseFloat(saldo) || 0;
    const { rows } = await pool.query(
      `INSERT INTO cuentas_bancarias_empresa (nombre, banco, titular, alias, cbu, saldo, saldo_inicial, sucursal_id)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7) RETURNING *`,
      [nombre.trim(), banco?.trim() || null, titular?.trim() || null, alias?.trim() || null, cbu?.trim() || null, saldoInicial, sucursal_id || null]
    );
    res.status(201).json({ cuenta: rows[0] });
  } catch (err) { next(err); }
});

// ─── PUT /api/cuentas-bancarias/:id ──────────────────────────────────────────
// `saldo` NO se escribe acá: es un valor derivado del ledger (mig 046). Si viene
// en el body se corrige con `fijarSaldoBancario`, que re-basa `saldo_inicial`
// para no romper el invariante ni perder los movimientos ya registrados.
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const fields = ['nombre', 'banco', 'titular', 'alias', 'cbu', 'activo', 'sucursal_id'];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f] === '' ? null : req.body[f]);
      }
    }

    const tocaSaldo = req.body.saldo !== undefined;
    if (!updates.length && !tocaSaldo) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    await client.query('BEGIN');

    // Blindaje: no dejar inhabilitar en silencio la cuenta por la que se cobran y
    // pagan TODOS los cheques (mig 049). Si se está desactivando esa cuenta y no
    // vino confirmación explícita, se corta con 409 + código para que la UI avise.
    // Los cheques pendientes seguirían impactando esta cuenta y quedarían sin reflejo
    // visible si la cuenta desaparece del listado (que filtra por activo).
    if (req.body.activo === false && req.body.confirmar_cheques !== true) {
      const { rows: flagRows } = await client.query(
        `SELECT es_cuenta_cheques FROM cuentas_bancarias_empresa WHERE id = $1`,
        [req.params.id]
      );
      if (flagRows[0]?.es_cuenta_cheques) {
        const { rows: pend } = await client.query(`
          SELECT COUNT(*)::int AS pendientes
            FROM vw_cheques
           WHERE (tipo = 'recibido' AND estado IN ('en_cartera','depositado'))
              OR (tipo = 'emitido'  AND estado IN ('emitido','presentado'))
        `);
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'CUENTA_CHEQUES',
          mensaje: 'Es la cuenta por la que se cobran y pagan todos los cheques. '
            + 'Inhabilitarla puede causar que futuros cheques no impacten correctamente.',
          cheques_pendientes: pend[0].pendientes,
        });
      }
    }

    let existe = true;
    if (updates.length) {
      params.push(req.params.id);
      const { rows } = await client.query(
        `UPDATE cuentas_bancarias_empresa SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = $${idx} RETURNING id`,
        params
      );
      existe = !!rows[0];
    }
    if (existe && tocaSaldo) {
      existe = await fijarSaldoBancario(client, req.params.id, req.body.saldo);
    }

    if (!existe) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
