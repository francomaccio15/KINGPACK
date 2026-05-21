'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Pedido = {
  id: string;
  estado: string;
  stock_acreditado: boolean;
  egreso_id: string | null;
};

export default function AccionesPedido({ pedido }: { pedido: Pedido }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const confirmar = async () => {
    if (!confirm('¿Confirmás que la mercadería llegó? Se va a acreditar el stock en la sucursal correspondiente.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/pedidos-compra/${pedido.id}/confirmar-recepcion`, {
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
      const res = await fetch(`${API}/api/pedidos-compra/${pedido.id}/estado`, {
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

  if (pedido.stock_acreditado) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-400 flex-shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="text-xs font-semibold text-green-400">Stock acreditado</span>
      </div>
    );
  }

  if (pedido.estado === 'cancelado') return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap justify-end">
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
      </div>
      {error && <p className="text-xs text-kp-red">{error}</p>}
    </div>
  );
}
