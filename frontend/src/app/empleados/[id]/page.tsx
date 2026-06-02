import Link from 'next/link';
import EditarEmpleado from './EditarEmpleado';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
});

export default async function EmpleadoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const user    = requireAuth('/empleados');
  const esAdmin = user.rol === 'administrador';

  const [empRes, sucRes] = await Promise.all([
    serverFetch(`/api/empleados/${params.id}`, { cache: 'no-store' }),
    serverFetch('/api/sucursales',             { cache: 'no-store' }),
  ]);

  if (!empRes.ok) {
    return (
      <div className="rounded-xl bg-kp-surface border border-kp-red/40 p-6 space-y-2">
        <p className="text-kp-red font-bold">Empleado no encontrado</p>
        <Link href="/empleados" className="text-sm text-kp-gray hover:text-kp-white">
          ← Volver a Empleados
        </Link>
      </div>
    );
  }

  const { empleado }   = await empRes.json();
  const sucursales     = sucRes.ok ? (await sucRes.json()).sucursales ?? [] : [];

  const INFO = [
    { label: 'DNI',          value: empleado.dni },
    { label: 'Cargo',        value: empleado.cargo },
    { label: 'Email',        value: empleado.email },
    { label: 'Teléfono',     value: empleado.telefono },
    { label: 'Sucursal',     value: empleado.sucursal_nombre },
    {
      label: 'Fecha de ingreso',
      value: empleado.fecha_ingreso
        ? new Date(empleado.fecha_ingreso).toLocaleDateString('es-AR')
        : null,
    },
    {
      label: 'Alta en sistema',
      value: new Date(empleado.created_at).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }),
    },
  ];

  return (
    <section className="space-y-6">

      {/* Breadcrumb */}
      <Link href="/empleados" className="text-xs text-kp-gray hover:text-kp-white transition-colors">
        ← Empleados
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {/* Avatar inicial */}
            <span className="w-10 h-10 rounded-xl bg-kp-red/20 border border-kp-red/30 flex items-center justify-center text-base font-black text-kp-red">
              {empleado.nombre.charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold uppercase tracking-wide">{empleado.nombre}</h2>
                {!empleado.activo && (
                  <span className="text-xs bg-kp-surface2 border border-kp-border text-kp-gray rounded px-2 py-0.5">
                    Inactivo
                  </span>
                )}
              </div>
              {empleado.cargo && (
                <p className="text-sm text-kp-gray pl-0.5 mt-0.5">{empleado.cargo}</p>
              )}
            </div>
          </div>
        </div>

        {(esAdmin || user.rol === 'supervisor') && (
          <EditarEmpleado
            empleado={empleado}
            sucursales={sucursales}
            esAdmin={esAdmin}
          />
        )}
      </div>

      {/* Tarjeta salario — solo admin */}
      {esAdmin && empleado.salario && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-kp-surface border border-kp-border px-5 py-4">
            <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Salario mensual</p>
            <p className="text-xl font-bold tabular-nums text-kp-white">
              {ars.format(parseFloat(empleado.salario))}
            </p>
          </div>
          <div className="rounded-xl bg-kp-surface border border-kp-border px-5 py-4">
            <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Sucursal</p>
            <p className="text-xl font-bold text-kp-white">{empleado.sucursal_nombre || '—'}</p>
          </div>
        </div>
      )}

      {/* Info general */}
      <div className="rounded-xl bg-kp-surface border border-kp-border p-5">
        <h3 className="text-xs text-kp-gray uppercase tracking-widest mb-4">Información del empleado</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {INFO.map(row => (
            <div key={row.label}>
              <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-0.5">{row.label}</p>
              <p className="text-kp-gray-lt">{row.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
