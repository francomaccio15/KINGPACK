#!/usr/bin/env node
/**
 * KINGPACK — Conversión del stock a unidades sueltas (paso 4 del plan)
 *
 * docs/PLAN_VENTA_POR_UNIDAD.md. Lee la planilla de factores VERIFICADA (el CSV
 * de Artículos → Exportar factores, con la columna `factor_verificado`
 * completada por el depósito) y, para cada artículo con factor > 1:
 *
 *   1. stock (cantidad, adelante, depósito y mínimo) × factor, en todas las
 *      sucursales, con su renglón en ajustes_stock.
 *   2. articulos.unidades_por_bulto = factor.
 *   3. Re-basa el factor congelado de las líneas POR BULTO ya guardadas
 *      (venta_items, traspaso_items y el JSONB de devoluciones y NC): antes de
 *      la conversión un bulto valía 1 unidad de stock, ahora vale `factor`. Sin
 *      esto, anular una venta vieja devolvería 1 unidad en vez de 1 bulto.
 *
 * Todo en UNA transacción. Antes de confirmar verifica el invariante del plan:
 * el valor del inventario (stock ÷ unidades_por_bulto × costo_base) no cambia
 * ni un peso. Si no cuadra → ROLLBACK, hay un factor mal cargado.
 *
 * Por defecto SIMULA (hace todo y ROLLBACK). Para aplicar: --aplicar.
 * NO marca vende_por_unidad ni carga precios: eso es el paso 2/5, por pantalla.
 *
 * Uso:
 *   node -r dotenv/config scripts/convertir-stock-por-unidad.js --archivo factores.csv [--aplicar]
 *
 * Correr de noche, con un conteo físico del día anterior y las dos cajas
 * cerradas (nadie vendiendo mientras corre).
 */

const fs = require('fs');
const { pool } = require('../src/config/db');

const log = (...a) => console.log(...a);

function arg(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// CSV con «;» (el que genera el export) o «,» si Excel lo re-guardó en inglés:
// el separador se toma de la cabecera. Comillas dobles opcionales, BOM.
function parseCsv(texto) {
  const filas = [];
  let fila = [], celda = '', comillas = false;
  const t = texto.replace(/^﻿/, '');
  const sep = t.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim() !== ''));
}

function leerFactores(ruta) {
  const filas = parseCsv(fs.readFileSync(ruta, 'utf8'));
  const cab = filas[0].map(h => h.trim().toLowerCase());
  const iCod = cab.indexOf('codigo');
  const iFac = cab.indexOf('factor_verificado');
  if (iCod < 0 || iFac < 0) throw new Error('El CSV necesita las columnas "codigo" y "factor_verificado"');
  const out = [];
  for (const f of filas.slice(1)) {
    const codigo = (f[iCod] || '').trim();
    const crudo = (f[iFac] || '').trim();
    if (!codigo || !crudo) continue; // sin verificar → queda en 1, no se adivina
    if (!/^\d+$/.test(crudo)) throw new Error(`Factor inválido para ${codigo}: "${crudo}" (tiene que ser un entero)`);
    const factor = parseInt(crudo, 10);
    if (factor > 1) out.push({ codigo, factor });
  }
  return out;
}

async function valorInventario(client, ids) {
  const { rows } = await client.query(`
    SELECT COALESCE(SUM(s.cantidad / a.unidades_por_bulto * a.costo_base), 0)::numeric AS valor
      FROM stock s JOIN articulos a ON a.id = s.articulo_id
     WHERE a.id = ANY($1::uuid[])
  `, [ids]);
  return parseFloat(rows[0].valor);
}

