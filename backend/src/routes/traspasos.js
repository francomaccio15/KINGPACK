const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/traspasos ───────────────────────────────────────────────────────
// ?estado=           pendiente | en_transito | recibido | cancelado
// ?sucursal_origen=  UUID
// ?sucursal_destino= UUID
// ?sucursal_id=      UUID  (origen O destino — útil para cajero que ve su sucursal)
// ?limit=            default 100
// ?offset=           default 0
router.get('/', async (req, res, next) => {
  try {
    const {
      estado, sucursal_origen, sucursal_destino, sucursal_id,
      limit = 100, offset = 0,
    } = req.query;

    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (estado) {
      conditions.push(`t.estado = $${idx++}`);
      params.push(estado);
    }
    if (sucursal_origen) {
      conditions.push(`t.sucursal_origen_id = $${idx++}`);
      params.push(sucursal_origen);
    }
    if (sucursal_destino) {
      conditions.push(`t.sucursal_destino_id = $${idx++}`);
      params.push(sucursal_destino);
    }
    if (sucursal_id) {
      conditions.push(`(t.sucursal_origen_id = $${idx} OR t.sucursal_destino_id = $${idx})`);
      params.push(sucursal_id);
      idx++;
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(Math.min(parseInt(limit) || 100, 500));
    params.push(Math.max(parseInt(offset) || 0, 0));

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT
          t.id, t.estado, t.fecha_envio, t.fecha_recepcion, t.created_at,
          so.nombre AS sucursal_origen_nombre,
          sd.nombre AS sucursal_destino_nombre,
          u.nombre  AS usuario_nombre,
          (SELECT COUNT(*) FROM traspaso_items ti WHERE ti.traspaso_id = t.id) AS items_count,
          (SELECT COALESCE(SUM(ti2.cantidad), 0) FROM traspaso_items ti2 WHERE ti2.traspaso_id = t.id) AS unidades_total
        FROM traspasos t
        JOIN sucursales so ON so.id = t.sucursal_origen_id
        JOIN sucursales sd ON sd.id = t.sucursal_destino_id
        LEFT JOIN usuarios u ON u.id = t.usuario_id
        WHERE ${where}
        ORDER BY t.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, params),
      pool.query(`
        SELECT COUNT(*) FROM traspasos t WHERE ${where}
      `, countParams),
    ]);

    res.json({ count: parseInt(countRows[0].count), traspasos: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/traspasos ──────────────────────────────────────────────────────
// Body: { sucursal_origen_id, sucursal_destino_id, items: [{ articulo_id, cantidad }], notas? }
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { sucursal_origen_id, sucursal_destino_id, items = [], notas } = req.body;
    const usuario_id = req.user?.id ?? null;

    if (!sucursal_origen_id)  return res.status(400).json({ error: 'sucursal_origen_id es requerido' });
    if (!sucursal_destino_id) return res.status(400).json({ error: 'sucursal_destino_id es requerido' });
    if (sucursal_origen_id === sucursal_destino_id) {
      return res.status(400).json({ error: 'Origen y destino deben ser distintos' });
    }
    if (items.length === 0) return res.status(400).json({ error: 'El traspaso debe tener al menos un artículo' });

    await client.query('BEGIN');

    const { rows: tRows } = await client.query(`
      INSERT INTO traspasos (sucursal_origen_id, sucursal_destino_id, usuario_id, estado, notas)
      VALUES ($1, $2, $3, 'pendiente', $4)
      RETURNING id, estado, created_at
    `, [sucursal_origen_id, sucursal_destino_id, usuario_id, notas ?? null]);

    const traspaso = tRows[0];

    for (const item of items) {
      if (!item.articulo_id || !(parseFloat(item.cantidad) > 0)) continue;
      await client.query(`
        INSERT INTO traspaso_items (traspaso_id, articulo_id, cantidad)
        VALUES ($1, $2, $3)
        ON CONFLICT (traspaso_id, articulo_id)
        DO UPDATE SET cantidad = traspaso_items.cantidad + EXCLUDED.cantidad
      `, [traspaso.id, item.articulo_id, parseFloat(item.cantidad)]);
    }

    await client.query('COMMIT');
    res.status(201).json({ traspaso });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ─── GET /api/traspasos/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [{ rows: tRows }, { rows: itemRows }] = await Promise.all([
      pool.query(`
        SELECT
          t.id, t.estado, t.fecha_envio, t.fecha_recepcion, t.created_at, t.notas,
          t.sucursal_origen_id, t.sucursal_destino_id,
          so.nombre AS sucursal_origen_nombre,
          sd.nombre AS sucursal_destino_nombre,
          u.nombre  AS usuario_nombre
        FROM traspasos t
        JOIN sucursales so ON so.id = t.sucursal_origen_id
        JOIN sucursales sd ON sd.id = t.sucursal_destino_id
        LEFT JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.id = $1
      `, [id]),
      pool.query(`
        SELECT
          ti.articulo_id, ti.cantidad,
          a.nombre AS articulo_nombre,
          a.codigo AS articulo_codigo,
          COALESCE(
            (SELECT s.cantidad FROM stock s WHERE s.articulo_id = ti.articulo_id AND s.sucursal_id = t2.sucursal_origen_id),
            0
          ) AS stock_origen
        FROM traspaso_items ti
        JOIN articulos a ON a.id = ti.articulo_id
        JOIN traspasos t2 ON t2.id = ti.traspaso_id
        WHERE ti.traspaso_id = $1
        ORDER BY a.nombre
      `, [id]),
    ]);

    if (tRows.length === 0) return res.status(404).json({ error: 'Traspaso no encontrado' });

    res.json({ traspaso: tRows[0], items: itemRows });
  } catch (err) { next(err); }
});

