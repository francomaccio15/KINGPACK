'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';
import { useAuth } from '@/contexts/AuthContext';
import { filtrarMediosPorRol } from '@/lib/mediosPago';
import Modal from '@/components/ui/Modal';
import ChequeDatosExtra from '@/components/cheques/ChequeDatosExtra';
import { type ChequeExtra, chequeExtraVacio, errorCheque, chequeExtraPayload } from '@/lib/cheques';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });

// En el cobro a clientes no se usan estos medios: las cajas fuertes son
// movimientos internos, y Mercado Pago / Tarjeta de Crédito no se cobran por
// este circuito. Se ocultan del selector para todos los roles.
const MEDIOS_OCULTOS_PAGO = ['efectivo caja fuerte', 'mercado pago', 'tarjeta de crédito', 'tarjeta de credito'];

// Medios que van contra el banco: hay que elegir a qué cuenta entra la plata y,
// al confirmar, se acredita el saldo de esa cuenta. Transferencia ya lo pide por
// su flag en la base; QR y Tarjeta de Débito se suman por nombre.
const MEDIOS_REQUIEREN_CUENTA = ['qr', 'tarjeta de débito', 'tarjeta de debito'];

interface MedioPago { id: string; nombre: string; requiere_cuenta?: boolean }
interface CuentaBancaria { id: string; nombre: string; banco?: string | null }
interface ClienteBusqueda { id: string; razon_social: string; cuit?: string | null; saldo_actual?: string | number }
/** Otro cliente al que el mismo cheque le paga una parte. */
interface OtroCliente { key: number; cliente: ClienteBusqueda | null; monto: string }

const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors';

