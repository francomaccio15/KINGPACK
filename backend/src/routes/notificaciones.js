const express = require('express');
const { pool } = require('../config/db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

// Campanita: administradores (notas + alertas de gestión) y cajeros (solo notas)
router.use(requireRol('administrador', 'cajero'));

// ─── GET /api/notificaciones ──────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const userId  = req.usuario.id;
    const esAdmin = req.usuario.rol === 'administrador';

    // Último momento en que el usuario abrió la campanita
    const { rows: visto } = await pool.query(
      'SELECT visto_en FROM admin_notif_visto WHERE usuario_id = $1',
      [userId]
    );
    const ultimaVista = visto[0]?.visto_en ?? new Date(0);

    // Notas de equipo nuevas (visibles para todos los roles con campanita)
    const notasNuevas = await pool.query(`
      SELECT n.id, n.contenido, n.tipo, n.created_at,
             u.nombre AS autor
        FROM notas_equipo n
        JOIN usuarios u ON u.id = n.usuario_id
       WHERE n.deleted_at IS NULL AND n.created_at > $1
       ORDER BY n.created_at DESC
       LIMIT 15
    `, [ultimaVista]);

    // Alertas de gestión — solo para administradores. El cajero solo ve notas.
    const alertas = [];
    if (esAdmin) {
      const [
        stockBajo,
        chequesVencidos,
        chequesHoy,
        chequesSemana,
        pedidosPendientes,
        fechaInfo,
        concPrev,
      ] = await Promise.all([

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

        // Info de fecha (en hora del servidor/DB): día del mes, primer día hábil
        // del mes (lun-vie, sin feriados) y primer día del mes anterior.
        pool.query(`
          SELECT
            EXTRACT(DAY FROM CURRENT_DATE)::int AS dia_mes,
            EXTRACT(DAY FROM (
              SELECT MIN(d)::date
                FROM generate_series(date_trunc('month', CURRENT_DATE)::date,
                                     date_trunc('month', CURRENT_DATE)::date + 6,
                                     INTERVAL '1 day') d
               WHERE EXTRACT(ISODOW FROM d) < 6
            ))::int AS primer_habil_dia,
            (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS periodo_ant
        `),

        // ¿Ya se cargó la conciliación del mes anterior?
        pool.query(`
          SELECT 1
            FROM conciliacion_bancaria
           WHERE periodo = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
        `),
      ]);

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

      // ── Recordatorios de obligaciones impositivas (por día del mes) ──
      // Ventana: 3 días antes (warning) → el día (error "vence hoy") → hasta 3
      // días después (error "vencido"). Lista fija de obligaciones del comercio.
      const diaMes = parseInt(fechaInfo.rows[0].dia_mes, 10);
      const OBLIGACIONES = [
        { dia: 7,  label: 'Cargas sociales y laborales' },
        { dia: 7,  label: 'Autónomos' },
        { dia: 14, label: 'Impuestos municipales (TISH)' },
        { dia: 14, label: 'Rentas Salta' },
        { dia: 17, label: 'Impuestos nacionales' },
        { dia: 19, label: 'Monotributo' },
      ];
      const DIAS_ANTES = 3, DIAS_DESPUES = 3;
      for (const o of OBLIGACIONES) {
        const diff = diaMes - o.dia; // <0 faltan días · 0 hoy · >0 vencido hace
        if (diff < -DIAS_ANTES || diff > DIAS_DESPUES) continue;
        let nivel, label;
        if (diff < 0) {
          nivel = 'warning';
          label = `${o.label}: vence en ${-diff} día${-diff !== 1 ? 's' : ''} (día ${o.dia})`;
        } else if (diff === 0) {
          nivel = 'error';
          label = `${o.label}: vence hoy`;
        } else {
          nivel = 'error';
          label = `${o.label}: vencido hace ${diff} día${diff !== 1 ? 's' : ''}`;
        }
        alertas.push({ tipo: 'impuesto', nivel, href: '/impuestos', label });
      }

      // ── Recordatorio: conciliación bancaria del mes anterior ──
      // Desde el primer día hábil del mes hasta el día 10, si todavía no se cargó
      // el monto acreditado en banco del mes anterior.
      const primerHabilDia = parseInt(fechaInfo.rows[0].primer_habil_dia, 10);
      const concCargada     = concPrev.rows.length > 0;
      if (!concCargada && diaMes >= primerHabilDia && diaMes <= 10) {
        const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const pa  = new Date(fechaInfo.rows[0].periodo_ant);
        const lbl = `${MESES[pa.getUTCMonth()]} ${pa.getUTCFullYear()}`;
        alertas.push({
          tipo: 'conciliacion',
          nivel: 'warning',
          href: '/dashboard',
          label: `Cargar lo acreditado en banco de ${lbl} y comparar con ARCA`,
        });
      }
    }

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