// ─── PATCH /api/traspasos/:id/estado ─────────────────────────────────────────
// Transiciones válidas:
//   pendiente   → en_transito : sin cambio de stock (solo registra envío)
//   pendiente   → cancelado   : sin cambio de stock
//   en_transito → recibido    : descuenta origen Y acredita destino en un solo paso
//   en_transito → cancelado   : sin cambio de stock (nunca se tocó)
router.patch('/:id/estado', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { estado: nuevoEstado } = req.body;

    const validos = ['en_transito', 'recibido', 'cancelado'];
    if (!validos.includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado inválido. Válidos: en_transito, recibido, cancelado' });
    }

    const { rows: tRows } = await client.query(
      `SELECT t.*, so.nombre AS sucursal_origen_nombre, sd.nombre AS sucursal_destino_nombre
       FROM traspasos t
       JOIN sucursales so ON so.id = t.sucursal_origen_id
       JOIN sucursales sd ON sd.id = t.sucursal_destino_id
       WHERE t.id = $1`,
      [id]
    );
    if (!tRows[0]) return res.status(404).json({ error: 'Traspaso no encontrado' });
    const t = tRows[0];

    // Validar transición
    const transicionesValidas = {
      pendiente:   ['en_transito', 'cancelado'],
      en_transito: ['recibido', 'cancelado'],
    };
    if (!transicionesValidas[t.estado]?.includes(nuevoEstado)) {
      return res.status(400).json({
        error: `No se puede pasar de "${t.estado}" a "${nuevoEstado}"`,
      });
    }

    const { rows: items } = await client.query(
      `SELECT articulo_id, cantidad FROM traspaso_items WHERE traspaso_id = $1`,
      [id]
    );

    await client.query('BEGIN');

    if (nuevoEstado === 'en_transito') {
      // Solo registra la fecha de envío — el stock no se toca hasta confirmar recepción
      await client.query(
        `UPDATE traspasos SET estado = 'en_transito', fecha_envio = NOW() WHERE id = $1`,
        [id]
      );

    } else if (nuevoEstado === 'recibido') {
      // El destinatario confirmó: descuenta del origen y acredita en destino en una sola transacción
      for (const item of items) {
        // Descontar del origen
        await client.query(`
          INSERT INTO stock (articulo_id, sucursal_id, cantidad, stock_minimo)
          VALUES ($1, $2, (-$3::numeric), 0)
          ON CONFLICT (articulo_id, sucursal_id)
          DO UPDATE SET cantidad = stock.cantidad - $3::numeric, ultima_actualizacion = NOW()
        `, [item.articulo_id, t.sucursal_origen_id, item.cantidad]);

        await client.query(`
          INSERT INTO ajustes_stock (articulo_id, sucursal_id, cantidad_delta, motivo)
          VALUES ($1, $2, $3, $4)
        `, [item.articulo_id, t.sucursal_origen_id, -item.cantidad,
            `Traspaso recibido — salida de ${t.sucursal_origen_nombre} → ${t.sucursal_destino_nombre} (${id})`]);

        // Acreditar en destino
        await client.query(`
          INSERT INTO stock (articulo_id, sucursal_id, cantidad, stock_minimo)
          VALUES ($1, $2, $3, 0)
          ON CONFLICT (articulo_id, sucursal_id)
          DO UPDATE SET cantidad = stock.cantidad + $3, ultima_actualizacion = NOW()
        `, [item.articulo_id, t.sucursal_destino_id, item.cantidad]);

        await client.query(`
          INSERT INTO ajustes_stock (articulo_id, sucursal_id, cantidad_delta, motivo)
          VALUES ($1, $2, $3, $4)
        `, [item.articulo_id, t.sucursal_destino_id, item.cantidad,
            `Traspaso recibido — ingreso desde ${t.sucursal_origen_nombre} → ${t.sucursal_destino_nombre} (${id})`]);
      }

      await client.query(
        `UPDATE traspasos SET estado = 'recibido', fecha_recepcion = NOW() WHERE id = $1`,
        [id]
      );

    } else if (nuevoEstado === 'cancelado') {
      // No hubo movimiento de stock en ningún estado previo, solo cambiar estado
      await client.query(
        `UPDATE traspasos SET estado = 'cancelado' WHERE id = $1`,
        [id]
      );
    }

    await client.query('COMMIT');

    const { rows: updated } = await client.query(
      `SELECT id, estado, fecha_envio, fecha_recepcion FROM traspasos WHERE id = $1`,
      [id]
    );
    res.json({ traspaso: updated[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
