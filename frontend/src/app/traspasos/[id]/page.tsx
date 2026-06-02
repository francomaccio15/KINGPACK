import Link from 'next/link';
import AccionesTraspaso from '../AccionesTraspaso';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

const ESTADO_STYLE: Record<string, string> = {
  pendiente:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  en_transito: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  recibido:    'bg-green-500/10 text-green-400 border-green-500/30',
  cancelado:   'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:   'Pendiente',
  en_transito: 'En tránsito',
  recibido:    'Recibido',
  cancelado:   'Cancelado',
};

export const dynamic = 'force-dynamic';

export default async function DetalleTraspasoPage({ params }: { params: { id: string } }) {
  const user = requireAuth('/traspasos');
  const esAdmin = user.rol === 'administrador';
  const esSupervisor = user.rol === 'supervisor';
  const puedeAccionar = esAdmin || esSupervisor;

  let traspaso: any = null;
  let items: any[] = [];

  try {
    const res = await serverFetch(`/api/traspasos/${params.id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      traspaso = data.traspaso;
      items    = data.items ?? [];
    }
  } catch { /* handled below */ }

  if (!traspaso) {
    return (
      <section className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-kp-gray text-lg">Traspaso no encontrado.</p>
        <Link href="/traspasos" className="text-kp-red hover:underline text-sm">← Volver a Traspasos</Link>
      </section>
    );
  }

  const fechaCreacion = new Date(traspaso.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const totalUnidades = items.reduce((s: number, i: any) => s + parseFloat(i.cantidad ?? 0), 0);

  return (
    <section className="space-y-6 max-w-4xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-kp-gray">
        <Link href="/traspasos" className="hover:text-kp-white transition-colors">Traspasos</Link>
        <span>/</span>
        <span className="text-kp-white">{traspaso.sucursal_origen_nombre} → {traspaso.sucursal_destino_nombre}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold">
              {traspaso.sucursal_origen_nombre}
              <span className="text-kp-gray mx-2">→</span>
              {traspaso.sucursal_destino_nombre}
            </h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[traspaso.estado] ?? ''}`}>
              {ESTADO_LABEL[traspaso.estado] ?? traspaso.estado}
            </span>
          </div>
          <p className="text-sm text-kp-gray pl-3">Creado: {fechaCreacion}{traspaso.usuario_nombre ? ` · por ${traspaso.usuario_nombre}` : ''}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Artículos</p>
          <p className="text-lg font-bold tabular-nums text-kp-white">{items.length}</p>
        </div>
        <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4">
          <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Unidades</p>
          <p className="text-lg font-bold tabular-nums text-kp-white">{totalUnidades}</p>
        </div>
        {traspaso.fecha_envio && (
          <div className="bg-kp-surface2 border border-blue-500/20 rounded-xl p-4">
            <p className="text-xs text-blue-400/70 uppercase tracking-widest font-semibold mb-1">Enviado</p>
            <p className="text-sm font-semibold text-kp-white">
              {new Date(traspaso.fecha_envio).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        )}
        {traspaso.fecha_recepcion && (
          <div className="bg-kp-surface2 border border-green-500/20 rounded-xl p-4">
            <p className="text-xs text-green-400/70 uppercase tracking-widest font-semibold mb-1">Recibido</p>
            <p className="text-sm font-semibold text-kp-white">
              {new Date(traspaso.fecha_recepcion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {/* Notas */}
      {traspaso.notas && (
        <div className="rounded-xl border border-kp-border bg-kp-surface2 px-4 py-3">
          <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Notas</p>
          <p className="text-sm text-kp-white">{traspaso.notas}</p>
        </div>
      )}

      {/* Acciones (solo admin/supervisor y si no está cerrado) */}
      {puedeAccionar && (
        <AccionesTraspaso traspasoId={traspaso.id} estado={traspaso.estado} />
      )}

      {/* Tabla de items */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">
            Artículos incluidos
          </h3>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2/50 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Código</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Cantidad</th>
              {esAdmin && (
                <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Stock en Origen</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {items.map((item: any) => (
              <tr key={item.articulo_id} className="hover:bg-kp-surface2 transition-colors">
                <td className="px-4 py-3 font-medium text-kp-white">{item.articulo_nombre}</td>
                <td className="px-4 py-3 text-xs text-kp-gray font-mono">{item.articulo_codigo}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-kp-white">{item.cantidad}</td>
                {esAdmin && (
                  <td className={`px-4 py-3 text-right tabular-nums text-sm ${
                    parseFloat(item.stock_origen) < parseFloat(item.cantidad)
                      ? 'text-kp-red font-semibold'
                      : 'text-kp-gray-lt'
                  }`}>
                    {parseFloat(item.stock_origen ?? 0).toFixed(0)}
                    {parseFloat(item.stock_origen) < parseFloat(item.cantidad) && (
                      <span className="ml-1 text-xs text-kp-red/70">(insuficiente)</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-kp-gray text-sm">
                  Sin artículos.
                </td>
              </tr>
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-kp-surface2 border-t border-kp-border">
                <td colSpan={2} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-kp-gray">Total</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">{totalUnidades}</td>
                {esAdmin && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

    </section>
  );
}