// Buscador de cliente para una fila del reparto del cheque.
function BuscarCliente({ excluir, onElegir }: { excluir: string[]; onElegir: (c: ClienteBusqueda) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ClienteBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ q: q.trim(), limit: '10', sucursal_id: '' });
        const r = await apiFetch(`/api/clientes?${params}`);
        const d = r.ok ? await r.json() : { clientes: [] };
        setRes((d.clientes ?? []).filter((c: ClienteBusqueda) => !excluir.includes(c.id)));
      } catch { setRes([]); } finally { setBuscando(false); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente por nombre o CUIT…" className={inputCls} />
      {(res.length > 0 || buscando) && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-kp-border bg-kp-surface shadow-lg">
          {buscando && <div className="px-3 py-2 text-xs text-kp-gray">Buscando…</div>}
          {res.map(c => (
            <button key={c.id} type="button" onClick={() => { onElegir(c); setQ(''); setRes([]); }}
              className="block w-full text-left px-3 py-2 text-sm text-kp-white hover:bg-kp-surface2">
              {c.razon_social}
              {c.cuit && <span className="ml-2 text-xs text-kp-gray">{c.cuit}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegistrarPago({
  clienteId,
  saldoActual,
  sucursalId,
  clienteNombre,
  clienteCuit,
}: {
  clienteId: string;
  saldoActual: number;
  sucursalId?: string;
  /** Proponen el librador del cheque: casi siempre lo firma quien paga. */
  clienteNombre?: string;
  clienteCuit?: string | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [monto, setMonto]           = useState('');
  const [concepto, setConcepto]     = useState('');
  const [medioPagoId, setMedioPagoId] = useState('');
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  // Cuenta a la que entra la plata cuando el cobro es por transferencia.
  const [cuentas, setCuentas]       = useState<CuentaBancaria[]>([]);
  const [cuentaId, setCuentaId]     = useState('');

  // Datos del cheque (solo si el método es Cheque)
  const [chBanco, setChBanco]       = useState('');
  const [chNumero, setChNumero]     = useState('');
  const [chEmision, setChEmision]   = useState('');
  const [chVenc, setChVenc]         = useState('');
  const extraInicial = (): ChequeExtra => ({
    ...chequeExtraVacio(),
    librador_nombre: clienteNombre ?? '',
    librador_cuit: clienteCuit ?? '',
  });
  const [chExtra, setChExtra]       = useState<ChequeExtra>(extraInicial);
  // Reparto del mismo cheque entre otros clientes (ej.: una empresa que paga
  // también lo de otra). Cada fila es la parte que le corresponde a ese cliente.
  const [otros, setOtros]           = useState<OtroCliente[]>([]);
  const otrosKey                    = useRef(0);

  const medioElegido = mediosPago.find(m => m.id === medioPagoId);
  const esCheque      = /cheque/i.test(medioElegido?.nombre ?? '');
  const requiereCuenta = !!medioElegido && (
    medioElegido.requiere_cuenta === true ||
    MEDIOS_REQUIEREN_CUENTA.includes(medioElegido.nombre.trim().toLowerCase())
  );

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
        if (lista.length > 0 && !medioPagoId) setMedioPagoId(lista[0].id);
      })
      .catch(() => {});
    apiFetch('/api/cuentas-bancarias')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setCuentas(d.cuentas ?? []))
      .catch(() => {});
  }, [open, user?.rol]);

  // Al cambiar a un medio que no va contra el banco, limpiar la cuenta elegida.
  useEffect(() => { if (!requiereCuenta) setCuentaId(''); }, [requiereCuenta]);

  const cerrar = () => {
    setOpen(false);
    setError('');
    setMonto('');
    setConcepto('');
    setMedioPagoId('');
    setCuentaId('');
    setChBanco(''); setChNumero(''); setChEmision(''); setChVenc('');
    setChExtra(extraInicial());
    setOtros([]);
  };

  const agregarOtro = () => setOtros(p => [...p, { key: ++otrosKey.current, cliente: null, monto: '' }]);
  const cambiarOtro = (key: number, c: Partial<OtroCliente>) =>
    setOtros(p => p.map(o => o.key === key ? { ...o, ...c } : o));
  const quitarOtro = (key: number) => setOtros(p => p.filter(o => o.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medioPagoId) { setError('Seleccioná un método de pago'); return; }
    if (requiereCuenta && !cuentaId) { setError('Seleccioná la cuenta que recibe el pago'); return; }
    if (esCheque) {
      const err = errorCheque({
        ...chExtra, fecha_emision: chEmision,
        banco: chBanco, numero_cheque: chNumero, fecha_vencimiento: chVenc,
      }, 'recibido');
      if (err) { setError(`Cheque: ${err}`); return; }
      for (const [i, o] of otros.entries()) {
        if (!o.cliente) { setError(`Cliente adicional ${i + 1}: elegí el cliente`); return; }
        if (!(parseFloat(o.monto) > 0)) { setError(`${o.cliente.razon_social}: ingresá el monto que le corresponde`); return; }
      }
    }
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
          cuenta_bancaria_id: cuentaId || null,
          cheque: esCheque
            ? {
                banco: chBanco.trim(), numero_cheque: chNumero.trim(), fecha_vencimiento: chVenc,
                ...chequeExtraPayload({ ...chExtra, fecha_emision: chEmision }, 'recibido'),
              }
            : undefined,
          otros_clientes: esCheque && otros.length
            ? otros.map(o => ({ cliente_id: o.cliente!.id, monto: (parseFloat(o.monto) || 0).toFixed(2) }))
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
  const repartido  = esCheque && otros.length > 0;
  const totalCheque = montoNum + otros.reduce((s, o) => s + (parseFloat(o.monto) || 0), 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
          bg-green-700 hover:bg-green-600 transition-colors text-white text-sm font-semibold"
      >
        + Registrar Pago
      </button>

      <Modal
        open={open}
        onClose={cerrar}
        title="Registrar Pago"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto">

          {/* Saldo actual */}
          <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
            <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo actual</span>
            <span className={`font-bold tabular-nums ${saldoActual > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {ars.format(saldoActual)}
            </span>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">
              {repartido ? `Monto para ${clienteNombre ?? 'este cliente'} *` : 'Monto *'}
            </label>
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

          {/* Cuenta destino: sólo para medios que van contra el banco */}
          {requiereCuenta && (
            <div>
              <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Cuenta que recibe *</label>
              <select value={cuentaId} onChange={e => setCuentaId(e.target.value)}
                className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-green-500 transition-colors">
                <option value="">Seleccioná la cuenta</option>
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.banco ? ` — ${c.banco}` : ''}</option>
                ))}
              </select>
              <p className="mt-1 text-2xs md:text-[11px] text-kp-gray">Se acredita en el saldo de esa cuenta.</p>
            </div>
          )}

          {/* Datos del cheque */}
          {esCheque && (
            <div className="space-y-3 rounded-xl border border-kp-border bg-kp-surface2/40 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Datos del cheque</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs md:text-[11px] text-kp-gray uppercase tracking-widest mb-1">Banco</label>
                  <input value={chBanco} onChange={e => setChBanco(e.target.value)} placeholder="Banco"
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-2xs md:text-[11px] text-kp-gray uppercase tracking-widest mb-1">Nº Cheque</label>
                  <input value={chNumero} onChange={e => setChNumero(e.target.value)} placeholder="00000000"
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-2xs md:text-[11px] text-kp-gray uppercase tracking-widest mb-1">Fecha emisión *</label>
                  <input type="date" value={chEmision} onChange={e => setChEmision(e.target.value)}
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-green-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-2xs md:text-[11px] text-kp-gray uppercase tracking-widest mb-1">Fecha de pago *</label>
                  <input type="date" value={chVenc} onChange={e => setChVenc(e.target.value)}
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-green-500 transition-colors" />
                </div>
              </div>
              <ChequeDatosExtra value={chExtra} onChange={c => setChExtra(p => ({ ...p, ...c }))} tipo="recibido"
                conEmision={false} fechaVencimiento={chVenc} />

              {/* Reparto: el mismo cheque paga también a otros clientes */}
              <div className="space-y-2 border-t border-kp-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xs md:text-[11px] text-kp-gray uppercase tracking-widest">¿Paga también a otros clientes?</p>
                  <button type="button" onClick={agregarOtro}
                    className="text-xs font-semibold text-green-400 hover:text-green-300">+ Agregar cliente</button>
                </div>
                {otros.map(o => (
                  <div key={o.key} className="rounded-lg border border-kp-border bg-kp-surface2/60 p-2 space-y-2">
                    {o.cliente ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-kp-white truncate">{o.cliente.razon_social}</p>
                          {o.cliente.saldo_actual != null && (
                            <p className="text-2xs md:text-[11px] text-kp-gray">Saldo: {ars.format(parseFloat(String(o.cliente.saldo_actual)) || 0)}</p>
                          )}
                        </div>
                        <button type="button" onClick={() => cambiarOtro(o.key, { cliente: null })}
                          className="text-xs text-kp-gray hover:text-kp-white">Cambiar</button>
                      </div>
                    ) : (
                      <BuscarCliente
                        excluir={[clienteId, ...otros.map(x => x.cliente?.id).filter((x): x is string => !!x)]}
                        onElegir={c => cambiarOtro(o.key, { cliente: c })} />
                    )}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                        <NumericInput value={o.monto} onChange={e => cambiarOtro(o.key, { monto: e.target.value })}
                          placeholder="Monto para este cliente" className={`${inputCls} pl-6`} />
                      </div>
                      <button type="button" onClick={() => quitarOtro(o.key)} aria-label="Quitar cliente"
                        className="px-2 py-2 text-kp-gray hover:text-kp-red text-sm">✕</button>
                    </div>
                  </div>
                ))}
                {repartido && (
                  <div className="flex justify-between items-center rounded-lg bg-green-500/10 border border-green-700/40 px-3 py-2">
                    <span className="text-xs text-kp-gray uppercase tracking-widest">Importe del cheque</span>
                    <span className="font-bold tabular-nums text-green-300">{ars.format(totalCheque)}</span>
                  </div>
                )}
              </div>

              <p className="text-2xs md:text-[11px] text-kp-gray/70">
                {repartido
                  ? 'Queda un solo cheque en cartera por el total; a cada cliente se le descuenta su parte de la cuenta corriente.'
                  : 'Queda registrado como cheque en cartera en el módulo Cheques.'}
              </p>
            </div>
          )}

          {/* Concepto */}
          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Concepto (opcional)</label>
            <input
              value={concepto} onChange={e => setConcepto(e.target.value)}
              placeholder="ej: Pago cuota septiembre..."
              className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white
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
          
      </Modal>
    </>
  );
}
