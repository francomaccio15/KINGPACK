import { Suspense } from 'react';
import FiltrosArticulos from './FiltrosArticulos';
import TabsListas from './TabsListas';
import ExportarPDF from './ExportarPDF';
import NuevoArticulo from './NuevoArticulo';
import EditarArticulo from './EditarArticulo';
import { getSucursalActivaId } from '@/lib/getSucursalActiva';

// ─── Tipos ───────────────────────────────────────────────────────────────────
type StockDetalle = { nombre: string; cantidad: number; stock_bajo: boolean };

type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  precio_madre: string;
  precio_lista: string;
  costo_base: string;
  costo_flete: string;
  margen_aplicado: string | null;
  activo: boolean;
  categoria_id: string;
  categoria: string;
  stock_total: string;
  stock_bajo: boolean;
  stock_detalle: StockDetalle[] | null;
};

type Lista     = { id: string; nombre: string; tipo: string; descuento_base_pct: string };
type Categoria = { id: string; nombre: string; margen_default: string };
type Sucursal  = { id: string; nombre: string };
type Alicuota  = { id: string; porcentaje: string; descripcion: string };

// ─── Fetch helpers ───────────────────────────────────────────────────────────
const API = process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchListas(): Promise<Lista[]> {
  try {
    const r = await fetch(`${API}/api/listas-precios`, { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).listas ?? [];
  } catch { return []; }
}

async function fetchCategorias(): Promise<Categoria[]> {
  try {
    const r = await fetch(`${API}/api/categorias`, { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).categorias ?? [];
  } catch { return []; }
}

async function fetchSucursales(): Promise<Sucursal[]> {
  try {
    const r = await fetch(`${API}/api/sucursales`, { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).sucursales ?? [];
  } catch { return []; }
}

async function fetchAlicuotas(): Promise<Alicuota[]> {
  try {
    const r = await fetch(`${API}/api/articulos/alicuotas`, { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).alicuotas ?? [];
  } catch { return []; }
}

async function fetchArticulos(
  sp: Record<string, string>,
  sucursal_id: string,
): Promise<{ count: number; articulos: Articulo[] } | { error: string }> {
  const qs = new URLSearchParams();
  if (sp.q)            qs.set('q', sp.q);
  if (sp.categoria_id) qs.set('categoria_id', sp.categoria_id);
  if (sp.lista_id)     qs.set('lista_id', sp.lista_id);
  if (sucursal_id)     qs.set('sucursal_id', sucursal_id);
  qs.set('activo', sp.activo || 'true');
  try {
    const r = await fetch(`${API}/api/articulos?${qs}`, { cache: 'no-store' });
    if (!r.ok) return { error: `API respondió ${r.status}` };
    return r.json();
  } catch (e: any) {
    return { error: e.message || 'No se pudo conectar a la API' };
  }
}

// ─── Utils ───────────────────────────────────────────────────────────────────
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null | undefined) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const TIPO_LABEL: Record<string, string> = {
  madre:            'Precio Base',
  publica:          'Precio Público',
  revendedor:       'Lista Reventa',
  cuenta_corriente: 'Cuenta Corriente',
};

export const dynamic = 'force-dynamic';

// ─── Página ──────────────────────────────────────────────────────────────────
export default async function ArticulosPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const sucursalActivaId = getSucursalActivaId();

  const [listas, categorias, sucursales, alicuotas] = await Promise.all([
    fetchListas(),
    fetchCategorias(),
    fetchSucursales(),
    fetchAlicuotas(),
  ]);

  const sucursalActiva = sucursales.find(s => s.id === sucursalActivaId) ?? null;

  const listaActivaId = searchParams.lista_id || listas[0]?.id || '';
  const listaActiva   = listas.find(l => l.id === listaActivaId) ?? listas[0];

  const data = await fetchArticulos({ ...searchParams, lista_id: listaActivaId }, sucursalActivaId);

  const esBase   = listaActiva?.tipo === 'madre';
  const descBase = listaActiva ? parseFloat(listaActiva.descuento_base_pct) : 0;

  // Columnas de stock
  const modeTodas = !sucursalActivaId;

  if ('error' in data) {
    return (
      <div className="rounded-xl bg-kp-surface border border-kp-red/40 p-6">
        <h2 className="font-bold text-kp-red uppercase tracking-wide text-sm mb-2">Error al cargar artículos</h2>
        <p className="text-sm text-kp-gray-lt">{data.error}</p>
      </div>
    );
  }

  return (
    <section className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Artículos</h2>

            {/* Badge de sucursal activa */}
            {sucursalActiva && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest
                bg-kp-surface2 border border-kp-red/30 text-kp-red rounded px-2 py-0.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-kp-red" />
                {sucursalActiva.nombre}
              </span>
            )}
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {data.count} {data.count === 1 ? 'registro' : 'registros'}
            {(searchParams.activo || 'true') === 'true' && ' activos'}
            {(searchParams.activo || 'true') === 'false' && ' inactivos'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NuevoArticulo categorias={categorias} alicuotas={alicuotas} />
          {listaActiva && (
            <ExportarPDF lista={listaActiva} categorias={categorias} />
          )}
        </div>
      </div>

      {/* ── Tabs por lista ── */}
      <Suspense fallback={null}>
        <TabsListas listas={listas} listaActivaId={listaActivaId} />
      </Suspense>

      {/* ── Info de la lista activa ── */}
      {listaActiva && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-kp-gray">
            {TIPO_LABEL[listaActiva.tipo] ?? listaActiva.nombre}
          </span>
          {descBase > 0 ? (
            <span className="text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-green-400">
              −{descBase.toFixed(1)}% sobre precio base
            </span>
          ) : !esBase ? (
            <span className="text-xs text-kp-gray">Sin descuento aplicado</span>
          ) : null}
        </div>
      )}

      {/* ── Filtros ── */}
      <Suspense fallback={<div className="h-10 bg-kp-surface rounded-lg animate-pulse" />}>
        <FiltrosArticulos categorias={categorias} />
      </Suspense>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Código</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Categoría</th>
              <th className="text-right px-4 py-3 uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                <span className="text-kp-red">
                  {listaActiva ? (TIPO_LABEL[listaActiva.tipo] ?? listaActiva.nombre) : 'Precio'}
                </span>
                {descBase > 0 && (
                  <span className="block text-[10px] text-green-400 font-normal normal-case tracking-normal">
                    −{descBase.toFixed(1)}%
                  </span>
                )}
              </th>
              {!esBase && (
                <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                  Precio Base
                </th>
              )}
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                {modeTodas ? 'Stock' : `Stock · ${sucursalActiva?.nombre ?? ''}`}
              </th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>

          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {data.articulos.map(a => {
              const stock  = parseFloat(a.stock_total || '0');
              const pLista = parseFloat(a.precio_lista || '0');
              const pMadre = parseFloat(a.precio_madre || '0');
              const diffPct = !esBase && pMadre > 0
                ? ((pLista - pMadre) / pMadre) * 100
                : null;

              return (
                <tr key={a.id} className="hover:bg-kp-surface2 transition-colors duration-100 group">

                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">{a.codigo}</td>

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
                      /* Modo Todas — breakdown por sucursal */
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
                      /* Modo sucursal específica — un solo número */
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
                    <EditarArticulo articulo={a} categorias={categorias} alicuotas={alicuotas} />
                  </td>
                </tr>
              );
            })}

            {data.articulos.length === 0 && (
              <tr>
                <td colSpan={esBase ? 6 : 7} className="px-4 py-12 text-center text-kp-gray">
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
