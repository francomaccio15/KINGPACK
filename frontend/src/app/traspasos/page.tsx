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

type ResumenRow = {
  mes: string;                       // 'YYYY-MM'
  sucursal_origen_nombre: string;
  sucursal_destino_nombre: string;
  traspasos_count: number;
  unidades: number;
  costo_total: number;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 'YYYY-MM' → 'Agosto 2026'
const mesLabel = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  const s = new Date(y, (m || 1) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

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

  // Resumen mensual valorizado a costo — SOLO administradores.
  const esAdmin = user.rol === 'administrador';
  let resumen: ResumenRow[] = [];
  if (esAdmin) {
    resumen = await serverFetch(`/api/traspasos/resumen-mensual`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { resumen: [] })
      .then(d => (d.resumen ?? []) as ResumenRow[])
      .catch(() => []);
  }
  // Agrupar filas por mes (ya vienen ordenadas por mes desc).
  const resumenPorMes = resumen.reduce((acc, r) => {
    (acc[r.mes] ??= []).push(r);
    return acc;
  }, {} as Record<string, ResumenRow[]>);

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
          <NuevoTraspaso
            sucursales={sucursales}
            articulos={articulos}
            sucursalDefaultId={esCajero ? sucursalId : null}
          />
        </div>
      </div>

      {/* Resumen mensual valorizado a costo — solo administradores */}
      {esAdmin && (
        <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden shadow-lg shadow-black/40">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-kp-border bg-kp-surface2">
            <svg className="w-4 h-4 text-kp-red flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
              Mercadería traspasada por mes <span className="text-kp-gray/60 normal-case tracking-normal font-normal">(valorizada a costo)</span>
            </h3>
          </div>

          {Object.keys(resumenPorMes).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-kp-gray">Todavía no hay traspasos enviados o recibidos para valorizar.</p>
          ) : (
            <div className="divide-y divide-kp-border">
              {Object.entries(resumenPorMes).map(([mes, filas]) => {
                const totalMes = filas.reduce((s, f) => s + f.costo_total, 0);
                return (
                  <div key={mes} className="px-5 py-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <h4 className="text-sm font-bold text-kp-white">{mesLabel(mes)}</h4>
                      <span className="text-sm font-bold text-kp-white tabular-nums">{ars.format(totalMes)}</span>
                    </div>
                    <div className="space-y-1.5">
                      {filas.map((f, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-kp-gray-lt truncate">{f.sucursal_origen_nombre}</span>
                            <svg className="w-3.5 h-3.5 text-kp-red flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                            </svg>
                            <span className="text-kp-white font-medium truncate">{f.sucursal_destino_nombre}</span>
                            <span className="text-xs text-kp-gray/70 whitespace-nowrap">
                              · {f.traspasos_count} {Number(f.traspasos_count) === 1 ? 'traspaso' : 'traspasos'} · {f.unidades} u.
                            </span>
                          </div>
                          <span className="text-kp-gray-lt tabular-nums whitespace-nowrap">{ars.format(f.costo_total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
