import { Suspense } from 'react';
import Link from 'next/link';
import FiltrosArticulos from './FiltrosArticulos';
import TabsListas from './TabsListas';
import ExportarPDF from './ExportarPDF';
import NuevoArticulo from './NuevoArticulo';
import ArticulosTabla from './ArticulosTabla';
import RankingArticulos from './RankingArticulos';
import Paginador from './Paginador';
import VistaTabs from './VistaTabs';
import StockEditor from './StockEditor';
import { getSucursalActivaId } from '@/lib/getSucursalActiva';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

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
  alicuota_iva_id: string;
  alicuota_porcentaje: string;
  activo: boolean;
  categoria_id: string;
  categoria: string;
  stock_total: string;
  stock_bajo: boolean;
  stock_minimo: number;
  stock_detalle: StockDetalle[] | null;
};

type Lista     = { id: string; nombre: string; tipo: string; descuento_base_pct: string };
type Categoria = { id: string; nombre: string; margen_default: string };
type Sucursal  = { id: string; nombre: string };
type Alicuota  = { id: string; porcentaje: string; descripcion: string };

type RankingItem = {
  id: string; nombre: string; codigo: string; categoria: string;
  total_unidades: number; total_ingresos: number;
};
type RankingData = { mes: string; mas_vendidos: RankingItem[]; menos_vendidos: RankingItem[] };

// ─── Fetch helpers ───────────────────────────────────────────────────────────
async function fetchListas(): Promise<Lista[]> {
  try {
    const r = await serverFetch('/api/listas-precios', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).listas ?? [];
  } catch { return []; }
}

async function fetchCategorias(): Promise<Categoria[]> {
  try {
    const r = await serverFetch('/api/categorias', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).categorias ?? [];
  } catch { return []; }
}

async function fetchSucursales(): Promise<Sucursal[]> {
  try {
    const r = await serverFetch('/api/sucursales', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).sucursales ?? [];
  } catch { return []; }
}

async function fetchAlicuotas(): Promise<Alicuota[]> {
  try {
    const r = await serverFetch('/api/articulos/alicuotas', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).alicuotas ?? [];
  } catch { return []; }
}

