// Conversión de un artículo a unidades sueltas (paso 4 de
// docs/PLAN_VENTA_POR_UNIDAD.md). La usan la pantalla Artículos → Venta por
// unidad (de a un artículo, al instante) y scripts/convertir-stock-por-unidad.js
// (por planilla). Corre dentro de la transacción de quien llama.
//
// Para un artículo con unidades_por_bulto = 1 y un factor F > 1:
//   1. stock (adelante, depósito y mínimo) × F en todas las sucursales, con su
//      renglón en ajustes_stock. El trigger de ubicaciones recalcula el total.
//   2. articulos.unidades_por_bulto = F.
//   3. Re-basa el factor congelado de las líneas POR BULTO ya guardadas
//      (venta_items, traspaso_items y el JSONB de devoluciones y NC): antes un
//      bulto valía 1 unidad de stock, ahora vale F. Sin esto, anular una venta
//      vieja devolvería 1 unidad en vez de 1 bulto.
//   4. Controla que cada sucursal quedó exactamente × F y que el valor del
//      inventario (stock ÷ unidades_por_bulto × costo) no cambió.
// Si algo no cuadra tira un Error con `status` 409 y quien llama hace ROLLBACK.

function errorConversion(msg, status = 409) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

// Factor sugerido a partir del nombre: «BANDEJA CARTON GRIS N1 X 100UNID.» → 100.
// Toma el número pegado a la palabra de unidad (en «615X50UNID.» es 50, no 615)
// y tolera erratas como «NUD» o la letra O en lugar de cero («X1OOU»). Es SOLO
// una sugerencia: la confirma una persona.
function factorSugerido(nombre) {
  const crudo = String(nombre || '').toUpperCase();
  const s = crudo.replace(/(\d)(O+)/g, (m, d, o) => d + '0'.repeat(o.length));
  const errata = s !== crudo;
  const matches = [...s.matchAll(/(\d+)\s*(UNIDADES|UNIDAD|UNID|UNI|UDS|UN|NUD|U)\b\.?/g)];
  if (matches.length === 0) {
    // «VASO X100» sin la palabra de unidad: se sugiere, pero a revisar.
    const x = s.match(/X\s*(\d+)\s*\.?\s*$/);
    const nx = x ? parseInt(x[1], 10) : 0;
    return nx > 1 ? { factor: nx, confianza: 'revisar' } : { factor: '', confianza: 'sin_dato' };
  }
  const n = parseInt(matches[matches.length - 1][1], 10);
  if (!(n > 1)) return { factor: '', confianza: 'sin_dato' };
  return { factor: n, confianza: matches.length === 1 && !errata ? 'alta' : 'revisar' };
}

async function valorInventario(client, articuloId) {
  const { rows } = await client.query(`
    SELECT COALESCE(SUM(s.cantidad / a.unidades_por_bulto * a.costo_base), 0)::numeric AS valor
      FROM stock s JOIN articulos a ON a.id = s.articulo_id
     WHERE a.id = $1
  `, [articuloId]);
  return parseFloat(rows[0].valor);
}

