import { Suspense } from 'react';
import Link from 'next/link';
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
  despacho_pendiente?: boolean;
  despachada_at?: string | null;
};

// pendientes → presupuestos sin confirmar (todos).
// despachar  → staff: ventas que confirmó un preventista y faltan enviar.
// confirmados → preventista: sus ventas ya confirmadas (cta. cte.).
type Vista = 'pendientes' | 'despachar' | 'confirmados';

async function fetchData(params: Record<string, string | undefined>, soloMias: boolean, vista: Vista) {
  const q = new URLSearchParams();
  if (params.q)           q.set('q', params.q);
  if (params.fecha_desde) q.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) q.set('fecha_hasta', params.fecha_hasta);
  // Un presupuesto es una venta en estado "preventa".
  if (vista === 'pendientes') q.set('estado', 'preventa');
  if (vista === 'despachar') { q.set('estado', 'confirmada'); q.set('despacho_pendiente', '1'); }
  if (soloMias) q.set('mias', '1');
  q.set('limit', '100');

  const [ventasRes, sucursalesRes, listasRes] = await Promise.all([
    serverFetch(`/api/ventas?${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ventas: [], count: 0 })),
    serverFetch('/api/sucursales',  { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch('/api/listas-precios', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ listas: [] })),
  ]);

  const rawListas = listasRes.listas ?? [];
  return {
    // "confirmados" trae todas las del preventista y se queda con las que ya
    // no son presupuesto (confirmada o facturada; anuladas afuera).
    presupuestos: ((ventasRes.ventas ?? []) as Presupuesto[]).filter(v =>
      vista !== 'confirmados' || (v.estado !== 'preventa' && v.estado !== 'anulada')),
    count:        vista === 'confirmados' ? undefined : (ventasRes.count ?? 0),
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
  searchParams: { q?: string; fecha_desde?: string; fecha_hasta?: string; vista?: string };
}) {
  const user = requireAuth('/presupuestos');
  const esRepartidor = user.rol === 'vendedor' || user.rol === 'comercial';

  const vistas: { id: Vista; label: string }[] = esRepartidor
    ? [{ id: 'pendientes', label: 'Presupuestos' }, { id: 'confirmados', label: 'Ventas confirmadas' }]
    : [{ id: 'pendientes', label: 'Presupuestos' }, { id: 'despachar', label: 'Para despachar' }];
  const vista: Vista = vistas.some(v => v.id === searchParams.vista)
    ? (searchParams.vista as Vista)
    : 'pendientes';

  const { presupuestos, count: countApi, sucursales: todasSucursales, listas } =
    await fetchData(searchParams, esRepartidor, vista);
  const count = countApi ?? presupuestos.length;

  const subtitulo = vista === 'despachar'
    ? 'Ventas de preventistas para enviar (cuenta corriente)'
    : vista === 'confirmados'
      ? 'Tus ventas confirmadas en cuenta corriente'
      : esRepartidor ? 'Tus presupuestos' : 'Presupuestos pendientes de confirmar';

  const hayFiltros = !!(searchParams.q || searchParams.fecha_desde || searchParams.fecha_hasta);

  // El repartidor con sucursal asignada arranca con esa preseleccionada.
  const sucursalDefault = user.sucursal_default_id ?? null;

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-5 md:h-6 bg-kp-red rounded-full block shrink-0" />
            <h2 className="text-lg md:text-2xl font-bold uppercase tracking-wide">Presupuestos</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {subtitulo}
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
          puedeConfirmarCC={esRepartidor}
        />
      </div>

      {/* Solapas */}
      <div className="flex gap-1 border-b border-kp-border overflow-x-auto">
        {vistas.map(v => (
          <Link
            key={v.id}
            href={v.id === 'pendientes' ? '/presupuestos' : `/presupuestos?vista=${v.id}`}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              vista === v.id
                ? 'border-kp-red text-kp-white'
                : 'border-transparent text-kp-gray hover:text-kp-white'
            }`}
          >
            {v.label}
          </Link>
        ))}
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
        vista={vista}
      />

    </section>
  );
}
