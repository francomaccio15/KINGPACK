'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      ...(o.headers as Record<string, string> || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
};

export default function AccionesLicitacion({
  licitacionId,
  estadoActual,
}: {
  licitacionId: string;
  estadoActual: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const cambiarEstado = async (estado: string) => {
    setLoading(true);
    try {
      await apiFetch(`/api/licitaciones/${licitacionId}`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const eliminar = async () => {
    if (!confirm('¿Eliminar esta licitación? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      await apiFetch(`/api/licitaciones/${licitacionId}`, { method: 'DELETE' });
      router.push('/licitaciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Imprimir */}
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray text-sm font-medium transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Imprimir
      </button>

      {/* Marcar enviada / volver a borrador */}
      {estadoActual === 'borrador' && (
        <button
          onClick={() => cambiarEstado('enviada')}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Marcar enviada
        </button>
      )}
      {estadoActual === 'enviada' && (
        <button
          onClick={() => cambiarEstado('borrador')}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray disabled:opacity-50 text-sm font-medium transition-colors"
        >
          Volver a borrador
        </button>
      )}

      {/* Eliminar */}
      <button
        onClick={eliminar}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-red/40 text-kp-red hover:bg-kp-red/10 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        Eliminar
      </button>
    </div>
  );
}
