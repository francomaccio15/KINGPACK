import { Suspense } from 'react';
import NuevoPresupuesto from './NuevoPresupuesto';
import PresupuestosTable from './PresupuestosTable';
import FiltrosPresupuestos from './FiltrosPresupuestos';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

type Presupuesto = {
  id: string;
  numero: number;
  fecha: string;
  estado: 'preventa' | 'confirmada' | 'facturada' | 'anulada';
  total: string;
  subtotal: string;
  descuento_total: string;
  cliente_nombre: string | null;
  sucursal_nombre: string | null;
  lista_precio: string | null;
  vendedor_nombre: string | null;
  items_count: number;
};

async function fetchData(params: Record<string, string | undefined>, soloMias: boolean) {
  const q = new URLSearchParams();
  if (params.q)           q.set('q', params.q);
  if (params.fecha_desde) q.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) q.set('fecha_hasta', params.fecha_hasta);
  // Un presupuesto es una venta en estado "preventa".
  q.set('estado', 'preventa');
  if (soloMias) q.set('mias', '1');
  q.set('limit', '100');

  const [ventasRes, sucursalesRes, listasRes] = await Promise.all([
    serverFetch(`/api/ventas?${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ventas: [], count: 0 })),
    serverFetch('/api/sucursales',  { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch('/api/listas-precios', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ listas: [] })),
  ]);

  const rawListas = listasRes.listas ?? [];
  return {
    presupuestos: (ventasRes.ventas ?? []) as Presupuesto[],
    count:        ventasRes.count ?? 0,
    sucursales:   sucursalesRes.sucursales ?? [],
    listas:       rawListas.map((l: any) => ({
      id: l.id,
      nombre: l.nombre,
      descuento_lista: parseFloat(l.descuento_base_pct) || 0,
    })),
  };
}

export const dynamic = 'force-dynamic';

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: { q?: string; fecha_desde?: string; fecha_hasta?: string };
}) {
  const user = requireAuth('/presupuestos');
  const esRepartidor = user.rol === 'vendedor';

  const { presupuestos, count, sucursales: todasSucursales, listas } =
    await fetchData(searchParams, esRepartidor);

  const hayFiltros = !!(searchParams.q || searchParams.fecha_desde || searchParams.fecha_hasta);

  // El repartidor con sucursal asignada arranca con esa preseleccionada.
  const sucursalDefault = user.sucursal_default_id ?? null;

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Presupuestos</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {esRepartidor ? 'Tus presupuestos' : 'Presupuestos pendientes de confirmar'}
            {' · '}
            {count} {count === 1 ? 'registro' : 'registros'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </p>
        </div>

        {/* Solo el repartidor (y el staff) puede crear presupuestos */}
        <NuevoPresupuesto
          sucursales={todasSucursales}
          listas={listas}
          sucursalDefaultId={sucursalDefault}
        />
      </div>

      {/* Filtros: búsqueda + rango de fechas */}
      <Suspense>
        <FiltrosPresupuestos />
      </Suspense>

      {/* Tabla de presupuestos */}
      <PresupuestosTable
        presupuestos={presupuestos}
        hayFiltros={hayFiltros}
        esRepartidor={esRepartidor}
      />

    </section>
  );
}
