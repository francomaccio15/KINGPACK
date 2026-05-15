import { Suspense } from 'react';
import FiltrosArticulos from './FiltrosArticulos';
import ExportarPDF from './ExportarPDF';

type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  costo_base: string;
  costo_flete: string;
  margen_aplicado: string | null;
  precio_madre: string;
  activo: boolean;
  categoria_id: string;
  categoria: string;
  margen_default: string;
  iva_pct: string;
  stock_total: string;
  stock_bajo: boolean;
};

type Categoria = { id: string; nombre: string; margen_default: string };

type ArticulosResponse = { count: number; articulos: Articulo[] };
type CategoriasResponse = { categorias: Categoria[] };

const API_INT = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchArticulos(sp: Record<string, string>): Promise<ArticulosResponse | { error: string }> {
  const qs = new URLSearchParams();
  if (sp.q)            qs.set('q', sp.q);
  if (sp.categoria_id) qs.set('categoria_id', sp.categoria_id);
  if (sp.activo)       qs.set('activo', sp.activo);
  try {
    const r = await fetch(`${API_INT}/api/articulos?${qs}`, { cache: 'no-store' });
    if (!r.ok) return { error: `API respondió ${r.status}` };
    return r.json();
  } catch (e: any) {
    return { error: e.message || 'No se pudo conectar a la API' };
  }
}

async function fetchCategorias(): Promise<Categoria[]> {
  try {
    const r = await fetch(`${API_INT}/api/categorias`, { cache: 'no-store' });
    if (!r.ok) return [];
    const data: CategoriasResponse = await r.json();
    return data.categorias;
  } catch {
    return [];
  }
}

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const dynamic = 'force-dynamic';

export default async function ArticulosPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const [data, categorias] = await Promise.all([
    fetchArticulos(searchParams),
    fetchCategorias(),
  ]);

  if ('error' in data) {
    return (
      <div className="rounded-xl bg-kp-surface border border-kp-red/40 p-6">
        <h2 className="font-bold text-kp-red uppercase tracking-wide text-sm mb-2">
          Error al cargar artículos
        </h2>
        <p className="text-sm text-kp-gray-lt">{data.error}</p>
        <p className="text-xs mt-2 text-kp-gray">
          Verificá <code className="bg-kp-surface2 px-1 rounded">NEXT_PUBLIC_API_URL</code> y que el backend esté corriendo.
        </p>
      </div>
    );
  }

  const activo = searchParams.activo || 'true';

  return (
    <section className="space-y-5">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Artículos</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {data.count} {data.count === 1 ? 'registro' : 'registros'}
            {activo === 'true' && ' activos'}
            {activo === 'false' && ' inactivos'}
          </p>
        </div>
        <ExportarPDF categorias={categorias} />
      </div>

      {/* ── Filtros ── */}
      <Suspense fallback={<div className="h-10 bg-kp-surface rounded-lg animate-pulse" />}>
        <FiltrosArticulos categorias={categorias} />
      </Suspense>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Código</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Categoría</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Costo</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Margen</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">IVA</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Precio Madre</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Stock</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {data.articulos.map(a => {
              const costo = parseFloat(a.costo_base || '0') + parseFloat(a.costo_flete || '0');
              const margen = a.margen_aplicado != null ? a.margen_aplicado : a.margen_default;
              const stock = parseFloat(a.stock_total || '0');

              return (
                <tr key={a.id} className="hover:bg-kp-surface2 transition-colors duration-100 group">
                  {/* Código */}
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray">
                    {a.codigo}
                  </td>
                  {/* Nombre */}
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors duration-100 max-w-56">
                    {a.nombre}
                  </td>
                  {/* Categoría */}
                  <td className="px-4 py-3">
                    <span className="inline-block text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray-lt">
                      {a.categoria || '—'}
                    </span>
                  </td>
                  {/* Costo */}
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray text-xs">
                    {costo > 0 ? ars.format(costo) : '—'}
                  </td>
                  {/* Margen */}
                  <td className="px-4 py-3 text-center text-xs tabular-nums">
                    <span className={`font-semibold ${a.margen_aplicado != null ? 'text-kp-red' : 'text-kp-gray'}`}>
                      {parseFloat(margen || '0').toFixed(1)}%
                    </span>
                    {a.margen_aplicado != null && (
                      <span className="text-kp-gray ml-1 text-[10px]">*</span>
                    )}
                  </td>
                  {/* IVA */}
                  <td className="px-4 py-3 text-center text-xs text-kp-gray tabular-nums">
                    {a.iva_pct ? `${parseFloat(a.iva_pct).toFixed(0)}%` : '—'}
                  </td>
                  {/* Precio Madre */}
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {ars.format(parseFloat(a.precio_madre))}
                  </td>
                  {/* Stock */}
                  <td className="px-4 py-3 text-center tabular-nums">
                    {stock > 0 ? (
                      <span className={`text-xs font-semibold ${a.stock_bajo ? 'text-amber-400' : 'text-kp-gray-lt'}`}>
                        {stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(1)}
                        {a.stock_bajo && (
                          <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" title="Stock bajo" />
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-kp-border">—</span>
                    )}
                  </td>
                  {/* Estado */}
                  <td className="px-4 py-3 text-center">
                    {a.activo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-red">
                        <span className="w-1.5 h-1.5 rounded-full bg-kp-red" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-gray">
                        <span className="w-1.5 h-1.5 rounded-full bg-kp-border" />
                        Inactivo
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {data.articulos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-kp-gray">
                  {searchParams.q || searchParams.categoria_id
                    ? 'No se encontraron artículos con esos filtros.'
                    : 'No hay artículos cargados todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Nota margen personalizado */}
      {data.articulos.some(a => a.margen_aplicado != null) && (
        <p className="text-xs text-kp-gray pl-1">
          <span className="text-kp-red mr-1">*</span>
          Margen personalizado (sobreescribe el margen de la categoría)
        </p>
      )}
    </section>
  );
}
