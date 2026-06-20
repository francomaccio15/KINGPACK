const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// Conciliación bancaria: solo administrador / supervisor (datos financieros)
router.use(requireRol('administrador', 'supervisor'));

// Normaliza un período a 'YYYY-MM-01'. Default: mes anterior al actual.
function periodoOrDefault(periodo) {
  if (periodo && /^\d{4}-\d{2}/.test(periodo)) {
    return periodo.slice(0, 7) + '-01';
  }
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7) + '-01';
}

// ─── GET /api/conciliacion?periodo=YYYY-MM ───────────────────────────────────
// Devuelve, para el período (default mes anterior): lo facturado en ARCA, el
// monto acreditado cargado (si existe) y la diferencia.
router.get('/', async (req, res, next) => {
  try {
    const periodo = periodoOrDefault(req.query.periodo);

    const [facturado, conc] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(total), 0)::float AS facturado
          FROM facturaciones
         WHERE ok = TRUE AND deleted_at IS NULL
           AND date_trunc('month', fecha_emision) = date_trunc('month', $1::date)
      `, [periodo]),
      pool.query(`
        SELECT monto_acreditado::float, observacion, updated_at
          FROM conciliacion_bancaria
         WHERE periodo = $1::date
      `, [periodo]),
    ]);

    const facturado_arca   = facturado.rows[0].facturado;
    const cargado          = conc.rows[0] || null;
    const monto_acreditado = cargado ? cargado.monto_acreditado : null;
    const diferencia       = monto_acreditado === null ? null
      : parseFloat((monto_acreditado - facturado_arca).toFixed(2));

    res.json({
      periodo,
      facturado_arca,
      monto_acreditado,
      diferencia,
      observacion: cargado?.observacion ?? null,
      actualizado_en: cargado?.updated_at ?? null,
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/conciliacion ───────────────────────────────────────────────────
// Body: { periodo: 'YYYY-MM', monto_acreditado, observacion? }
router.put('/', async (req, res, next) => {
  try {
    const periodo = periodoOrDefault(req.body.periodo);
    const monto   = parseFloat(req.body.monto_acreditado);
    if (!Number.isFinite(monto) || monto < 0) {
      return res.status(400).json({ error: 'Monto acreditado inválido' });
    }
    const observacion = (req.body.observacion && req.body.observacion.trim()) || null;

    await pool.query(`
      INSERT INTO conciliacion_bancaria (periodo, monto_acreditado, observacion, usuario_id, updated_at)
      VALUES ($1::date, $2, $3, $4, NOW())
      ON CONFLICT (periodo)
      DO UPDATE SET monto_acreditado = EXCLUDED.monto_acreditado,
                    observacion      = EXCLUDED.observacion,
                    usuario_id       = EXCLUDED.usuario_id,
                    updated_at       = NOW()
    `, [periodo, monto, observacion, req.usuario?.id || null]);

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
