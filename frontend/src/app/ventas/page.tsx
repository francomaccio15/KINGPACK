import { Suspense } from 'react';
import FiltrosVentas from './FiltrosVentas';
import NuevaVenta from './NuevaVenta';
import VentasTable from './VentasTable';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import PageHeader from '@/components/ui/PageHeader';

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
  medios_pago: string | null;
  vendedor_nombre: string | null;
  vendedor_rol: string | null;
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

// Fecha de hoy (zona horaria Argentina) en formato YYYY-MM-DD
function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string };
}) {
  const user = requireAuth('/ventas');

  // Filtros explícitos que el usuario haya seteado
  const hayFiltros = !!(searchParams.q || searchParams.estado || searchParams.fecha_desde || searchParams.fecha_hasta);

  const hoy = hoyISO();
  // Por defecto (sin ningún filtro) mostramos solo las ventas del día
  const effectiveParams = hayFiltros
    ? searchParams
    : { ...searchParams, fecha_desde: hoy, fecha_hasta: hoy };

  const { ventas, count, sucursales: todasSucursales, listas } = await fetchData(effectiveParams);

  const esCajero = user.rol === 'cajero';
  const sucursalId = user.sucursal_default_id ?? null;

  // Cajero sin sucursal asignada
  if (esCajero && !sucursalId) {
    return (
      <section className="space-y-5">
        <PageHeader title="Ventas" />
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 md:p-6 text-sm text-yellow-400">
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
      <PageHeader
        title="Ventas"
        subtitle={
          <>
            {count} {count === 1 ? 'registro' : 'registros'}
            {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
          </>
        }
        action={<NuevaVenta sucursales={sucursales} listas={listas} />}
      />

      {/* Filtros */}
      <Suspense>
        <FiltrosVentas hoy={hoy} />
      </Suspense>

      {/* Tabla con detalle expandible */}
      <VentasTable ventas={ventas} hayFiltros={hayFiltros} />

    </section>
  );
}
