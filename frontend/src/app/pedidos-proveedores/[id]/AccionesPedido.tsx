'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Pedido = {
  id: string;
  estado: string;
};

const TRANSICIONES: Record<string, { label: string; nuevoEstado: string; color: string }[]> = {
  pendiente: [
    { label: 'Marcar Recibido Parcial', nuevoEstado: 'recibido_parcial', color: 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10' },
    { label: 'Marcar Recibido',         nuevoEstado: 'recibido',         color: 'border-green-500/40 text-green-400 hover:bg-green-500/10' },
    { label: 'Cancelar Pedido',          nuevoEstado: 'cancelado',        color: 'border-kp-border text-kp-gray hover:bg-kp-surface2' },
  ],
  recibido_parcial: [
    { label: 'Marcar Recibido',  nuevoEstado: 'recibido',  color: 'border-green-500/40 text-green-400 hover:bg-green-500/10' },
    { label: 'Cancelar Pedido',   nuevoEstado: 'cancelado', color: 'border-kp-border text-kp-gray hover:bg-kp-surface2' },
  ],
};

export default function AccionesPedido({ pedido }: { pedido: Pedido }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const acciones = TRANSICIONES[pedido.estado] ?? [];

  if (acciones.length === 0) return null;

  const cambiarEstado = async (nuevoEstado: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/pedidos-compra/${pedido.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al actualizar'); return; }
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap justify-end">
        {acciones.map(a => (
          <button
            key={a.nuevoEstado}
            onClick={() => cambiarEstado(a.nuevoEstado)}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${a.color}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-kp-red">{error}</p>}
    </div>
  );
}
