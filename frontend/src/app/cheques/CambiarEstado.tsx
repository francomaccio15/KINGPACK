'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';

const TRANSICIONES: Record<string, Record<string, string[]>> = {
  recibido: {
    en_cartera: ['depositado', 'endosado', 'rechazado', 'anulado'],
    depositado:  ['acreditado', 'rechazado'],
    acreditado:  [],
    endosado:    [],
    rechazado:   ['anulado'],
    anulado:     [],
  },
  emitido: {
    emitido:    ['presentado', 'debitado', 'rechazado', 'anulado'],
    presentado: ['debitado', 'rechazado'],
    debitado:   [],
    rechazado:  ['anulado'],
    anulado:    [],
  },
};

const LABEL_ESTADO: Record<string, string> = {
  en_cartera: 'En Cartera', depositado: 'Depositado', acreditado: 'Acreditado',
  endosado: 'Endosado', rechazado: 'Rechazado', anulado: 'Anulado',
  emitido: 'Emitido', presentado: 'Presentado', debitado: 'Debitado',
};

interface Props {
  chequeId:   string;
  tipo:       'recibido' | 'emitido';
  estadoActual: string;
}

export default function CambiarEstado({ chequeId, tipo, estadoActual }: Props) {
  const router = useRouter();
  const [open,        setOpen]        = useState(false);
  const [estadoNuevo, setEstadoNuevo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [fechaEstado, setFechaEstado] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const siguientes = TRANSICIONES[tipo]?.[estadoActual] ?? [];
  if (siguientes.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estadoNuevo) { setError('Seleccioná un estado'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/api/cheques/${tipo}/${chequeId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado_nuevo: estadoNuevo, observacion, fecha_estado: fechaEstado || undefined }),
      });
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-kp-border text-kp-gray-lt hover:text-kp-white hover:border-kp-white transition-colors"
      >
        Cambiar estado
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-xl shadow-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-kp-white">Cambiar estado del cheque</h3>
            <p className="text-sm text-kp-gray">
              Estado actual: <span className="font-semibold text-kp-white">{LABEL_ESTADO[estadoActual] ?? estadoActual}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kp-gray font-medium">Nuevo estado *</label>
                <select
                  value={estadoNuevo}
                  onChange={e => setEstadoNuevo(e.target.value)}
                  className="h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
                  required
                >
                  <option value="">Seleccionar…</option>
                  {siguientes.map(s => (
                    <option key={s} value={s}>{LABEL_ESTADO[s] ?? s}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-kp-gray font-medium">Fecha del cambio</label>
                <input
                  type="date"
                  value={fechaEstado}
                  onChange={e => setFechaEstado(e.target.value)}
                  className="h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-kp-gray font-medium">Observación</label>
                <textarea
                  value={observacion}
                  onChange={e => setObservacion(e.target.value)}
                  rows={2}
                  placeholder="Motivo del cambio, banco, referencia…"
                  className="px-3 py-2 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50"
                >
                  {loading ? 'Guardando…' : 'Confirmar cambio'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
