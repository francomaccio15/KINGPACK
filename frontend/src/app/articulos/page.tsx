import { Suspense } from 'react';
import FiltrosArticulos from './FiltrosArticulos';
import ExportarPDF from './ExportarPDF';

// ─── Tipos ───────────────────────────────────────────────────────────────────
type PrecioLista = {
  lista_id: string;
  nombre: string;
  tipo: string;
  precio: string;
};

type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  precio_madre: string;
  activo: boolean;
  categoria_id: string;
  categoria: string;
  stock_total: string;
  stock_bajo: boolean;
  precios_lista: PrecioLista[];
};

type Lista = {
  id: string;
  nombre: string;
  tipo: string;
  descuento_base_pct: string;
};

type Categoria = { id: string; nombre: string; margen_default: string };

// ─── Fetch helpers ───────────────────────────────────────────────────────────
const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchArticulos(sp: Record<string, string>): Promise<{ count: number; articulos: Articulo[] } | { error: string }> {
  const qs = new URLSearchParams();
  if (sp.q)            qs.set('q', sp.q);
  if (sp.categoria_id) qs.set('categoria_id', sp.categoria_id);
  qs.set('activo', sp.activo || 'true');
  try {
    const r = await fetch(`${API}/api/articulos?${qs}`, { cache: 'no-store' });
    if (!r.ok) return { error: `API respondió ${r.status}` };
    return r.json();
  } catch (e: any) {
    return { error: e.message || 'No se pudo conectar a la API' };
  }
}

async function fetchListas(): Promise<Lista[]> {
  try {
    const r = await fetch(`${API}/api/listas-precios`, { cache: 'no-store' });
    if (!r.ok) return [];
    const d = await r.json();
    return d.listas ?? [];
  } catch { return []; }
}

async function fetchCategorias(): Promise<Categoria[]> {
  try {
    const r = await fetch(`${API}/api/categorias`, { cache: 'no-store' });
    if (!r.ok) return [];
    const d = await r.json();
    return d.categorias ?? [];
  } catch { return []; }
}

// ─── Helpers de formato ──────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | undefined | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const TIPO_LABEL: Record<string, string> = {
  madre:            'Base',
  publica:          'Público',
  revendedor:       'Reventa',
  cuenta_corriente: 'Cta. Cte.',
};

// ─── Página ──────────────────────────────────────────────────────────────────
export const dynamic = 'force-dynamic';

export default async function ArticulosPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const [data, listas, categorias] = await Promise.all([
    fetchArticulos(searchParams),
    fetchListas(),
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
            {listas.length > 0 && (
              <span className="ml-2 text-kp-border">·</span>
            )}
            {listas.map(l => (
              <span key={l.id} className="ml-2 inline-block text-xs bg-kp-surface2 border border-kp-border rounded px-1.5 py-0.5 text-kp-gray">
                {TIPO_LABEL[l.tipo] ?? l.nombre}
              </span>
            ))}
          </p>
        </div>
        <ExportarPDF listas={listas} categorias={categorias} />
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
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                Código
              </th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">
                Nombre
              </th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                Categoría
              </th>

              {/* Columna dinámica por lista */}
              {listas.map(l => (
                <th key={l.id} className="text-right px-4 py-3 uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                  <span className={l.tipo === 'madre' ? 'text-kp-red' : 'text-kp-gray'}>
                    {TIPO_LABEL[l.tipo] ?? l.nombre}
                  </span>
                  {parseFloat(l.descuento_base_pct) > 0 && (
                    <span className="block text-[10px] text-kp-gray font-normal normal-case tracking-normal">
                      −{parseFloat(l.descuento_base_pct).toFixed(0)}%
                    </span>
                  )}
                </th>
              ))}

              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                Stock
              </th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                Estado
              </th>
            </tr>
          </thead>

          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {data.articulos.map(a => {
              const stock = parseFloat(a.stock_total || '0');

              // Mapa de precios por lista_id para acceso rápido
              const preciosMap = Object.fromEntries(
                (a.precios_lista ?? []).map(p => [p.lista_id, p.precio])
              );

              return (
                <tr key={a.id} className="hover:bg-kp-surface2 transition-colors duration-100 group">

                  {/* Código */}
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">
                    {a.codigo}
                  </td>

                  {/* Nombre */}
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors duration-100">
                    {a.nombre}
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-block text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray-lt">
                      {a.categoria || '—'}
                    </span>
                  </td>

                  {/* Precio por lista */}
                  {listas.map((l, i) => {
                    const p = preciosMap[l.id];
                    const esMadre = l.tipo === 'madre';
                    return (
                      <td key={l.id} className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className={`text-sm font-${esMadre ? 'bold' : 'medium'} ${esMadre ? 'text-kp-white' : 'text-kp-gray-lt'}`}>
                          {p ? fmt(p) : '—'}
                        </span>
                        {/* Diferencia respecto al precio madre si no es la lista madre */}
                        {!esMadre && p && a.precio_madre && (
                          (() => {
                            const diff = ((parseFloat(p) - parseFloat(a.precio_madre)) / parseFloat(a.precio_madre)) * 100;
                            if (Math.abs(diff) < 0.01) return null;
                            return (
                              <span className={`block text-[10px] ${diff < 0 ? 'text-green-500' : 'text-amber-400'}`}>
                                {diff < 0 ? '−' : '+'}{Math.abs(diff).toFixed(1)}%
                              </span>
                            );
                          })()
                        )}
                      </td>
                    );
                  })}

                  {/* Stock */}
                  <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap">
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
                  <td className="px-4 py-3 text-center whitespace-nowrap">
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
                <td colSpan={4 + listas.length} className="px-4 py-12 text-center text-kp-gray">
                  {searchParams.q || searchParams.categoria_id
                    ? 'No se encontraron artículos con esos filtros.'
                    : 'No hay artículos cargados todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
