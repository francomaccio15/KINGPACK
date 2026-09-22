'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { filtrarMediosPorRol } from '@/lib/mediosPago';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });

// Mismos medios que se ocultan al cobrar (ver RegistrarPago): cajas fuertes son
// internas, y MP / Tarjeta de crédito no se cobran por este circuito.
const MEDIOS_OCULTOS_PAGO = ['efectivo caja fuerte', 'mercado pago', 'tarjeta de crédito', 'tarjeta de credito'];
// Medios que van contra el banco y necesitan cuenta destino.
const MEDIOS_REQUIEREN_CUENTA = ['qr', 'tarjeta de débito', 'tarjeta de debito'];

interface MedioPago { id: string; nombre: string; requiere_cuenta?: boolean }
interface CuentaBancaria { id: string; nombre: string; banco?: string | null }

export default function EditarPago({
  clienteId,
  movId,
  montoActual,
  medioActualId,
  medioActualNombre,
  cuentaActualId,
}: {
  clienteId: string;
  movId: string;
  montoActual: number;
  medioActualId?: string | null;
  medioActualNombre?: string | null;
  cuentaActualId?: string | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [monto, setMonto]     = useState(String(montoActual));
  const [motivo, setMotivo]   = useState('');

  const [medioPagoId, setMedioPagoId] = useState(medioActualId ?? '');
  const [mediosPago, setMediosPago]   = useState<MedioPago[]>([]);
  const [cuentas, setCuentas]         = useState<CuentaBancaria[]>([]);
  const [cuentaId, setCuentaId]       = useState(cuentaActualId ?? '');

  const medioElegido = mediosPago.find(m => m.id === medioPagoId);
  const esChequeActual = /cheque/i.test(medioActualNombre ?? '');
  const esChequeNuevo  = /cheque/i.test(medioElegido?.nombre ?? '');
  const requiereCuenta = !!medioElegido && (
    medioElegido.requiere_cuenta === true ||
    MEDIOS_REQUIEREN_CUENTA.includes(medioElegido.nombre.trim().toLowerCase())
  );
  const cambiaMedio = medioPagoId && medioPagoId !== (medioActualId ?? '');

  useEffect(() => {
    if (!open) return;
    apiFetch('/api/ventas/medios-pago')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const lista = filtrarMediosPorRol(
          (d.medios_pago ?? []).filter((m: MedioPago) =>
            m.nombre !== 'Saldo a favor' &&
            m.nombre !== 'Cuenta Corriente' &&
            !MEDIOS_OCULTOS_PAGO.includes(m.nombre.trim().toLowerCase())
          ) as MedioPago[],
          user?.rol,
        );
        setMediosPago(lista);
      })
      .catch(() => {});
    apiFetch('/api/cuentas-bancarias')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setCuentas(d.cuentas ?? []))
      .catch(() => {});
  }, [open, user?.rol]);

  // Al pasar a un medio que no va contra el banco, limpiar la cuenta.
  useEffect(() => { if (!requiereCuenta) setCuentaId(''); }, [requiereCuenta]);

  const cerrar = () => {
    setOpen(false);
    setError('');
    setMonto(String(montoActual));
    setMotivo('');
    setMedioPagoId(medioActualId ?? '');
    setCuentaId(cuentaActualId ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) { setError('Indicá el motivo de la edición'); return; }
    if (requiereCuenta && !cuentaId) { setError('Seleccioná la cuenta que recibe el pago'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/pagos/${movId}`, {
        method: 'PUT',
        body: JSON.stringify({
          monto: parseFloat(monto),
          motivo: motivo.trim(),
          medio_pago_id: medioPagoId || null,
          cuenta_bancaria_id: cuentaId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al editar el pago');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Editar pago"
        className="text-kp-gray hover:text-sky-400 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={cerrar}
        title="Editar Pago"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">

          {/* Monto original */}
          <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
            <span className="text-xs text-kp-gray uppercase tracking-widest">Monto original</span>
            <span className="font-bold tabular-nums text-kp-gray-lt">{ars.format(montoActual)}</span>
          </div>

          {/* Nuevo monto */}
          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Nuevo monto *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
              <NumericInput
                required
                value={monto} onChange={e => setMonto(e.target.value)}
                placeholder="0.00" autoFocus
                className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                  placeholder:text-kp-gray focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Método de Pago</label>
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
                        ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                        : 'border-kp-border bg-kp-surface2 text-kp-gray hover:border-kp-gray hover:text-kp-white'
                      }`}
                  >
                    {mp.nombre}
                  </button>
                ))}
              </div>
            )}
            {esChequeActual && (
              <p className="text-2xs md:text-[11px] text-amber-400/80 mt-1">Este cobro fue con cheque: el cambio de medio lo ajusta el administrador desde el módulo Cheques.</p>
            )}
            {esChequeNuevo && (
              <p className="text-2xs md:text-[11px] text-amber-400/80 mt-1">Para cobrar con cheque, registrá el cheque desde el módulo Cheques o con el administrador.</p>
            )}
          </div>

          {/* Cuenta destino: sólo para medios que van contra el banco */}
          {requiereCuenta && (
            <div>
              <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Cuenta que recibe *</label>
              <select value={cuentaId} onChange={e => setCuentaId(e.target.value)}
                className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-sky-500 transition-colors">
                <option value="">Seleccioná la cuenta</option>
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.banco ? ` — ${c.banco}` : ''}</option>
                ))}
              </select>
              <p className="mt-1 text-2xs md:text-[11px] text-kp-gray">Se acredita en el saldo de esa cuenta.</p>
            </div>
          )}

          {/* Motivo (obligatorio) */}
          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Motivo de la edición *</label>
            <textarea
              value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder={cambiaMedio ? 'ej: se clickeó Efectivo por error, era Transferencia...' : 'ej: se cargó mal el monto, faltó descuento...'}
              rows={3}
              className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white
                placeholder:text-kp-gray focus:outline-none focus:border-sky-500 transition-colors resize-none"
            />
            <p className="text-2xs md:text-[11px] text-kp-gray/70 mt-1">Le llega al administrador como aviso en las notificaciones.</p>
          </div>

          {error && (
            <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={cerrar}
              className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white hover:border-kp-gray transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !monto || !motivo.trim()}
              className="flex-1 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>

        </form>

      </Modal>
    </>
  );
}
