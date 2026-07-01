const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/pago-clientes ───────────────────────────────────────────────────
// Consolidado diario: TODOS los movimientos de clientes (desde el historial de
// cuenta corriente) y TODOS los egresos del día.
// ?fecha=YYYY-MM-DD  (default: hoy, zona horaria America/Argentina/Buenos_Aires)
// ?sucursal_id=UUID  (opcional; lo inyecta serverFetch según el selector global)
//   - egresos: filtra por e.sucursal_id
//   - movimientos de clientes: filtra por la sucursal por defecto del cliente
router.get('/', async (req, res, next) => {
  try {
    const { fecha, sucursal_id } = req.query;
    const dia = (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) ? fecha : null;

    // ── Movimientos de clientes del día ──
    const movParams = [dia];
    let movWhere = `cc.fecha >= COALESCE($1::date, CURRENT_DATE)
                AND cc.fecha <  COALESCE($1::date, CURRENT_DATE) + interval '1 day'`;
    if (sucursal_id) {
      movParams.push(sucursal_id);
      movWhere += ` AND c.sucursal_default_id = $${movParams.length}`;
    }
    const { rows: movimientos_clientes } = await pool.query(`
      SELECT cc.id, cc.cliente_id, c.razon_social AS cliente_nombre,
             cc.fecha, cc.origen_tipo, cc.debe, cc.haber, cc.saldo, cc.origen_id
        FROM cuentas_corrientes_cliente cc
        JOIN clientes c ON c.id = cc.cliente_id
       WHERE ${movWhere}
       ORDER BY cc.fecha ASC
    `, movParams);

    // ── Egresos del día ──
    const egParams = [dia];
    let egWhere = `e.deleted_at IS NULL
               AND e.fecha_emision >= COALESCE($1::date, CURRENT_DATE)
               AND e.fecha_emision <  COALESCE($1::date, CURRENT_DATE) + interval '1 day'`;
    if (sucursal_id) {
      egParams.push(sucursal_id);
      egWhere += ` AND e.sucursal_id = $${egParams.length}`;
    }
    const { rows: egresos } = await pool.query(`
      SELECT e.id, e.fecha_emision, e.descripcion, e.tipo_operacion, e.total,
             e.estado_pago, pv.razon_social AS proveedor_nombre, s.nombre AS sucursal_nombre
        FROM egresos e
        LEFT JOIN proveedores pv ON pv.id = e.proveedor_id
        LEFT JOIN sucursales  s  ON s.id  = e.sucursal_id
       WHERE ${egWhere}
       ORDER BY e.fecha_emision ASC, e.created_at ASC
    `, egParams);

    const sum = (arr, k) => arr.reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);
    const totales = {
      clientes_debe:  +sum(movimientos_clientes, 'debe').toFixed(2),
      clientes_haber: +sum(movimientos_clientes, 'haber').toFixed(2),
      egresos_total:  +sum(egresos, 'total').toFixed(2),
    };

    res.json({ fecha: dia, movimientos_clientes, egresos, totales });
  } catch (err) { next(err); }
});

module.exports = router;
