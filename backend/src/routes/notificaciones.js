const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// Solo admins pueden acceder a notificaciones
router.use(requireRol('administrador'));

// ─── GET /api/notificaciones ──────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const userId = req.usuario.id;

    // Último momento en que el admin abrió la campanita
    const { rows: visto } = await pool.query(
      'SELECT visto_en FROM admin_notif_visto WHERE usuario_id = $1',
      [userId]
    );
    const ultimaVista = visto[0]?.visto_en ?? new Date(0);

    const [
      notasNuevas,
      stockBajo,
      chequesVencidos,
      chequesHoy,
      chequesSemana,
      pedidosPendientes,
    ] = await Promise.all([

      // Notas creadas después de la última vista
      pool.query(`
        SELECT n.id, n.contenido, n.tipo, n.created_at,
               u.nombre AS autor
          FROM notas_equipo n
          JOIN usuarios u ON u.id = n.usuario_id
         WHERE n.deleted_at IS NULL AND n.created_at > $1
         ORDER BY n.created_at DESC
         LIMIT 15
      `, [ultimaVista]),

      // Artículos con stock bajo
      pool.query(`
        SELECT COUNT(*) AS count
          FROM stock s
          JOIN articulos a ON a.id = s.articulo_id
         WHERE a.deleted_at IS NULL AND a.activo = TRUE
           AND s.stock_minimo > 0 AND s.cantidad <= s.stock_minimo
      `),

      // Cheques ya vencidos (hasta 7 días atrás)
      pool.query(`
        SELECT COUNT(*) AS count FROM (
          SELECT id FROM venta_cheques
           WHERE fecha_vencimiento BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE - 1
          UNION ALL
          SELECT id FROM egreso_cheques
           WHERE fecha_vencimiento BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE - 1
        ) t
      `),

      // Cheques que vencen hoy
      pool.query(`
        SELECT COUNT(*) AS count FROM (
          SELECT id FROM venta_cheques  WHERE fecha_vencimiento = CURRENT_DATE
          UNION ALL
          SELECT id FROM egreso_cheques WHERE fecha_vencimiento = CURRENT_DATE
        ) t
      `),

      // Cheques que vencen en los próximos 7 días
      pool.query(`
        SELECT COUNT(*) AS count FROM (
          SELECT id FROM venta_cheques
           WHERE fecha_vencimiento BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
          UNION ALL
          SELECT id FROM egreso_cheques
           WHERE fecha_vencimiento BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
        ) t
      `),

      // Pedidos pendientes
      pool.query(`
        SELECT COUNT(*) AS count
          FROM pedidos_compra
         WHERE estado IN ('pendiente','confirmado')
      `),
    ]);

    // Construir alertas del sistema
    const alertas = [];

    const sb  = parseInt(stockBajo.rows[0].count);
    const chV = parseInt(chequesVencidos.rows[0].count);
    const chH = parseInt(chequesHoy.rows[0].count);
    const chS = parseInt(chequesSemana.rows[0].count);
    const pp  = parseInt(pedidosPendientes.rows[0].count);

    if (chV > 0) alertas.push({
      tipo: 'cheque_vencido',
      nivel: 'error',
      count: chV,
      href: '/dashboard',
      label: `${chV} cheque${chV !== 1 ? 's' : ''} vencido${chV !== 1 ? 's' : ''}`,
    });
    if (chH > 0) alertas.push({
      tipo: 'cheque_hoy',
      nivel: 'error',
      count: chH,
      href: '/dashboard',
      label: `${chH} cheque${chH !== 1 ? 's' : ''} vence${chH === 1 ? '' : 'n'} hoy`,
    });
    if (sb > 0) alertas.push({
      tipo: 'stock_bajo',
      nivel: 'warning',
      count: sb,
      href: '/articulos?stock_bajo=true',
      label: `${sb} artículo${sb !== 1 ? 's' : ''} con stock bajo`,
    });
    if (chS > 0) alertas.push({
      tipo: 'cheque_semana',
      nivel: 'warning',
      count: chS,
      href: '/dashboard',
      label: `${chS} cheque${chS !== 1 ? 's' : ''} vence${chS === 1 ? '' : 'n'} esta semana`,
    });
    if (pp > 0) alertas.push({
      tipo: 'pedido_pendiente',
      nivel: 'info',
      count: pp,
      href: '/pedidos-proveedores',
      label: `${pp} pedido${pp !== 1 ? 's' : ''} pendiente${pp !== 1 ? 's' : ''}`,
    });

    res.json({
      no_leidas:    notasNuevas.rows.length,
      notas_nuevas: notasNuevas.rows,
      alertas,
      ultima_vista: ultimaVista,
    });
  } catch (err) { next(err); }
});

// ─── POST /api/notificaciones/leer ───────────────────────────────────────────
router.post('/leer', async (req, res, next) => {
  try {
    await pool.query(`
      INSERT INTO admin_notif_visto (usuario_id, visto_en)
      VALUES ($1, NOW())
      ON CONFLICT (usuario_id) DO UPDATE SET visto_en = NOW()
    `, [req.usuario.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
