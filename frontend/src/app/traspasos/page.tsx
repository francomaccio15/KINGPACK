import Link from 'next/link';
import { Suspense } from 'react';
import NuevoTraspaso from './NuevoTraspaso';

import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';

type Traspaso = {
  id: string;
  estado: 'pendiente' | 'en_transito' | 'recibido' | 'cancelado';
  created_at: string;
  fecha_envio: string | null;
  fecha_recepcion: string | null;
  sucursal_origen_nombre: string;
  sucursal_destino_nombre: string;
  usuario_nombre: string | null;
  items_count: string | number;
  unidades_total: string | number;
};

type Sucursal = { id: string; nombre: string };
type Articulo = { id: string; nombre: string; codigo: string };

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

async function fetchData(sucursalId: string | null) {
  const q = new URLSearchParams();
  q.set('limit', '200');
  if (sucursalId) q.set('sucursal_id', sucursalId);

  const [traspasosRes, sucursalesRes, articulosRes] = await Promise.all([
    serverFetch(`/api/traspasos?${q}`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ traspasos: [], count: 0 })),
    serverFetch(`/api/sucursales`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ sucursales: [] })),
    serverFetch(`/api/articulos?limit=2000&activo=true`, { cache: 'no-store' })
      .then(r => r.json()).catch(() => ({ articulos: [] })),
  ]);

  return {
    traspasos:  traspasosRes.traspasos  ?? [],
    count:      traspasosRes.count      ?? 0,
    sucursales: sucursalesRes.sucursales ?? sucursalesRes ?? [],
    articulos:  articulosRes.articulos   ?? [],
  };
}

export const dynamic = 'force-dynamic';

export default async function TraspasosPage() {
  const user = requireAuth('/traspasos');
  const esCajero = user.rol === 'cajero';
  const sucursalId = esCajero ? (user.sucursal_default_id ?? null) : null;

  const { traspasos, count, sucursales, articulos } = await fetchData(sucursalId);

  const pendienteCount   = traspasos.filter((t: Traspaso) => t.estado === 'pendiente').length;
  const enTransitoCount  = traspasos.filter((t: Traspaso) => t.estado === 'en_transito').length;

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Traspasos de Stock</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {count} {count === 1 ? 'traspaso' : 'traspasos'}
            {esCajero && sucursales.length > 0 && (
              <span className="ml-1 text-kp-gray/60">— {sucursales.find((s: Sucursal) => s.id === sucursalId)?.nombre ?? ''}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(pendienteCount > 0 || enTransitoCount > 0) && (
            <div className="flex gap-2">
              {pendienteCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-400">{pendienteCount} pendiente{pendienteCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {enTransitoCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-xs font-semibold text-blue-400">{enTransitoCount} en tránsito</span>
                </div>
              )}
            </div>
          )}
          {!esCajero && (
            <NuevoTraspaso
              sucursales={sucursales}
              articulos={articulos}
              sucursalDefaultId={null}
            />
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Origen</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Destino</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Artículos</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Unidades</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {traspasos.map((t: Traspaso) => {
              const fecha = new Date(t.created_at).toLocaleDateString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
              });
              return (
                <tr key={t.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">{fecha}</td>
                  <td className="px-4 py-3 font-medium text-kp-white">{t.sucursal_origen_nombre}</td>
                  <td className="px-4 py-3 text-kp-gray-lt">{t.sucursal_destino_nombre}</td>
                  <td className="px-4 py-3 text-center text-xs text-kp-gray tabular-nums">{t.items_count}</td>
                  <td className="px-4 py-3 text-center text-xs text-kp-gray tabular-nums">{t.unidades_total}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[t.estado] ?? ''}`}>
                      {ESTADO_LABEL[t.estado] ?? t.estado}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link
                      href={`/traspasos/${t.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent hover:border-kp-border hover:bg-kp-surface2"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {traspasos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-kp-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <p className="text-kp-gray text-sm">No hay traspasos registrados.</p>
                    {!esCajero && (
                      <p className="text-kp-gray/50 text-xs">Usá el botón <strong>Nuevo Traspaso</strong> para mover stock entre sucursales.</p>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );
}
