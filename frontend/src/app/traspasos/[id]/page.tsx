import Link from 'next/link';
import AccionesTraspaso from '../AccionesTraspaso';
import PrintButton from './PrintButton';
import PrintTrigger from './PrintTrigger';

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

const ESTADO_LABEL_PRINT: Record<string, string> = {
  pendiente:   'PENDIENTE',
  en_transito: 'EN TRÁNSITO',
  recibido:    'RECIBIDO',
  cancelado:   'CANCELADO',
};

export const dynamic = 'force-dynamic';

export default async function DetalleTraspasoPage({ params }: { params: { id: string } }) {
  const user = requireAuth('/traspasos');
  const esAdmin      = user.rol === 'administrador';
  const esSupervisor = user.rol === 'supervisor';
  const esCajero     = user.rol === 'cajero';
  const esPrivilegiado = esAdmin || esSupervisor;
  const cajeroSucursalId = esCajero ? (user.sucursal_default_id ?? null) : null;

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

  const idCajero = cajeroSucursalId?.trim() ?? null;
  const esOrigen  = esCajero && !!idCajero && idCajero === String(traspaso.sucursal_origen_id).trim();
  const esDestino = esCajero && !!idCajero && idCajero === String(traspaso.sucursal_destino_id).trim();

  const puedeEnviar   = esPrivilegiado || esCajero;
  const puedeRecibir  = esPrivilegiado || esCajero;
  const puedeCancelar = esPrivilegiado || esCajero;
  const hayAcciones   = puedeEnviar || puedeRecibir || puedeCancelar;

  const fechaCreacion = new Date(traspaso.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const fechaCreacionCorta = new Date(traspaso.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const totalUnidades = items.reduce((s: number, i: any) => s + parseFloat(i.cantidad ?? 0), 0);

  // Número de remito legible (últimos 8 chars del UUID)
  const nroRemito = String(traspaso.id).replace(/-/g, '').slice(-8).toUpperCase();

  return (
    <>
      <PrintTrigger />

      {/* ── Barra de acciones (no se imprime) ── */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <a href="/traspasos" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
          ← Volver a Traspasos
        </a>
        <PrintButton />
      </div>

      {/* ── Vista normal de la app (no se imprime) ── */}
      <section className="print:hidden space-y-6 max-w-4xl mt-14">

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

        {/* Banner informativo para cajero */}
        {esCajero && traspaso.estado !== 'recibido' && traspaso.estado !== 'cancelado' && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold
            ${esOrigen
              ? 'border-blue-500/30 bg-blue-500/5 text-blue-300'
              : esDestino
                ? 'border-green-500/30 bg-green-500/5 text-green-300'
                : 'border-kp-border bg-kp-surface2 text-kp-gray'
            }`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {esOrigen
              ? 'Tu sucursal es el origen. Marcalo como enviado cuando el stock salga.'
              : esDestino
                ? 'Tu sucursal es el destino. Confirmá la recepción cuando el stock llegue.'
                : 'Podés gestionar el estado de este traspaso.'}
          </div>
        )}

        {/* Acciones según rol y sucursal */}
        {hayAcciones && (
          <AccionesTraspaso
            traspasoId={traspaso.id}
            estado={traspaso.estado}
            puedeEnviar={puedeEnviar}
            puedeRecibir={puedeRecibir}
            puedeCancelar={puedeCancelar}
          />
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

      {/* ── Documento imprimible ── */}
      <div className="hidden print:block min-h-screen bg-white">
        <div className="max-w-[210mm] mx-auto p-10 font-sans text-gray-900">

          {/* ══ ENCABEZADO ══════════════════════════════════════════════════════ */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-1">
                KING PACK S.R.L.
              </h1>
              <p className="text-sm text-gray-500 font-semibold">Remito de Traspaso Interno</p>
            </div>
            <div className="text-right">
              <div className="inline-flex flex-col items-center border-2 border-gray-900 rounded-lg px-6 py-3">
                <span className="text-[10px] uppercase tracking-widest font-black text-gray-600">Remito</span>
                <span className="text-xl font-black leading-none font-mono mt-1">{nroRemito}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{fechaCreacionCorta}</p>
              {traspaso.usuario_nombre && (
                <p className="text-xs text-gray-400 mt-0.5">Creado por: {traspaso.usuario_nombre}</p>
              )}
            </div>
          </div>

          {/* ══ SECCIÓN 1: ORIGEN / DESTINO ════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Sucursal Origen</p>
              <p className="text-base font-bold text-gray-900">{traspaso.sucursal_origen_nombre}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Sucursal Destino</p>
              <p className="text-base font-bold text-gray-900">{traspaso.sucursal_destino_nombre}</p>
            </div>
          </div>

          {/* ══ SECCIÓN 2: ESTADO Y FECHAS ══════════════════════════════════════ */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Estado</p>
              <p className="text-sm font-bold text-gray-800">{ESTADO_LABEL_PRINT[traspaso.estado] ?? traspaso.estado}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Fecha de creación</p>
              <p className="text-sm font-semibold text-gray-800">{fechaCreacionCorta}</p>
            </div>
            {traspaso.fecha_envio && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Fecha de envío</p>
                <p className="text-sm font-semibold text-gray-800">
                  {new Date(traspaso.fecha_envio).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
            {traspaso.fecha_recepcion && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Fecha de recepción</p>
                <p className="text-sm font-semibold text-gray-800">
                  {new Date(traspaso.fecha_recepcion).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* ══ SECCIÓN 3: NOTAS ════════════════════════════════════════════════ */}
          {traspaso.notas && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Observaciones</p>
              <p className="text-sm text-gray-800 leading-relaxed">{traspaso.notas}</p>
            </div>
          )}

          {/* ══ SECCIÓN 4: DETALLE DE ARTÍCULOS ════════════════════════════════ */}
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Detalle de artículos
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="text-left px-3 py-2 font-semibold rounded-tl-lg">Descripción</th>
                  <th className="text-left px-3 py-2 font-semibold w-32">Código</th>
                  <th className="text-right px-3 py-2 font-semibold w-24 rounded-tr-lg">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={item.articulo_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-b border-gray-100 font-medium">{item.articulo_nombre}</td>
                    <td className="px-3 py-2 border-b border-gray-100 font-mono text-xs text-gray-500">{item.articulo_codigo}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-right tabular-nums font-semibold">{item.cantidad}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-400 text-sm">Sin artículos.</td>
                  </tr>
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-900 text-white">
                    <td colSpan={2} className="px-3 py-2.5 text-xs font-black uppercase tracking-widest rounded-bl-lg">
                      Total — {items.length} artículo{items.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-black rounded-br-lg">
                      {totalUnidades} ud.
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ══ FIRMAS ═══════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-16 mt-14 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="border-t border-gray-400 mt-12 pt-2">
                <p className="text-xs text-gray-500 font-semibold">Firma y aclaración — Origen</p>
                <p className="text-xs text-gray-400 mt-0.5">{traspaso.sucursal_origen_nombre}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 mt-12 pt-2">
                <p className="text-xs text-gray-500 font-semibold">Firma y aclaración — Destino</p>
                <p className="text-xs text-gray-400 mt-0.5">{traspaso.sucursal_destino_nombre}</p>
              </div>
            </div>
          </div>

          {/* ══ PIE ══════════════════════════════════════════════════════════════ */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest">
              KING PACK S.R.L. · Remito interno N° {nroRemito} · Emitido el {fechaCreacionCorta}
              {traspaso.usuario_nombre ? ` · por ${traspaso.usuario_nombre}` : ''}
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
