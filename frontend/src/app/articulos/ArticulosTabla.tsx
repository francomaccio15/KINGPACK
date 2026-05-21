'use client';

import { useState, useEffect } from 'react';
import EditarArticulo from './EditarArticulo';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type StockDetalle = { nombre: string; cantidad: number; stock_bajo: boolean };

export type ArticuloRow = {
  id: string;
  codigo: string;
  nombre: string;
  precio_madre: string;
  precio_lista: string;
  costo_base: string;
  costo_flete: string;
  margen_aplicado: string | null;
  alicuota_iva_id: string;
  alicuota_porcentaje: string;
  activo: boolean;
  categoria_id: string;
  categoria: string;
  stock_total: string;
  stock_bajo: boolean;
  stock_detalle: StockDetalle[] | null;
};

type Categoria = { id: string; nombre: string; margen_default: string };
type Alicuota  = { id: string; porcentaje: string; descripcion: string };
type Lista     = { id: string; nombre: string; tipo: string; descuento_base_pct: string };
type Sucursal  = { id: string; nombre: string };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null | undefined) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

interface Props {
  articulos: ArticuloRow[];
  categorias: Categoria[];
  alicuotas: Alicuota[];
  listaActiva: Lista | null;
  sucursalActiva: Sucursal | null;
  modeTodas: boolean;
  hasFilters: boolean;
}

export default function ArticulosTabla({
  articulos: serverArticulos,
  categorias,
  alicuotas,
  listaActiva,
  sucursalActiva,
  modeTodas,
  hasFilters,
}: Props) {
  const [articulos, setArticulos] = useState<ArticuloRow[]>(serverArticulos);

  // Sincronizar cuando el servidor re-renderiza (router.refresh)
  useEffect(() => {
    setArticulos(serverArticulos);
  }, [serverArticulos]);

  // Actualización optimista inmediata al guardar
  const handleSave = (updated: Partial<ArticuloRow> & { id: string }) => {
    setArticulos(prev =>
      prev.map(a => (a.id === updated.id ? { ...a, ...updated } : a))
    );
  };

  const esBase   = listaActiva?.tipo === 'madre';

  return (
    <tbody className="bg-kp-surface divide-y divide-kp-border">
      {articulos.map(a => {
        const stock  = parseFloat(a.stock_total || '0');
        const pLista = parseFloat(a.precio_lista || '0');
        const pMadre = parseFloat(a.precio_madre || '0');
        const diffPct = !esBase && pMadre > 0
          ? ((pLista - pMadre) / pMadre) * 100
          : null;

        return (
          <tr key={a.id} className="hover:bg-kp-surface2 transition-colors duration-100 group">

            <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">
              {a.codigo}
            </td>

            <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors">
              {a.nombre}
            </td>

            <td className="px-4 py-3 whitespace-nowrap">
              <span className="text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray-lt">
                {a.categoria || '—'}
              </span>
            </td>

            {/* Precio de la lista activa */}
            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
              <span className="font-bold text-kp-white">{fmt(a.precio_lista)}</span>
              {diffPct !== null && Math.abs(diffPct) >= 0.01 && (
                <span className={`block text-[10px] ${diffPct < 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  {diffPct < 0 ? '−' : '+'}{Math.abs(diffPct).toFixed(1)}%
                </span>
              )}
            </td>

            {/* Precio base (columna extra si no estamos en la lista madre) */}
            {!esBase && (
              <td className="px-4 py-3 text-right tabular-nums text-kp-gray text-xs whitespace-nowrap">
                {fmt(a.precio_madre)}
              </td>
            )}

            {/* Stock */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              {modeTodas && a.stock_detalle && a.stock_detalle.length > 0 ? (
                <div className="flex items-center justify-center gap-2">
                  {a.stock_detalle.map(sd => (
                    <span key={sd.nombre}
                      className={`inline-flex items-center gap-1 text-xs tabular-nums
                        ${sd.stock_bajo ? 'text-amber-400' : 'text-kp-gray-lt'}`}>
                      <span className="text-[10px] text-kp-gray font-semibold uppercase">
                        {sd.nombre[0]}:
                      </span>
                      {sd.cantidad % 1 === 0
                        ? sd.cantidad.toFixed(0)
                        : sd.cantidad.toFixed(1)}
                      {sd.stock_bajo && (
                        <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
                      )}
                    </span>
                  ))}
                </div>
              ) : stock > 0 ? (
                <span className={`text-xs font-semibold tabular-nums
                  ${a.stock_bajo ? 'text-amber-400' : 'text-kp-gray-lt'}`}>
                  {stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(1)}
                  {a.stock_bajo && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block align-middle" />
                  )}
                </span>
              ) : (
                <span className="text-xs text-kp-border">—</span>
              )}
            </td>

            {/* Estado */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              {a.activo ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-red">
                  <span className="w-1.5 h-1.5 rounded-full bg-kp-red" />Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-gray">
                  <span className="w-1.5 h-1.5 rounded-full bg-kp-border" />Inactivo
                </span>
              )}
            </td>

            {/* Editar */}
            <td className="px-3 py-3 text-center">
              <EditarArticulo
                articulo={a}
                categorias={categorias}
                alicuotas={alicuotas}
                onSave={handleSave}
              />
            </td>
          </tr>
        );
      })}

      {articulos.length === 0 && (
        <tr>
          <td colSpan={esBase ? 6 : 7} className="px-4 py-12 text-center text-kp-gray">
            {hasFilters
              ? 'No se encontraron artículos con esos filtros.'
              : 'No hay artículos cargados todavía.'}
          </td>
        </tr>
      )}
    </tbody>
  );
}