async function convertirArticuloAUnidades(client, articuloId, factor, usuarioId = null) {
  if (!Number.isInteger(factor) || factor <= 1) {
    throw errorConversion('Las unidades por bulto tienen que ser un número entero mayor a 1', 400);
  }

  const { rows: [art] } = await client.query(
    `SELECT id, codigo, nombre, unidades_por_bulto FROM articulos
      WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [articuloId]
  );
  if (!art) throw errorConversion('Artículo no encontrado', 404);
  if (art.unidades_por_bulto !== 1) {
    throw errorConversion(`"${art.nombre}" ya está en unidades (bulto de ${art.unidades_por_bulto}); no se convierte dos veces`);
  }
  const { rows: sueltas } = await client.query(
    `SELECT 1 FROM venta_items WHERE articulo_id = $1 AND unidad_venta = 'unidad' LIMIT 1`, [art.id]
  );
  if (sueltas.length) throw errorConversion(`"${art.nombre}" tiene ventas por unidad sin convertir: el stock no es confiable`);

  // Bloquea el stock del artículo: nadie vende mientras se convierte.
  const { rows: stocks } = await client.query(
    `SELECT sucursal_id, cantidad FROM stock WHERE articulo_id = $1 FOR UPDATE`, [art.id]
  );
  const valorAntes = await valorInventario(client, art.id);

  await client.query(`
    UPDATE stock
       SET cantidad_adelante = cantidad_adelante * $2,
           cantidad_deposito = cantidad_deposito * $2,
           stock_minimo      = stock_minimo * $2,
           ultima_actualizacion = NOW()
     WHERE articulo_id = $1
  `, [art.id, factor]);
  for (const s of stocks) {
    const antes = parseFloat(s.cantidad);
    const delta = parseFloat((antes * (factor - 1)).toFixed(3));
    if (Math.abs(delta) > 0.0001) {
      await client.query(`
        INSERT INTO ajustes_stock (articulo_id, sucursal_id, cantidad_delta, motivo, usuario_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [art.id, s.sucursal_id, delta, `Conversión a unidades sueltas: ${antes} bultos × ${factor}`, usuarioId]);
    }
  }

  await client.query(`UPDATE articulos SET unidades_por_bulto = $2 WHERE id = $1`, [art.id, factor]);

  await client.query(
    `UPDATE venta_items SET factor = $2 WHERE articulo_id = $1 AND unidad_venta = 'bulto'`, [art.id, factor]
  );
  await client.query(
    `UPDATE traspaso_items SET factor = $2 WHERE articulo_id = $1 AND unidad_venta = 'bulto'`, [art.id, factor]
  );
  for (const tabla of ['devoluciones_mercaderia', 'notas_credito']) {
    await client.query(`
      UPDATE ${tabla} t
         SET items = (
           SELECT jsonb_agg(
                    CASE WHEN it->>'articulo_id' = $1::text
                              AND COALESCE(it->>'unidad_venta', 'bulto') = 'bulto'
                         THEN it || jsonb_build_object('unidad_venta', 'bulto', 'factor', $2::int)
                         ELSE it END
                    ORDER BY ord)
             FROM jsonb_array_elements(t.items) WITH ORDINALITY AS e(it, ord)
         )
       WHERE jsonb_typeof(t.items) = 'array'
         AND t.items @> jsonb_build_array(jsonb_build_object('articulo_id', $1::text))
    `, [art.id, factor]);
  }

  // Control: el total de cada sucursal quedó exactamente × factor.
  const { rows: despues } = await client.query(
    `SELECT sucursal_id, cantidad FROM stock WHERE articulo_id = $1`, [art.id]
  );
  for (const s of stocks) {
    const d = despues.find(x => x.sucursal_id === s.sucursal_id);
    const esperado = parseFloat((parseFloat(s.cantidad) * factor).toFixed(3));
    if (!d || Math.abs(parseFloat(d.cantidad) - esperado) > 0.0005) {
      throw errorConversion(`${art.codigo}: el stock no quedó × ${factor} (esperado ${esperado}, quedó ${d?.cantidad})`);
    }
  }
  const valorDespues = await valorInventario(client, art.id);
  if (Math.abs(valorAntes - valorDespues) > 0.01) {
    throw errorConversion(`${art.codigo}: el valor del inventario cambió con la conversión`);
  }

  return {
    articulo: art,
    stock: stocks.map(s => ({
      sucursal_id: s.sucursal_id,
      antes: parseFloat(s.cantidad),
      despues: parseFloat((parseFloat(s.cantidad) * factor).toFixed(3)),
    })),
    valor: valorDespues,
  };
}

module.exports = { factorSugerido, convertirArticuloAUnidades };
