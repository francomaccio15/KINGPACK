'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

interface MedioPago { id: string; nombre: string; }

export default function RegistrarPago({
  clienteId,
  saldoActual,
  sucursalId,
}: {
  clienteId: string;
  saldoActual: number;
  sucursalId?: string;
}) {
  const router = useRouter();
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [monto, setMonto]           = useState('');
  const [concepto, setConcepto]     = useState('');
  const [medioPagoId, setMedioPagoId] = useState('');
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);

  // Datos del cheque (solo si el método es Cheque)
  const [chBanco, setChBanco]       = useState('');
  const [chNumero, setChNumero]     = useState('');
  const [chEmision, setChEmision]   = useState('');
  const [chVenc, setChVenc]         = useState('');

  const esCheque = /cheque/i.test(mediosPago.find(m => m.id === medioPagoId)?.nombre ?? '');

  useEffect(() => {
    if (!open) return;
    apiFetch('/api/ventas/medios-pago')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const lista: MedioPago[] = (d.medios_pago ?? []).filter((m: MedioPago) =>
          m.nombre !== 'Saldo a favor' && m.nombre !== 'Cuenta Corriente'
        );
        setMediosPago(lista);
        if (lista.length > 0 && !medioPagoId) setMedioPagoId(lista[0].id);
      })
      .catch(() => {});
  }, [open]);

  const cerrar = () => {
    setOpen(false);
    setError('');
    setMonto('');
    setConcepto('');
    setMedioPagoId('');
    setChBanco(''); setChNumero(''); setChEmision(''); setChVenc('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medioPagoId) { setError('Seleccioná un método de pago'); return; }
    if (esCheque && !chVenc) { setError('Ingresá la fecha de pago del cheque'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/pagos`, {
        method: 'POST',
        body: JSON.stringify({
          monto: parseFloat(monto),
          concepto,
          medio_pago_id: medioPagoId,
          sucursal_id: sucursalId,
          cheque: esCheque
            ? { banco: chBanco, numero_cheque: chNumero, fecha_emision: chEmision || null, fecha_vencimiento: chVenc }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al registrar pago');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const montoNum   = parseFloat(monto) || 0;
  const saldoNuevo = saldoActual - montoNum;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
          bg-green-700 hover:bg-green-600 transition-colors text-white text-sm font-semibold"
      >
        + Registrar Pago
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-green-500 rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Registrar Pago</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Saldo actual */}
              <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo actual</span>
                <span className={`font-bold tabular-nums ${saldoActual > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {ars.format(saldoActual)}
                </span>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                  <NumericInput
                    required
                    value={monto} onChange={e => setMonto(e.target.value)}
                    placeholder="0.00" autoFocus
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Método de Pago *</label>
                {mediosPago.length === 0 ? (
                  <div className="text-xs text-kp-gray italic px-1">Cargando...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mediosPago.map(mp => (
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() => setMedioPagoId(mp.id)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left
                          ${medioPagoId === mp.id
                            ? 'border-green-500 bg-green-500/10 text-green-300'
                            : 'border-kp-border bg-kp-surface2 text-kp-gray hover:border-kp-gray hover:text-kp-white'
                          }`}
                      >
                        {mp.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Datos del cheque */}
              {esCheque && (
                <div className="space-y-3 rounded-xl border border-kp-border bg-kp-surface2/40 p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Datos del cheque</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-kp-gray uppercase tracking-widest mb-1">Banco</label>
                      <input value={chBanco} onChange={e => setChBanco(e.target.value)} placeholder="Banco"
                        className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-kp-gray uppercase tracking-widest mb-1">Nº Cheque</label>
                      <input value={chNumero} onChange={e => setChNumero(e.target.value)} placeholder="00000000"
                        className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-kp-gray uppercase tracking-widest mb-1">Fecha emisión</label>
                      <input type="date" value={chEmision} onChange={e => setChEmision(e.target.value)}
                        className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-green-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-kp-gray uppercase tracking-widest mb-1">Fecha de pago *</label>
                      <input type="date" value={chVenc} onChange={e => setChVenc(e.target.value)}
                        className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-green-500 transition-colors" />
                    </div>
                  </div>
                  <p className="text-[11px] text-kp-gray/70">Queda registrado como cheque en cartera en el módulo Cheques.</p>
                </div>
              )}

              {/* Concepto */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Concepto (opcional)</label>
                <input
                  value={concepto} onChange={e => setConcepto(e.target.value)}
                  placeholder="ej: Pago cuota septiembre..."
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>

              {/* Saldo resultante */}
              {montoNum > 0 && (
                <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-green-700/40 px-4 py-3">
                  <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo resultante</span>
                  <span className={`font-bold tabular-nums ${saldoNuevo > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                    {ars.format(saldoNuevo)}
                  </span>
                </div>
              )}

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white hover:border-kp-gray transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || !monto || !medioPagoId}
                  className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? 'Guardando…' : 'Confirmar Pago'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
