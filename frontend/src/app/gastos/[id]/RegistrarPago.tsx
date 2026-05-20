'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type MedioPago = { id: string; nombre: string };
type CuentaBancaria = { id: string; nombre: string; banco: string | null };
type Cheque = { banco: string; numero_cheque: string; fecha_vencimiento: string; importe: string };

type Props = {
  egresoId: string;
  totalEgreso: number;
  totalPagado: number;
  mediosPago: MedioPago[];
  cuentasBancarias: CuentaBancaria[];
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
const labelCls = 'block text-xs text-kp-gray font-semibold uppercase tracking-wide mb-1';

const emptyCheque = (): Cheque => ({ banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' });

export default function RegistrarPago({ egresoId, totalEgreso, totalPagado, mediosPago, cuentasBancarias }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pendiente = Math.max(0, totalEgreso - totalPagado);

  const [medioPagoId, setMedioPagoId] = useState('');
  const [monto, setMonto] = useState(pendiente.toFixed(2));
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [cheques, setCheques] = useState<Cheque[]>([emptyCheque()]);

  const selectedMedio = mediosPago.find(m => m.id === medioPagoId);
  const esCheque = selectedMedio?.nombre.toLowerCase().includes('cheque') ?? false;

  const handleOpen = () => {
    setMonto(pendiente.toFixed(2));
    setMedioPagoId(mediosPago[0]?.id ?? '');
    setCuentaBancariaId('');
    setObservaciones('');
    setCheques([emptyCheque()]);
    setError('');
    setOpen(true);
  };

  const handleClose = () => { if (!loading) setOpen(false); };

  const addCheque = () => setCheques(prev => [...prev, emptyCheque()]);
  const removeCheque = (i: number) => setCheques(prev => prev.filter((_, idx) => idx !== i));
  const updateCheque = (i: number, field: keyof Cheque, value: string) =>
    setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medioPagoId) { setError('Seleccioná un medio de pago'); return; }
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) { setError('El monto debe ser mayor a 0'); return; }

    const body: Record<string, unknown> = {
      medio_pago_id: medioPagoId,
      monto: montoNum,
      cuenta_bancaria_id: cuentaBancariaId || null,
      observaciones: observaciones.trim() || null,
    };

    if (esCheque) {
      const chequesValidos = cheques.filter(c => c.banco && c.numero_cheque && c.fecha_vencimiento && c.importe);
      if (chequesValidos.length === 0) { setError('Completá al menos un cheque'); return; }
      body.cheques = chequesValidos.map(c => ({ ...c, importe: parseFloat(c.importe) }));
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/egresos/${egresoId}/pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al registrar el pago'); return; }
      setOpen(false);
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
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-kp-red hover:bg-kp-red/80 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Registrar Pago
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative w-full max-w-lg bg-kp-surface border border-kp-border rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-lg font-bold">Registrar Pago</h3>
              <button onClick={handleClose} disabled={loading} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex gap-4 p-3 rounded-lg bg-kp-surface2 text-sm">
                <div>
                  <span className="text-kp-gray">Total: </span>
                  <span className="font-semibold tabular-nums">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalEgreso)}
                  </span>
                </div>
                <div>
                  <span className="text-kp-gray">Ya pagado: </span>
                  <span className="font-semibold tabular-nums text-green-400">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalPagado)}
                  </span>
                </div>
                <div>
                  <span className="text-kp-gray">Pendiente: </span>
                  <span className="font-semibold tabular-nums text-amber-400">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(pendiente)}
                  </span>
                </div>
              </div>

              <div>
                <label className={labelCls}>Medio de Pago *</label>
                <select value={medioPagoId} onChange={e => setMedioPagoId(e.target.value)} className={inputCls} required>
                  <option value="">Seleccioná</option>
                  {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Monto *</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={monto} onChange={e => setMonto(e.target.value)}
                  className={inputCls} required
                />
              </div>

              {cuentasBancarias.length > 0 && (
                <div>
                  <label className={labelCls}>Cuenta Bancaria (opcional)</label>
                  <select value={cuentaBancariaId} onChange={e => setCuentaBancariaId(e.target.value)} className={inputCls}>
                    <option value="">Sin imputar a cuenta</option>
                    {cuentasBancarias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}{c.banco ? ` — ${c.banco}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Observaciones</label>
                <input
                  type="text" placeholder="Opcional"
                  value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  className={inputCls}
                />
              </div>

              {esCheque && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={labelCls + ' mb-0'}>Cheques</p>
                    <button type="button" onClick={addCheque} className="text-xs text-kp-red hover:underline">
                      + Agregar cheque
                    </button>
                  </div>
                  {cheques.map((ch, i) => (
                    <div key={i} className="bg-kp-surface2 border border-kp-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-kp-gray">Cheque #{i + 1}</span>
                        {cheques.length > 1 && (
                          <button type="button" onClick={() => removeCheque(i)} className="text-xs text-kp-red hover:underline">
                            Eliminar
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Banco</label>
                          <input type="text" value={ch.banco} onChange={e => updateCheque(i, 'banco', e.target.value)}
                            placeholder="Ej: Galicia" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Nro. Cheque</label>
                          <input type="text" value={ch.numero_cheque} onChange={e => updateCheque(i, 'numero_cheque', e.target.value)}
                            placeholder="00001234" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Vencimiento</label>
                          <input type="date" value={ch.fecha_vencimiento} onChange={e => updateCheque(i, 'fecha_vencimiento', e.target.value)}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Importe</label>
                          <input type="number" step="0.01" min="0.01" value={ch.importe} onChange={e => updateCheque(i, 'importe', e.target.value)}
                            className={inputCls} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-kp-border rounded-lg text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-kp-red hover:bg-kp-red/80 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors">
                  {loading ? 'Registrando…' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