async function fetchRanking(sucursal_id: string): Promise<RankingData | null> {
  try {
    const qs = new URLSearchParams({ limite: '10' });
    if (sucursal_id) qs.set('sucursal_id', sucursal_id);
    const r = await serverFetch(`/api/articulos/ranking?${qs}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function fetchStockBajoCount(sucursal_id: string): Promise<number> {
  try {
    const qs = new URLSearchParams({ stock_bajo: 'true', activo: 'true', limit: '1' });
    if (sucursal_id) qs.set('sucursal_id', sucursal_id);
    const r = await serverFetch(`/api/articulos?${qs}`, { cache: 'no-store' });
    if (!r.ok) return 0;
    return (await r.json()).count ?? 0;
  } catch { return 0; }
}

async function fetchArticulos(
  sp: Record<string, string>,
  sucursal_id: string,
  page: number,
): Promise<{ count: number; articulos: Articulo[] } | { error: string }> {
  const qs = new URLSearchParams();
  if (sp.q)             qs.set('q', sp.q);
  if (sp.categoria_id)  qs.set('categoria_id', sp.categoria_id);
  if (sp.lista_id)      qs.set('lista_id', sp.lista_id);
  if (sp.stock_bajo)    qs.set('stock_bajo', sp.stock_bajo);
  if (sucursal_id)      qs.set('sucursal_id', sucursal_id);
  qs.set('activo', sp.activo || 'true');
  qs.set('limit',  String(PAGE_SIZE));
  qs.set('offset', String((page - 1) * PAGE_SIZE));
  try {
    const r = await serverFetch(`/api/articulos?${qs}`, { cache: 'no-store' });
    if (!r.ok) return { error: `API respondió ${r.status}` };
    return r.json();
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'No se pudo conectar a la API' };
  }
}

// ─── Utils ───────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  madre:            'Precio Base',
  publica:          'Precio Público',
  revendedor:       'Lista Reventa',
  cuenta_corriente: 'Cuenta Corriente',
};

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 10;

// ─── Página ──────────────────────────────────────────────────────────────────
export default async function ArticulosPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const user = requireAuth('/articulos');
  // Cajero y repartidor (vendedor) ven artículos en modo solo-lectura:
  // sin alta, sin columna de precio base, sin acciones de edición.
  const esCajero = user.rol === 'cajero' || user.rol === 'vendedor';
  const esAdmin  = user.rol === 'administrador';
  const sucursalActivaId = getSucursalActivaId();

  const currentPage = Math.max(1, parseInt(searchParams.page || '1') || 1);

  const [listas, categorias, sucursales, alicuotas, stockBajoCount, ranking] = await Promise.all([
    fetchListas(),
    fetchCategorias(),
    fetchSucursales(),
    fetchAlicuotas(),
    fetchStockBajoCount(sucursalActivaId),
    esCajero ? Promise.resolve(null) : fetchRanking(sucursalActivaId),
  ]);

  const sucursalActiva = sucursales.find(s => s.id === sucursalActivaId) ?? null;

  // ── Vista Stock (sub-pestaña) — solo administrador / supervisor ──
  const puedeEditarStock = user.rol === 'administrador' || user.rol === 'supervisor';
  const vista = searchParams.vista === 'stock' && puedeEditarStock ? 'stock' : 'precios';

  if (vista === 'stock') {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Artículos</h2>
          {sucursalActiva && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest
              bg-kp-surface2 border border-kp-red/30 text-kp-red rounded px-2 py-0.5 ml-1">
              <span className="w-1 h-1 rounded-full bg-kp-red" />
              {sucursalActiva.nombre}
            </span>
          )}
        </div>
        <VistaTabs vista="stock" puedeEditarStock={puedeEditarStock} />
        <StockEditor sucursales={sucursales} sucursalActivaId={sucursalActivaId} />
      </section>
    );
  }

  const listaActivaId = searchParams.lista_id || listas[0]?.id || '';
  const listaActiva   = listas.find(l => l.id === listaActivaId) ?? listas[0];

  const data = await fetchArticulos({ ...searchParams, lista_id: listaActivaId }, sucursalActivaId, currentPage);

  const totalPages = 'error' in data ? 1 : Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  // Si la página pedida supera el total, clampeamos a la última
  const safePage = Math.min(currentPage, totalPages);

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
          <div className="flex items-center gap-3 pl-3 flex-wrap">
            <p className="text-sm text-kp-gray">
              {data.count} {data.count === 1 ? 'artículo' : 'artículos'}
              {searchParams.stock_bajo === 'true' && ' con stock bajo'}
              {searchParams.stock_bajo !== 'true' && (searchParams.activo || 'true') === 'true' && ' activos'}
              {searchParams.stock_bajo !== 'true' && (searchParams.activo || 'true') === 'false' && ' inactivos'}
            </p>
            {/* Acceso directo stock bajo — se oculta cuando ya está activo ese filtro */}
            {searchParams.stock_bajo !== 'true' && stockBajoCount > 0 && (
              <Link
                href={`/articulos?stock_bajo=true${listaActivaId ? `&lista_id=${listaActivaId}` : ''}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg
                  bg-amber-500/10 border border-amber-500/30 text-amber-400
                  hover:bg-amber-500/20 hover:border-amber-500/50 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {stockBajoCount} con stock bajo
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!esCajero && (
            <NuevoArticulo categorias={categorias} alicuotas={alicuotas} />
          )}
          {listaActiva && (
            <ExportarPDF lista={listaActiva} categorias={categorias} />
          )}
        </div>
      </div>

      {/* ── Conmutador de vista (Precios / Stock) ── */}
      <VistaTabs vista="precios" puedeEditarStock={puedeEditarStock} />

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
        <FiltrosArticulos categorias={categorias} stockBajoActivo={searchParams.stock_bajo === 'true'} />
      </Suspense>

      {/* ── Paginador superior ── */}
      {'error' in data ? null : (
        <Paginador
          page={safePage}
          totalPages={totalPages}
          count={data.count}
          pageSize={PAGE_SIZE}
          searchParams={{ ...searchParams, lista_id: listaActivaId }}
        />
      )}

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Código</th>
              <th className="text-left px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-left px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Categoría</th>
              <th className="text-right px-3 py-3 uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                <span className="text-kp-red">
                  {listaActiva ? (TIPO_LABEL[listaActiva.tipo] ?? listaActiva.nombre) : 'Precio'}
                </span>
                {descBase > 0 && (
                  <span className="block text-[10px] text-green-400 font-normal normal-case tracking-normal">
                    −{descBase.toFixed(1)}%
                  </span>
                )}
              </th>
              {!esBase && !esCajero && (
                <th className="text-right px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                  Precio Base
                </th>
              )}
              {esBase && esAdmin && (
                <th className="text-right px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                  Margen
                </th>
              )}
              <th className="text-center px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                {modeTodas ? 'Stock' : `Stock · ${sucursalActiva?.nombre ?? ''}`}
              </th>
              <th className="text-center px-3 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Estado</th>
              <th className="sticky right-0 z-20 bg-kp-surface2 border-l border-kp-border px-3 py-3 w-px" />
            </tr>
          </thead>

          <ArticulosTabla
            articulos={data.articulos}
            categorias={categorias}
            alicuotas={alicuotas}
            listaActiva={listaActiva ?? null}
            sucursalActiva={sucursalActiva}
            modeTodas={modeTodas}
            hasFilters={!!(searchParams.q || searchParams.categoria_id)}
            esCajero={esCajero}
            esAdmin={esAdmin}
          />
        </table>
      </div>

      {/* ── Paginador inferior ── */}
      {'error' in data ? null : (
        <Paginador
          page={safePage}
          totalPages={totalPages}
          count={data.count}
          pageSize={PAGE_SIZE}
          searchParams={{ ...searchParams, lista_id: listaActivaId }}
        />
      )}

      {/* ── Ranking de ventas del mes ── */}
      {!esCajero && ranking && (
        <RankingArticulos
          mes={ranking.mes}
          masVendidos={ranking.mas_vendidos}
          menosVendidos={ranking.menos_vendidos}
        />
      )}

    </section>
  );
}
