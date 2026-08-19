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

/**
 * Stock Valorizado — cuánto le costó a King Pack tener el inventario en depósito.
 * Para cada artículo muestra el costo base, el flete, el stock de cada sucursal y
 * el valor del stock = costo unitario (base + flete) × cantidad total. Al final,
 * el total valorizado de todo el inventario. Solo visible para administradores.
 */
export default function StockValorizado({
  articulos, sucursales,
}: {
  articulos: ArticuloVal[];
  sucursales: { id: string; nombre: string }[];
}) {
  // Orden estable de columnas de sucursal según las sucursales activas.
  const nombresSuc = sucursales.map(s => s.nombre);

  const cantEnSuc = (a: ArticuloVal, nombre: string): number => {
    const sd = a.stock_detalle?.find(d => d.nombre === nombre);
    return sd ? Number(sd.cantidad) : 0;
  };

  const filas = articulos.map(a => {
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
  });

  const totalValor  = filas.reduce((acc, f) => acc + f.valor, 0);
  const totalUnid   = filas.reduce((acc, f) => acc + f.stockTotal, 0);
  // Totales por sucursal (unidades y valor) para el resumen y el pie de tabla.
  const totalValorSuc = Object.fromEntries(
    nombresSuc.map(n => [n, filas.reduce((acc, f) => acc + f.valorPorSuc[n], 0)])
  ) as Record<string, number>;
  const totalUnidSuc = Object.fromEntries(
    nombresSuc.map(n => [n, filas.reduce((acc, f) => acc + cantEnSuc(f.a, n), 0)])
  ) as Record<string, number>;

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
            ) : filas.map(({ a, costoBase, fletePct, costoUnit, stockTotal, valor, valorPorSuc }) => (
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
    </div>
  );
}
