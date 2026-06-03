'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

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

type Empleado = { id: string; nombre: string; cargo: string | null };

export default function RegistrarGasto({ cajaId }: { cajaId: string }) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [concepto, setConcepto]     = useState('');
  const [monto, setMonto]           = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [empleados, setEmpleados]   = useState<Empleado[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Cargar empleados al abrir el modal
  useEffect(() => {
    if (!open) return;
    setLoadingEmps(true);
    apiFetch('/api/empleados?activo=true&limit=500')
      .then(r => r.json())
      .then(d => setEmpleados(d.empleados ?? []))
      .catch(() => setEmpleados([]))
      .finally(() => setLoadingEmps(false));
  }, [open]);

  const reset = () => {
    setConcepto('');
    setMonto('');
    setEmpleadoId('');
    setError(null);
  };

  const handleGuardar = async () => {
    if (!concepto.trim()) { setError('El concepto es requerido'); return; }
    if (!monto || parseFloat(monto) <= 0) { setError('El monto debe ser mayor a 0'); return; }

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        tipo: 'egreso',
        concepto: concepto.trim(),
        monto: parseFloat(monto),
      };
      if (empleadoId) {
        body.origen_tipo = 'empleado';
        body.origen_id   = empleadoId;
      }

      const res = await apiFetch(`/api/caja/${cajaId}/movimiento`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return; }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-kp-red/40 text-kp-red text-sm font-semibold hover:bg-kp-red/10 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Registrar Gasto
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Registrar Gasto</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Tipo fijo - visual */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-kp-red/10 border border-kp-red/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-kp-red flex-shrink-0">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="text-xs font-semibold text-kp-red">Egreso de caja</span>
              </div>

              {/* Concepto */}
              <div>
                <label className={labelCls}>Concepto *</label>
                <input
                  type="text"
                  placeholder="Ej: Compra de insumos, delivery, servicio…"
                  value={concepto}
                  onChange={e => setConcepto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuardar()}
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Monto */}
              <div>
                <label className={labelCls}>Monto *</label>
                <NumericInput
                  placeholder="0.00"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Empleado (opcional) */}
              <div>
                <label className={labelCls}>
                  Empleado
                  <span className="ml-1 normal-case font-normal text-kp-gray/60">(opcional)</span>
                </label>
                {loadingEmps ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-kp-gray">
                    <Spinner /> Cargando empleados…
                  </div>
                ) : (
                  <select
                    value={empleadoId}
                    onChange={e => setEmpleadoId(e.target.value)}
                    className={`${inputCls} appearance-none`}
                  >
                    <option value="">— Sin asignar —</option>
                    {empleados.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre}{emp.cargo ? ` · ${emp.cargo}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <><Spinner /> Guardando…</> : 'Registrar Gasto'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
