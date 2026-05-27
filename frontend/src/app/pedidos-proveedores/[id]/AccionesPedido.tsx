'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

type Pedido = {
  id: string;
  estado: string;
  stock_acreditado: boolean;
  egreso_id: string | null;
};

export default function AccionesPedido({ pedido }: { pedido: Pedido }) {
  const router = useRouter();
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  const confirmar = async () => {
    if (!confirm('¿Confirmás que la mercadería llegó? Se va a acreditar el stock en la sucursal correspondiente.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/pedidos-compra/${pedido.id}/confirmar-recepcion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al confirmar'); return; }
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const cancelar = async () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/pedidos-compra/${pedido.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al cancelar'); return; }
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const eliminar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/pedidos-compra/${pedido.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al eliminar'); setConfirmEliminar(false); return; }
      router.push('/pedidos-proveedores');
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2 flex-wrap justify-end">
          {!pedido.stock_acreditado && pedido.estado !== 'cancelado' && (
            <>
              <button
                onClick={confirmar}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-400
                  hover:bg-green-500/20 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M20 7l-8 8-4-4" /><path d="M5 12H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2" />
                </svg>
                Confirmar Recepción
              </button>
              <button
                onClick={cancelar}
                disabled={loading}
                className="px-3 py-2 rounded-lg border border-kp-border text-kp-gray hover:bg-kp-surface2
                  text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar pedido
              </button>
            </>
          )}
          {pedido.stock_acreditado && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-400 flex-shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-xs font-semibold text-green-400">Stock acreditado</span>
            </div>
          )}
          <button
            onClick={() => { setError(null); setConfirmEliminar(true); }}
            disabled={loading || pedido.stock_acreditado}
            className="px-3 py-2 rounded-lg border border-kp-red/40 text-kp-red hover:bg-kp-red/10
              text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            title={pedido.stock_acreditado ? 'No se puede eliminar: stock ya acreditado' : 'Eliminar pedido'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Eliminar
          </button>
        </div>
        {error && <p className="text-xs text-kp-red">{error}</p>}
      </div>

      {/* Modal confirmación eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !loading && setConfirmEliminar(false)} />
          <div className="relative w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-kp-red">Eliminar Pedido</h3>
            <p className="text-sm text-kp-gray">
              Esta acción eliminará el pedido y todos sus artículos permanentemente. No se puede deshacer.
            </p>
            {error && (
              <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmEliminar(false)}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-kp-border rounded-lg text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-kp-red hover:bg-kp-red/80 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {loading ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
