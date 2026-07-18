import { Suspense } from 'react';
import Link from 'next/link';
import NuevoEmpleado from './NuevoEmpleado';
import EmpleadosFiltros from './EmpleadosFiltros';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export type Empleado = {
  id: string;
  dni: string | null;
  nombre: string;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  fecha_ingreso: string | null;
  salario: string | null;
  activo: boolean;
  sucursal_id: string;
  sucursal_nombre: string | null;
  created_at: string;
};

export type Sucursal = { id: string; nombre: string };

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3,
});

async function fetchData(q?: string, activo?: string, sucursal_id?: string) {
  const params = new URLSearchParams({ limit: '500' });
  if (q)           params.set('q', q);
  if (activo)      params.set('activo', activo);
  if (sucursal_id) params.set('sucursal_id', sucursal_id);

  const [empleados, sucursales] = await Promise.all([
    serverFetch(`/api/empleados?${params}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => (d.empleados ?? []) as Empleado[]).catch(() => [] as Empleado[]),
    serverFetch('/api/sucursales', { cache: 'no-store' })
      .then(r => r.json()).then(d => (d.sucursales ?? []) as Sucursal[]).catch(() => [] as Sucursal[]),
  ]);
  return { empleados, sucursales };
}

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: { q?: string; activo?: string; sucursal_id?: string };
}) {
  const user    = requireAuth('/empleados');
  const esAdmin = user.rol === 'administrador';

  const { empleados, sucursales } = await fetchData(
    searchParams.q,
    searchParams.activo,
    searchParams.sucursal_id,
  );

  const hayFiltros = !!(searchParams.q || searchParams.activo || searchParams.sucursal_id);

  const activos   = empleados.filter(e => e.activo).length;
  const inactivos = empleados.filter(e => !e.activo).length;

  return (
    <section className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Empleados</h2>
          </div>
          <div className="flex items-center gap-3 pl-3 flex-wrap">
            <p className="text-sm text-kp-gray">
              {empleados.length} {empleados.length === 1 ? 'empleado' : 'empleados'}
              {hayFiltros && <span className="ml-1 text-kp-gray/60">(filtrado)</span>}
            </p>
            {!hayFiltros && (
              <>
                <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 rounded px-2 py-0.5">
                  {activos} activos
                </span>
                {inactivos > 0 && (
                  <span className="text-xs bg-kp-surface2 border border-kp-border text-kp-gray rounded px-2 py-0.5">
                    {inactivos} inactivos
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {esAdmin && (
          <NuevoEmpleado sucursales={sucursales} />
        )}
      </div>

      {/* ── Filtros ── */}
      <Suspense>
        <EmpleadosFiltros sucursales={sucursales} esAdmin={esAdmin} />
      </Suspense>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">DNI</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cargo</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Sucursal</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold hidden md:table-cell">Teléfono</th>
              {esAdmin && (
                <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap hidden lg:table-cell">
                  Salario
                </th>
              )}
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold hidden md:table-cell">
                Ingreso
              </th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {empleados.map(e => (
              <tr key={e.id} className="hover:bg-kp-surface2 transition-colors group">
                <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors whitespace-nowrap">
                  {e.nombre}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">
                  {e.dni || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-kp-gray-lt">
                  {e.cargo
                    ? <span className="bg-kp-surface2 border border-kp-border rounded px-2 py-0.5">{e.cargo}</span>
                    : <span className="text-kp-border">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">
                  {e.sucursal_nombre || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-kp-gray hidden md:table-cell whitespace-nowrap">
                  {e.telefono || '—'}
                </td>
                {esAdmin && (
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-kp-gray-lt hidden lg:table-cell whitespace-nowrap">
                    {e.salario ? ars.format(parseFloat(e.salario)) : '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-xs text-kp-gray hidden md:table-cell whitespace-nowrap">
                  {e.fecha_ingreso
                    ? new Date(e.fecha_ingreso).toLocaleDateString('es-AR')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {e.activo
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Activo
                      </span>
                    : <span className="inline-flex items-center gap-1 text-xs font-medium text-kp-gray">
                        <span className="w-1.5 h-1.5 rounded-full bg-kp-border" />Inactivo
                      </span>}
                </td>
                <td className="px-3 py-3 text-center">
                  <Link
                    href={`/empleados/${e.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1
                      text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent
                      hover:border-kp-border hover:bg-kp-surface2"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}

            {empleados.length === 0 && (
              <tr>
                <td
                  colSpan={esAdmin ? 9 : 8}
                  className="px-4 py-14 text-center text-kp-gray"
                >
                  <p className="text-3xl mb-2">👥</p>
                  {hayFiltros
                    ? 'No hay empleados que coincidan con los filtros.'
                    : 'No hay empleados cargados todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
