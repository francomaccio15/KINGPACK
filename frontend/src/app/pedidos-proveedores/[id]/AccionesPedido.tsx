'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });

type ItemPedido = {
  articulo_id: string;
  articulo_nombre: string;
  articulo_codigo: string;
  cantidad: string;
  cantidad_recibida: string;
  precio_compra: string;
};

type Pedido = {
  id: string;
  estado: string;
  stock_acreditado: boolean;
  egreso_id: string | null;
  monto_total: string | null;
};

export default function AccionesPedido({ pedido, items, esCajero, mostrarMontos = false }: {
  pedido: Pedido;
  items: ItemPedido[];
  esCajero?: boolean;
  mostrarMontos?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [recibirOpen, setRecibirOpen]       = useState(false);

  // Cantidades recibidas en el modal (inicializa con pendiente por recibir)
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  const abrirRecibir = () => {
    const init: Record<string, string> = {};
    items.forEach(i => {
      const pedida    = parseFloat(i.cantidad) || 0;
      const recibida  = parseFloat(i.cantidad_recibida) || 0;
      const pendiente = Math.max(0, pedida - recibida);
      init[i.articulo_id] = pendiente > 0 ? String(pendiente) : '';
    });
    setCantidades(init);
    setError(null);
    setRecibirOpen(true);
  };

  // Calcular total a pagar según cantidades ingresadas
  const totalAPagar = items.reduce((s, i) => {
    const cant = parseFloat(cantidades[i.articulo_id]) || 0;
    return s + cant * (parseFloat(i.precio_compra) || 0);
  }, 0);

  // ¿Queda algo por recibir según lo ya registrado en la base?
  const pendienteTotal = items.reduce((s, i) =>
    s + Math.max(0, (parseFloat(i.cantidad) || 0) - (parseFloat(i.cantidad_recibida) || 0)), 0);
  const nadaPendiente = pendienteTotal <= 0.001;

  // Si no queda nada pendiente, igual se puede confirmar para cerrar el pedido.
  const hayAlgo = nadaPendiente || Object.values(cantidades).some(v => parseFloat(v) > 0);

  const confirmarRecepcion = async () => {
    const itemsARecibir = items
      .map(i => ({ articulo_id: i.articulo_id, cantidad_recibida: parseFloat(cantidades[i.articulo_id]) || 0 }))
      .filter(i => i.cantidad_recibida > 0);

    if (itemsARecibir.length === 0 && !nadaPendiente) { setError('Ingresá al menos una cantidad mayor a 0'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/pedidos-compra/${pedido.id}/recibir`, {
        method: 'PATCH',
        body: JSON.stringify({ items: itemsARecibir }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al registrar recepción'); return; }
      setRecibirOpen(false);
      router.refresh();
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  const cancelar = async () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/pedidos-compra/${pedido.id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'cancelado' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al cancelar'); return; }
      router.refresh();
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  const eliminar = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/pedidos-compra/${pedido.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al eliminar'); setConfirmEliminar(false); return; }
      router.push('/pedidos-proveedores');
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  const puedeRecibir = pedido.estado !== 'cancelado' && pedido.estado !== 'recibido';

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2 flex-wrap justify-end">

          {/* Botón principal: registrar recepción */}
          {puedeRecibir && (
            <button
              onClick={abrirRecibir}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-400
                hover:bg-green-500/20 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M20 7l-8 8-4-4"/>
                <path d="M5 12H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2"/>
              </svg>
              {nadaPendiente
                ? 'Cerrar pedido'
                : pedido.estado === 'recibido_parcial' ? 'Registrar entrega restante' : 'Registrar Recepción'}
            </button>
          )}

          {pedido.estado === 'recibido' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-green-400">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-xs font-semibold text-green-400">Pedido completamente recibido</span>
            </div>
          )}

          {!esCajero && pedido.estado !== 'cancelado' && pedido.estado !== 'recibido' && (
            <button onClick={cancelar} disabled={loading}
              className="px-3 py-2 rounded-lg border border-kp-border text-kp-gray hover:bg-kp-surface2 text-xs font-semibold transition-colors disabled:opacity-50">
              Cancelar pedido
            </button>
          )}

          {!esCajero && (
            <button
              onClick={() => { setError(null); setConfirmEliminar(true); }}
              disabled={loading || pedido.stock_acreditado}
              className="px-3 py-2 rounded-lg border border-kp-red/40 text-kp-red hover:bg-kp-red/10
                text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
              title={pedido.stock_acreditado ? 'No se puede eliminar: stock ya acreditado' : 'Eliminar pedido'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Eliminar
            </button>
          )}
        </div>
        {error && <p className="text-xs text-kp-red">{error}</p>}
      </div>

      {/* ── Modal: Registrar Recepción ── */}
      {recibirOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !loading && setRecibirOpen(false)} />
          <div className="relative w-full max-w-2xl bg-kp-surface border border-kp-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border shrink-0">
              <div>
                <h3 className="font-bold text-kp-white">Registrar Recepción</h3>
                <p className="text-xs text-kp-gray mt-0.5">
                  {nadaPendiente
                    ? 'Ya está todo recibido. Confirmá para cerrar el pedido.'
                    : 'Ingresá las cantidades que llegaron hoy. Podés recibir parcialmente.'}
                </p>
              </div>
              <button onClick={() => setRecibirOpen(false)} className="text-kp-gray hover:text-kp-white text-xl leading-none">✕</button>
            </div>

            {/* Tabla de ítems */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kp-border">
                    <th className="text-left pb-2 text-xs text-kp-gray uppercase tracking-widest">Artículo</th>
                    <th className="text-right pb-2 text-xs text-kp-gray uppercase tracking-widest w-24">Pedido</th>
                    <th className="text-right pb-2 text-xs text-kp-gray uppercase tracking-widest w-24">Ya recibido</th>
                    <th className="text-right pb-2 text-xs text-kp-gray uppercase tracking-widest w-24">Pendiente</th>
                    <th className="text-right pb-2 text-xs text-kp-gray uppercase tracking-widest w-32">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kp-border">
                  {items.map(item => {
                    const pedida    = parseFloat(item.cantidad) || 0;
                    const recibida  = parseFloat(item.cantidad_recibida) || 0;
                    const pendiente = Math.max(0, pedida - recibida);
                    const aRecibir  = parseFloat(cantidades[item.articulo_id]) || 0;
                    const completo  = recibida >= pedida;

                    return (
                      <tr key={item.articulo_id} className={`py-3 ${completo ? 'opacity-50' : ''}`}>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-kp-white">{item.articulo_nombre}</p>
                          <p className="text-xs text-kp-gray font-mono">{item.articulo_codigo}</p>
                        </td>
                        <td className="py-3 text-right tabular-nums text-kp-gray">{pedida}</td>
                        <td className="py-3 text-right tabular-nums">
                          {recibida > 0
                            ? <span className="text-emerald-400 font-semibold">{recibida}</span>
                            : <span className="text-kp-border">—</span>}
                        </td>
                        <td className="py-3 text-right tabular-nums">
                          {completo
                            ? <span className="text-emerald-400 text-xs font-bold">✓ Completo</span>
                            : <span className="text-amber-400 font-semibold">{pendiente}</span>}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          {completo ? (
                            <span className="text-kp-border text-xs">—</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                max={pendiente}
                                step="1"
                                value={cantidades[item.articulo_id] ?? ''}
                                onChange={e => setCantidades(prev => ({ ...prev, [item.articulo_id]: e.target.value }))}
                                className="w-20 text-right bg-kp-surface2 border border-kp-border rounded-lg px-2 py-1.5
                                  text-sm text-kp-white focus:outline-none focus:border-kp-red tabular-nums"
                                placeholder="0"
                              />
                              {aRecibir > 0 && aRecibir < pendiente && (
                                <span className="text-[10px] text-amber-400 font-bold whitespace-nowrap">parcial</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer con total y botones */}
            <div className="shrink-0 border-t border-kp-border px-6 py-4 space-y-3">
              {/* Total a pagar — solo administrador */}
              {mostrarMontos && totalAPagar > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2.5">
                  <span className="text-sm text-kp-gray font-medium">Total a pagar por esta entrega</span>
                  <span className="text-lg font-bold text-kp-white tabular-nums">{ars.format(totalAPagar)}</span>
                </div>
              )}

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setRecibirOpen(false)} disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-kp-border rounded-lg text-sm text-kp-gray hover:text-kp-white transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmarRecepcion} disabled={loading || !hayAlgo}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Guardando…</>
                    : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>{nadaPendiente ? 'Cerrar pedido como recibido' : 'Confirmar recepción'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !loading && setConfirmEliminar(false)} />
          <div className="relative w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-kp-red">Eliminar Pedido</h3>
            <p className="text-sm text-kp-gray">Esta acción eliminará el pedido permanentemente. No se puede deshacer.</p>
            {error && <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmEliminar(false)} disabled={loading}
                className="flex-1 px-4 py-2.5 border border-kp-border rounded-lg text-sm text-kp-gray hover:text-kp-white transition-colors">
                Cancelar
              </button>
              <button onClick={eliminar} disabled={loading}
                className="flex-1 px-4 py-2.5 bg-kp-red hover:bg-kp-red/80 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                {loading ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