async function main() {
  const ruta = arg('--archivo');
  const aplicar = process.argv.includes('--aplicar');
  if (!ruta) throw new Error('Falta --archivo <planilla.csv>');

  const factores = leerFactores(ruta);
  log(`Planilla: ${factores.length} artículos con factor verificado > 1`);
  if (factores.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: arts } = await client.query(
      `SELECT id, codigo, nombre, unidades_por_bulto FROM articulos
        WHERE codigo = ANY($1) AND deleted_at IS NULL FOR UPDATE`,
      [factores.map(f => f.codigo)]
    );
    const porCodigo = Object.fromEntries(arts.map(a => [a.codigo, a]));

    const faltan = factores.filter(f => !porCodigo[f.codigo]).map(f => f.codigo);
    if (faltan.length) throw new Error(`Códigos que no existen: ${faltan.join(', ')}`);
    const yaConvertidos = factores.filter(f => porCodigo[f.codigo].unidades_por_bulto !== 1);
    if (yaConvertidos.length) {
      throw new Error(`Ya convertidos (unidades_por_bulto ≠ 1), no se convierten dos veces: ${yaConvertidos.map(f => f.codigo).join(', ')}`);
    }

    const ids = factores.map(f => porCodigo[f.codigo].id);
    const { rows: sueltas } = await client.query(
      `SELECT DISTINCT articulo_id FROM venta_items WHERE unidad_venta = 'unidad' AND articulo_id = ANY($1::uuid[])`,
      [ids]
    );
    if (sueltas.length) throw new Error('Hay ventas por unidad de artículos sin convertir: el stock no es confiable');

    const valorAntes = await valorInventario(client, ids);

    for (const f of factores) {
      const art = porCodigo[f.codigo];
      const { rows: stocks } = await client.query(
        `SELECT sucursal_id, cantidad FROM stock WHERE articulo_id = $1`, [art.id]
      );
      // Se fijan los componentes: el trigger de ubicaciones recalcula el total.
      await client.query(`
        UPDATE stock
           SET cantidad_adelante = cantidad_adelante * $2,
               cantidad_deposito = cantidad_deposito * $2,
               stock_minimo      = stock_minimo * $2,
               ultima_actualizacion = NOW()
         WHERE articulo_id = $1
      `, [art.id, f.factor]);
      for (const s of stocks) {
        const antes = parseFloat(s.cantidad);
        const delta = parseFloat((antes * (f.factor - 1)).toFixed(3));
        if (Math.abs(delta) > 0.0001) {
          await client.query(`
            INSERT INTO ajustes_stock (articulo_id, sucursal_id, cantidad_delta, motivo)
            VALUES ($1, $2, $3, $4)
          `, [art.id, s.sucursal_id, delta, `Conversión a unidades sueltas: ${antes} bultos × ${f.factor}`]);
        }
      }

      await client.query(`UPDATE articulos SET unidades_por_bulto = $2 WHERE id = $1`, [art.id, f.factor]);

      await client.query(
        `UPDATE venta_items SET factor = $2 WHERE articulo_id = $1 AND unidad_venta = 'bulto'`,
        [art.id, f.factor]
      );
      await client.query(
        `UPDATE traspaso_items SET factor = $2 WHERE articulo_id = $1 AND unidad_venta = 'bulto'`,
        [art.id, f.factor]
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
        `, [art.id, f.factor]);
      }

      // Control: el total de cada sucursal quedó exactamente × factor.
      const { rows: despues } = await client.query(
        `SELECT sucursal_id, cantidad FROM stock WHERE articulo_id = $1`, [art.id]
      );
      for (const s of stocks) {
        const d = despues.find(x => x.sucursal_id === s.sucursal_id);
        const esperado = parseFloat((parseFloat(s.cantidad) * f.factor).toFixed(3));
        if (!d || Math.abs(parseFloat(d.cantidad) - esperado) > 0.0005) {
          throw new Error(`${f.codigo}: el stock no quedó × ${f.factor} (esperado ${esperado}, quedó ${d?.cantidad}). ¿adelante + depósito no sumaban el total?`);
        }
      }
      log(`  ${f.codigo.padEnd(14)} × ${String(f.factor).padStart(4)}  ${art.nombre}`);
    }

    const valorDespues = await valorInventario(client, ids);
    log(`\nValor del inventario convertido: antes $${valorAntes.toFixed(2)} · después $${valorDespues.toFixed(2)}`);
    if (Math.abs(valorAntes - valorDespues) > 0.01) {
      throw new Error('El valor del inventario cambió con la conversión: hay un factor mal cargado. No se avanza.');
    }

    if (aplicar) {
      await client.query('COMMIT');
      log('\n✓ Conversión APLICADA.');
    } else {
      await client.query('ROLLBACK');
      log('\n(simulación) Todo cuadra. Nada se guardó: correr con --aplicar para confirmar.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('✗', err.message);
  process.exit(1);
});
