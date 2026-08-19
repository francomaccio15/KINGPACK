'use client';

import { useMemo, useState } from 'react';

type StockDetalle = { nombre: string; cantidad: number; stock_bajo: boolean };

type ArticuloVal = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  costo_base: string;
  costo_flete: string;
  stock_total: string;
  stock_detalle: StockDetalle[] | null;
};

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 });

// Cuántos artículos se muestran en la tabla cuando no hay búsqueda activa. Los
// totales por sucursal y el general siempre se calculan sobre TODO el inventario.
const LIMITE_SIN_BUSQUEDA = 12;

/**
 * Stock Valorizado — cuánto le costó a King Pack tener el inventario en depósito.
 * Los totales (por sucursal y general) se calculan sobre todo el inventario. La
 * tabla de detalle, en cambio, muestra solo algunos artículos y un buscador para
 * encontrar un producto puntual, así la lista no queda tan larga. Solo admin.
 */
export default function StockValorizado({
  articulos, sucursales,
}: {
  articulos: ArticuloVal[];
  sucursales: { id: string; nombre: string }[];
}) {
  const [query, setQuery] = useState('');

  // Orden estable de columnas de sucursal según las sucursales activas.
  const nombresSuc = sucursales.map(s => s.nombre);

  const cantEnSuc = (a: ArticuloVal, nombre: string): number => {
    const sd = a.stock_detalle?.find(d => d.nombre === nombre);
    return sd ? Number(sd.cantidad) : 0;
  };

  // Todas las filas valorizadas (base para los totales, no depende de la búsqueda).
  const filas = useMemo(() => articulos.map(a => {
    const costoBase   = parseFloat(a.costo_base)  || 0;
    const fletePct    = parseFloat(a.costo_flete) || 0;
    const costoUnit   = costoBase * (1 + fletePct / 100);
    const stockTotal  = parseFloat(a.stock_total) || 0;
    const valor       = costoUnit * stockTotal;
    // Valor del stock discriminado por sucursal: costo unitario × cantidad en esa
    // sucursal. Permite ver el capital inmovilizado en Huaico y en Laprida por separado.
    const valorPorSuc: Record<string, number> = {};
    for (const n of nombresSuc) valorPorSuc[n] = costoUnit * cantEnSuc(a, n);
    return { a, costoBase, fletePct, costoUnit, stockTotal, valor, valorPorSuc };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [articulos, sucursales]);

  const totalValor  = filas.reduce((acc, f) => acc + f.valor, 0);
  const totalUnid   = filas.reduce((acc, f) => acc + f.stockTotal, 0);
  // Totales por sucursal (unidades y valor) para el resumen y el pie de tabla.
  const totalValorSuc = Object.fromEntries(
    nombresSuc.map(n => [n, filas.reduce((acc, f) => acc + f.valorPorSuc[n], 0)])
  ) as Record<string, number>;
  const totalUnidSuc = Object.fromEntries(
    nombresSuc.map(n => [n, filas.reduce((acc, f) => acc + cantEnSuc(f.a, n), 0)])
  ) as Record<string, number>;

  // Filas que se muestran en la tabla: filtradas por la búsqueda o, sin búsqueda,
  // solo las primeras LIMITE_SIN_BUSQUEDA.
  const q = query.trim().toLowerCase();
  const filasMatch = q
    ? filas.filter(({ a }) =>
        a.nombre.toLowerCase().includes(q) ||
        a.codigo.toLowerCase().includes(q) ||
        (a.categoria ?? '').toLowerCase().includes(q))
    : filas;
  const filasVisibles = q ? filasMatch : filasMatch.slice(0, LIMITE_SIN_BUSQUEDA);
  const ocultas = filasMatch.length - filasVisibles.length;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-kp-surface border border-kp-border p-4">
          <p className="text-[11px] uppercase tracking-widest text-kp-gray font-semibold">Artículos</p>
          <p className="text-2xl font-bold mt-1">{filas.length}</p>
        </div>
        <div className="rounded-xl bg-kp-surface border border-kp-border p-4">
          <p className="text-[11px] uppercase tracking-widest text-kp-gray font-semibold">Unidades en depósito</p>
          <p className="text-2xl font-bold mt-1">{num.format(totalUnid)}</p>
        </div>
      </div>

      {/* Valor del stock (a costo): una tarjeta por sucursal + total general */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {nombresSuc.map(n => (
          <div key={n} className="rounded-xl bg-kp-surface border border-kp-red/30 p-4">
            <p className="text-[11px] uppercase tracking-widest text-kp-red/90 font-semibold">Valor stock · {n} (a costo)</p>
            <p className="text-2xl font-bold mt-1 text-kp-red">{ars.format(totalValorSuc[n] ?? 0)}</p>
            <p className="text-[11px] text-kp-gray mt-1">{num.format(totalUnidSuc[n] ?? 0)} unidades</p>
          </div>
        ))}
        <div className="rounded-xl bg-kp-red/10 border border-kp-red/50 p-4">
          <p className="text-[11px] uppercase tracking-widest text-kp-red font-semibold">Valor total del stock (a costo)</p>
          <p className="text-2xl font-bold mt-1 text-kp-red">{ars.format(totalValor)}</p>
          <p className="text-[11px] text-kp-gray mt-1">{num.format(totalUnid)} unidades</p>
        </div>
      </div>

      {/* Buscador de artículos */}
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="w-4 h-4 text-kp-gray absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar artículo por nombre, código o categoría…"
          className="w-full rounded-lg bg-kp-surface border border-kp-border pl-9 pr-9 py-2.5 text-sm
            text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red/50"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-kp-gray hover:text-kp-white px-1.5"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Código</th>
              <th className="text-left px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-right px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Costo</th>
              <th className="text-right px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Flete</th>
              <th className="text-right px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Costo unit.</th>
              {nombresSuc.map(n => (
                <th key={n} className="text-center px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                  Stock · {n}
                </th>
              ))}
              <th className="text-center px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Stock total</th>
              <th className="text-right px-3 py-3 text-kp-red uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Valor stock</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={7 + nombresSuc.length} className="px-3 py-10 text-center text-kp-gray">
                  No hay artículos para valorizar.
                </td>
              </tr>
            ) : filasVisibles.length === 0 ? (
              <tr>
                <td colSpan={7 + nombresSuc.length} className="px-3 py-10 text-center text-kp-gray">
                  No se encontraron artículos para “{query}”.
                </td>
              </tr>
            ) : filasVisibles.map(({ a, costoBase, fletePct, costoUnit, stockTotal, valor, valorPorSuc }) => (
              <tr key={a.id} className="border-b border-kp-border/60 hover:bg-kp-surface2/50">
                <td className="px-3 py-2 text-kp-gray-lt whitespace-nowrap">{a.codigo}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{a.nombre}</span>
                  {a.categoria && (
                    <span className="block text-[11px] text-kp-gray">{a.categoria}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{ars.format(costoBase)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-kp-gray">
                  {fletePct > 0 ? `${num.format(fletePct)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{ars.format(costoUnit)}</td>
                {nombresSuc.map(n => (
                  <td key={n} className="px-3 py-2 text-center whitespace-nowrap">
                    <span className="font-medium">{num.format(cantEnSuc(a, n))}</span>
                    <span className="block text-[11px] text-kp-red/80">{ars.format(valorPorSuc[n])}</span>
                  </td>
                ))}
                <td className="px-3 py-2 text-center whitespace-nowrap font-semibold">{num.format(stockTotal)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-kp-red">{ars.format(valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-kp-surface2 border-t-2 border-kp-red/40">
              <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-widest text-xs font-bold text-kp-gray">
                Total valorizado por sucursal
              </td>
              {nombresSuc.map(n => (
                <td key={n} className="px-3 py-3 text-center whitespace-nowrap">
                  <span className="block font-bold">{num.format(totalUnidSuc[n] ?? 0)}</span>
                  <span className="block text-[11px] font-bold text-kp-red">{ars.format(totalValorSuc[n] ?? 0)}</span>
                </td>
              ))}
              <td className="px-3 py-3 text-center whitespace-nowrap font-bold">{num.format(totalUnid)}</td>
              <td className="px-3 py-3 text-right whitespace-nowrap text-lg font-extrabold text-kp-red">{ars.format(totalValor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Nota de resultados: cuántos se muestran y cómo ver el resto */}
      <p className="text-xs text-kp-gray text-center">
        {q
          ? `Mostrando ${filasVisibles.length} de ${filas.length} artículo(s) que coinciden con la búsqueda.`
          : ocultas > 0
            ? `Mostrando ${filasVisibles.length} de ${filas.length} artículos. Usá el buscador para encontrar el resto.`
            : `Mostrando ${filasVisibles.length} artículo(s).`}
      </p>
    </div>
  );
}
