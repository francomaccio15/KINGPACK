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

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function AccionesTraspaso({
  traspasoId,
  estado,
}: {
  traspasoId: string;
  estado: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const cambiarEstado = async (nuevoEstado: string) => {
    setLoading(nuevoEstado);
    setError(null);
    try {
      const res = await apiFetch(`/api/traspasos/${traspasoId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al actualizar'); return; }
      setConfirm(null);
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(null);
    }
  };

  if (estado === 'recibido' || estado === 'cancelado') return null;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {estado === 'pendiente' && (
          <>
            {confirm === 'en_transito' ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
                <p className="text-xs text-blue-300">El stock se debitará del origen. ¿Confirmar?</p>
                <button
                  onClick={() => cambiarEstado('en_transito')}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-400 transition-colors disabled:opacity-50"
                >
                  {loading === 'en_transito' ? <Spinner /> : null}
                  Confirmar envío
                </button>
                <button onClick={() => setConfirm(null)} className="text-xs text-kp-gray hover:text-kp-white transition-colors px-2">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm('en_transito')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/40 text-blue-400 text-sm font-semibold hover:bg-blue-500/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Marcar como enviado
              </button>
            )}
          </>
        )}

        {estado === 'en_transito' && (
          <>
            {confirm === 'recibido' ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <p className="text-xs text-green-300">El stock se acreditará en destino. ¿Confirmar?</p>
                <button
                  onClick={() => cambiarEstado('recibido')}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-400 transition-colors disabled:opacity-50"
                >
                  {loading === 'recibido' ? <Spinner /> : null}
                  Confirmar recepción
                </button>
                <button onClick={() => setConfirm(null)} className="text-xs text-kp-gray hover:text-kp-white transition-colors px-2">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm('recibido')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/40 text-green-400 text-sm font-semibold hover:bg-green-500/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirmar recepción
              </button>
            )}
          </>
        )}

        {/* Cancelar siempre disponible */}
        {confirm === 'cancelado' ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-kp-red/30 bg-kp-red/5">
            <p className="text-xs text-red-300">
              {estado === 'en_transito' ? 'El stock volverá al origen. ' : ''}
              ¿Cancelar traspaso?
            </p>
            <button
              onClick={() => cambiarEstado('cancelado')}
              disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-kp-red text-white text-xs font-semibold hover:bg-kp-red/80 transition-colors disabled:opacity-50"
            >
              {loading === 'cancelado' ? <Spinner /> : null}
              Sí, cancelar
            </button>
            <button onClick={() => setConfirm(null)} className="text-xs text-kp-gray hover:text-kp-white transition-colors px-2">
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm('cancelado')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-red hover:border-kp-red/40 transition-colors"
          >
            Cancelar traspaso
          </button>
        )}
      </div>
    </div>
  );
}
