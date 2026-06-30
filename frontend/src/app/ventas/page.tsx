import { Suspense } from 'react';
import FiltrosVentas from './FiltrosVentas';
import NuevaVenta from './NuevaVenta';
import VentasTable from './VentasTable';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

type Venta = {
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
  cae: string | null;
  facturada_ok: boolean | null;
  items_count: number;
};


async function fetchData(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  if (params.q)           q.set('q', params.q);
  if (params.estado)      q.set('estado', params.estado);
  if (params.fecha_desde) q.set('fecha_desde', params.fecha_desde);
  if (params.fecha_hasta) q.set('fecha_hasta', params.fecha_hasta);
  q.set('limit', '100');

  const [ventasRes, sucursalesRes, listasRes] = await Promise.all([
    serverFetch(`/api/ventas?${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ventas: [], count: 0 })),
    serverFetch('/api/sucursales',  { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch('/api/listas-precios', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ listas: [] })),
  ]);

  const rawListas = listasRes.listas ?? [];
  return {
    ventas:     ventasRes.ventas ?? [],
    count:      ventasRes.count ?? 0,
    sucursales: sucursalesRes.sucursales ?? [],
    listas:     rawListas.map((l: any) => ({
      id: l.id,
      nombre: l.nombre,
      tipo: l.tipo,
      descuento_lista: parseFloat(l.descuento_base_pct) || 0,
    })),
  };
}

export const dynamic = 'force-dynamic';

export default async function VentasPage({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string };
}) {
  const user = requireAuth('/ventas');
  const { ventas, count, sucursales: todasSucursales, listas } = await fetchData(searchParams);
  const hayFiltros = !!(searchParams.q || searchParams.estado || searchParams.fecha_desde || searchParams.fecha_hasta);

  const esCajero = user.rol === 'cajero';
  const sucursalId = user.sucursal_default_id ?? null;

  // Cajero sin sucursal asignada
  if (esCajero && !sucursalId) {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Ventas</h2>
        </div>
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-sm text-yellow-400">
          No tenés sucursal asignada. Contactá al administrador para que configure tu sucursal de trabajo.
        </div>
      </section>
    );
  }

  // Para el cajero solo mostramos su sucursal en el selector de NuevaVenta
  const sucursales = esCajero
    ? todasSucursales.filter((s: { id: string }) => s.id === sucursalId)
    : todasSucursales;

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Ventas</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {count} {count === 1 ? 'registro' : 'registros'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </p>
        </div>
        <NuevaVenta sucursales={sucursales} listas={listas} />
      </div>

      {/* Filtros */}
      <Suspense>
        <FiltrosVentas />
      </Suspense>

      {/* Tabla con detalle expandible */}
      <VentasTable ventas={ventas} hayFiltros={hayFiltros} />

    </section>
  );
}
