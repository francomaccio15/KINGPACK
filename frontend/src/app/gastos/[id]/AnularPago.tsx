'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors resize-none';

type Props = {
  egresoId: string;
  pagoId: string;
  monto: string | number;
  medioNombre: string | null;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export default function AnularPago({ egresoId, pagoId, monto, medioNombre }: Props) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [motivo, setMotivo]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleClose = () => { if (!loading) { setOpen(false); setMotivo(''); setError(''); } };

  const handleAnular = async () => {
    if (!motivo.trim()) { setError('Ingresá el motivo de la anulación'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/egresos/${egresoId}/pagos/${pagoId}/anular`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al anular el pago'); return; }
      setOpen(false);
      setMotivo('');
      router.refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-kp-gray hover:text-kp-red px-2 py-1 rounded border border-transparent hover:border-kp-red/40 hover:bg-kp-red/10 transition-colors"
      >
        Anular
      </button>

      <Modal open={open} onClose={handleClose} title="Anular pago" size="md">
        <div className="space-y-4">
          <p className="text-sm text-kp-gray-lt">
            Vas a anular el pago de{' '}
            <span className="font-bold text-kp-white">{ars.format(parseFloat(String(monto)) || 0)}</span>
            {medioNombre ? ` (${medioNombre})` : ''}.
          </p>
          <p className="text-xs text-amber-400/80">
            La plata vuelve a la caja fuerte o a la cuenta bancaria de donde salió, la deuda con el
            proveedor se restablece y el comprobante vuelve a figurar impago. Los cheques emitidos en
            este pago se eliminan.
          </p>

          <div>
            <label className="block text-xs text-kp-gray font-semibold uppercase tracking-wide mb-1">
              Motivo *
            </label>
            <textarea
              rows={3}
              placeholder="Ej: cargado por error, monto equivocado…"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className={inputCls}
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAnular}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Anulando…' : 'Anular pago'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
