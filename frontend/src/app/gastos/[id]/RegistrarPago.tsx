'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';
import Modal from '@/components/ui/Modal';
import ChequeDatosExtra from '@/components/cheques/ChequeDatosExtra';
import EndosoCartera, { type ChequeCartera, endososPayload, totalEndosos } from '@/components/cheques/EndosoCartera';
import { type ChequeExtra, chequeExtraVacio, errorCheque, chequeExtraPayload } from '@/lib/cheques';

type MedioPago = { id: string; nombre: string };
type CuentaBancaria = { id: string; nombre: string; banco: string | null };
type Cheque = ChequeExtra & { banco: string; numero_cheque: string; fecha_vencimiento: string; importe: string };
type PagoACuenta = { id: string; fecha: string; monto: string; sin_imputar: string; medio_pago_nombre: string; observaciones: string | null };

const ars = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(String(n)) || 0);
const fechaAR = (f: string) => { const [y, m, d] = String(f).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

type Props = {
  egresoId: string;
  totalEgreso: number;
  totalPagado: number;
  mediosPago: MedioPago[];
  cuentasBancarias: CuentaBancaria[];
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
const labelCls = 'block text-xs text-kp-gray font-semibold uppercase tracking-wide mb-1';

const emptyCheque = (): Cheque => ({ ...chequeExtraVacio(), banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' });

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
  // Cheque propio nuevo o cheques de clientes en cartera que se endosan.
  const [chequeModo, setChequeModo] = useState<'nuevo' | 'endoso'>('nuevo');
  const [endosos, setEndosos] = useState<ChequeCartera[]>([]);

  const selectedMedio = mediosPago.find(m => m.id === medioPagoId);
  const esCheque = selectedMedio?.nombre.toLowerCase().includes('cheque') ?? false;
  const esEndoso = esCheque && chequeModo === 'endoso';

  // Pagos a cuenta del proveedor todavía sin imputar: si hay, casi seguro que
  // este comprobante ya está pagado con esa plata. Se ofrece imputarlo y, para
  // pagar igual, hay que confirmarlo (el backend también lo exige).
  const [aCuenta, setACuenta] = useState<PagoACuenta[]>([]);
  const [confirmarNuevo, setConfirmarNuevo] = useState(false);
  const [imputandoId, setImputandoId] = useState<string | null>(null);
  const esAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('kp_user') || '{}')?.rol === 'administrador'; } catch { return false; }
  })();

  const cargarACuenta = async () => {
    try {
      const r = await apiFetch(`/api/egresos/${egresoId}/pagos-a-cuenta`);
      const d = r.ok ? await r.json() : { pagos: [] };
      setACuenta(d.pagos ?? []);
    } catch { setACuenta([]); }
  };

  const imputar = async (p: PagoACuenta) => {
    const monto = +Math.min(parseFloat(p.sin_imputar), pendiente).toFixed(2);
    if (monto <= 0) return;
    setImputandoId(p.id);
    setError('');
    try {
      const res = await apiFetch(`/api/pagos-proveedor/${p.id}/imputar`, {
        method: 'POST',
        body: JSON.stringify({ aplicaciones: [{ egreso_id: egresoId, monto }], reclasificar: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo imputar el pago a cuenta'); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setImputandoId(null);
    }
  };

  const handleOpen = () => {
    setACuenta([]);
    setConfirmarNuevo(false);
    cargarACuenta();
    setMonto(pendiente.toFixed(2));
    setMedioPagoId(mediosPago[0]?.id ?? '');
    setCuentaBancariaId('');
    setObservaciones('');
    setCheques([emptyCheque()]);
    setChequeModo('nuevo');
    setEndosos([]);
    setError('');
    setOpen(true);
  };

  const handleClose = () => { if (!loading) setOpen(false); };

  const addCheque = () => setCheques(prev => [...prev, emptyCheque()]);
  const removeCheque = (i: number) => setCheques(prev => prev.filter((_, idx) => idx !== i));
  const updateCheque = (i: number, field: keyof Cheque, value: string) =>
    setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  const patchCheque = (i: number, cambios: Partial<Cheque>) =>
    setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, ...cambios } : c));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aCuenta.length > 0 && !confirmarNuevo) {
      setError('El proveedor tiene pagos a cuenta sin imputar: imputá uno a este comprobante o tildá que es un pago nuevo.');
      return;
    }
    if (!medioPagoId) { setError('Seleccioná un medio de pago'); return; }
    if (esEndoso && endosos.length === 0) { setError('Elegí los cheques en cartera a endosar'); return; }
    // Endosando, el pago es lo que suman los cheques elegidos.
    const montoNum = esEndoso ? +totalEndosos(endosos).toFixed(2) : parseFloat(monto);
    if (!montoNum || montoNum <= 0) { setError('El monto debe ser mayor a 0'); return; }
    // El backend rechaza el pago si supera el saldo: avisamos antes de mandarlo.
    if (montoNum - pendiente > 0.01) {
      setError(`El monto supera el saldo pendiente del comprobante (${pendiente.toFixed(2)})`);
      return;
    }

    const body: Record<string, unknown> = {
      medio_pago_id: medioPagoId,
      monto: montoNum,
      cuenta_bancaria_id: cuentaBancariaId || null,
      observaciones: observaciones.trim() || null,
      ...(confirmarNuevo ? { confirmar_saldo_a_favor: true } : {}),
    };

    if (esEndoso) {
      body.endosos = endososPayload(endosos);
    } else if (esCheque) {
      // Una fila con algún dato cargado cuenta como cheque y tiene que estar completa.
      const chequesValidos = cheques.filter(c => c.banco || c.numero_cheque || c.importe);
      if (chequesValidos.length === 0) { setError('Completá al menos un cheque'); return; }
      for (const [i, c] of chequesValidos.entries()) {
        const err = errorCheque(c, 'emitido');
        if (err) { setError(`Cheque #${i + 1}: ${err}`); return; }
      }
      // Los cheques cargados tienen que dar el monto del pago, como en Pago a
      // Proveedores: si no, el comprobante queda saldado por un importe y los
      // cheques que vencen dicen otro.
      const sumaCheques = chequesValidos.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
      if (Math.abs(sumaCheques - montoNum) > 0.01) {
        setError(`Los cheques suman ${sumaCheques.toFixed(2)} y el pago es de ${montoNum.toFixed(2)}`);
        return;
      }
      body.cheques = chequesValidos.map(c => ({
        banco: c.banco.trim(), numero_cheque: c.numero_cheque.trim(),
        fecha_vencimiento: c.fecha_vencimiento, importe: c.importe,
        ...chequeExtraPayload(c, 'emitido'),
      }));
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/egresos/${egresoId}/pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Pago a cuenta cargado mientras el modal estaba abierto: mostrarlo.
        if (data.codigo === 'saldo_a_favor') setACuenta(data.pagos_a_cuenta ?? []);
        setError(data.error || 'Error al registrar el pago');
        return;
      }
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

      <Modal
          open={open}
          onClose={handleClose}
          title="Registrar Pago"
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {aCuenta.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-sm">
                <p className="font-semibold text-amber-400">
                  ⚠ Este proveedor tiene pagos a cuenta sin imputar
                </p>
                <p className="text-xs text-kp-gray">
                  Probablemente este comprobante ya está pagado con esa plata. Imputalo en vez de pagarlo de nuevo.
                </p>
                <ul className="space-y-1.5">
                  {aCuenta.map(p => (
                    <li key={p.id} className="flex items-center gap-2 flex-wrap">
                      <span className="tabular-nums">{fechaAR(p.fecha)}</span>
                      <span className="text-kp-gray">· {p.medio_pago_nombre}</span>
                      <span className="font-semibold tabular-nums">{ars(p.sin_imputar)}</span>
                      <span className="text-kp-gray text-xs">sin imputar</span>
                      {esAdmin ? (
                        <button type="button" onClick={() => imputar(p)} disabled={!!imputandoId}
                          className="ml-auto px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50">
                          {imputandoId === p.id ? 'Imputando…' : `Imputar ${ars(Math.min(parseFloat(p.sin_imputar), pendiente))}`}
                        </button>
                      ) : (
                        <span className="ml-auto text-xs text-kp-gray">Pedile al administrador que lo impute</span>
                      )}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-xs text-kp-gray pt-1 cursor-pointer">
                  <input type="checkbox" checked={confirmarNuevo} onChange={e => setConfirmarNuevo(e.target.checked)} />
                  Es un pago nuevo, distinto de esos pagos a cuenta: registrarlo igual
                </label>
              </div>
            )}

            <div>
              <label className={labelCls}>Medio de Pago *</label>
              <select value={medioPagoId} onChange={e => setMedioPagoId(e.target.value)} className={inputCls} required>
                <option value="">Seleccioná</option>
                {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Monto *</label>
              {esEndoso ? (
                <p className={inputCls + ' tabular-nums'}>
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalEndosos(endosos))}
                  <span className="text-xs text-kp-gray"> · suma de los cheques elegidos</span>
                </p>
              ) : (
                <NumericInput
                  value={monto} onChange={e => setMonto(e.target.value)}
                  className={inputCls} required
                />
              )}
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
              <div className="flex items-center gap-2 flex-wrap">
                {(['nuevo', 'endoso'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setChequeModo(m)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      chequeModo === m
                        ? 'border-kp-red bg-kp-red/10 text-kp-white'
                        : 'border-kp-border text-kp-gray hover:text-kp-white'}`}>
                    {m === 'nuevo' ? 'Emitir cheque propio' : 'Endosar cheques de cartera'}
                  </button>
                ))}
              </div>
            )}

            {esEndoso && (
              <EndosoCartera value={endosos} onChange={setEndosos} objetivo={pendiente} />
            )}

            {esCheque && !esEndoso && (
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
                        <label className={labelCls}>Fecha de Emisión</label>
                        <input type="date" value={ch.fecha_emision} onChange={e => updateCheque(i, 'fecha_emision', e.target.value)}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Fecha de Vencimiento</label>
                        <input type="date" value={ch.fecha_vencimiento} onChange={e => updateCheque(i, 'fecha_vencimiento', e.target.value)}
                          className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Importe</label>
                        <NumericInput value={ch.importe} onChange={e => updateCheque(i, 'importe', e.target.value)}
                          className={inputCls} />
                      </div>
                    </div>
                    <ChequeDatosExtra value={ch} onChange={c => patchCheque(i, c)} tipo="emitido"
                      conEmision={false} fechaVencimiento={ch.fecha_vencimiento} />
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

        </Modal>
    </>
  );
}
