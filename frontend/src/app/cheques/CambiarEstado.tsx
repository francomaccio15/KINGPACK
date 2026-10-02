'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import Modal from '@/components/ui/Modal';
import { CAUSALES_RECHAZO, formatoFecha } from '@/lib/cheques';

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

interface Opcion { id: string; nombre: string; esCheques?: boolean }

const hoyISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

export default function CambiarEstado({ chequeId, tipo, estadoActual }: Props) {
  const router = useRouter();
  const [open,        setOpen]        = useState(false);
  const [paso,        setPaso]        = useState<'form' | 'confirmar'>('form');
  const [estadoNuevo, setEstadoNuevo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [fechaEstado, setFechaEstado] = useState('');
  // Datos propios de cada transición
  const [cuentaId,       setCuentaId]       = useState('');
  const [proveedorId,    setProveedorId]    = useState('');
  const [endosoFecha,    setEndosoFecha]    = useState('');
  const [endosoComprob,  setEndosoComprob]  = useState('');
  const [causal,         setCausal]         = useState('');

  const [cuentas,     setCuentas]     = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const esDeposito = tipo === 'recibido' && estadoNuevo === 'depositado';
  const esEndoso   = tipo === 'recibido' && estadoNuevo === 'endosado';
  const esRechazo  = estadoNuevo === 'rechazado';

  // Catálogos solo cuando la transición los necesita.
  useEffect(() => {
    if (esDeposito && cuentas.length === 0) {
      apiFetch('/api/cuentas-bancarias').then(r => r.json()).then(d => {
        const arr: Opcion[] = (d.cuentas ?? []).map((c: any) => ({ id: c.id, nombre: c.nombre, esCheques: c.es_cuenta_cheques }));
        setCuentas(arr);
        // Por defecto la cuenta de cheques: es donde caen siempre hoy.
        setCuentaId(prev => prev || arr.find(c => c.esCheques)?.id || '');
      }).catch(() => {});
    }
    if (esEndoso && proveedores.length === 0) {
      apiFetch('/api/proveedores?limit=5000').then(r => r.json()).then(d => {
        setProveedores((d.proveedores ?? []).map((p: any) => ({ id: p.id, nombre: p.razon_social })));
      }).catch(() => {});
    }
    if (esEndoso && !endosoFecha) setEndosoFecha(hoyISO());
  }, [esDeposito, esEndoso]); // eslint-disable-line react-hooks/exhaustive-deps

  const siguientes = TRANSICIONES[tipo]?.[estadoActual] ?? [];
  if (siguientes.length === 0) return null;

  const cerrar = () => {
    setOpen(false);
    setPaso('form');
    setEstadoNuevo(''); setObservacion(''); setFechaEstado('');
    setProveedorId(''); setEndosoFecha(''); setEndosoComprob(''); setCausal('');
    setError('');
  };

  const revisar = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!estadoNuevo) return setError('Seleccioná un estado');
    if (esEndoso) {
      if (!proveedorId)          return setError('Indicá el proveedor que recibe el cheque');
      if (!endosoFecha)          return setError('Indicá la fecha de entrega');
      if (!endosoComprob.trim()) return setError('Indicá la orden de pago o factura que cancela');
    }
    if (esRechazo) {
      if (!causal) return setError('Indicá la causal del rechazo');
      if (causal === 'otro' && !observacion.trim()) return setError('Causal "Otro": detallá el motivo en la observación');
    }
    setPaso('confirmar');
  };

  const confirmar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/cheques/${tipo}/${chequeId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado_nuevo: estadoNuevo,
          observacion: observacion.trim() || undefined,
          fecha_estado: fechaEstado || undefined,
          ...(esDeposito && cuentaId ? { deposito_cuenta_id: cuentaId } : {}),
          ...(esEndoso ? {
            endoso_proveedor_id: proveedorId,
            endoso_fecha: endosoFecha,
            endoso_comprobante: endosoComprob.trim(),
          } : {}),
          ...(esRechazo ? { rechazo_causal: causal } : {}),
        }),
      });
      // apiFetch no lanza en 4xx: hay que mirar res.ok o un rechazo del backend
      // (transición inválida, dato faltante) pasa como éxito.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Error al cambiar estado');
        setPaso('form');
        return;
      }
      cerrar();
      router.refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red';
  const labelCls = 'text-xs text-kp-gray font-medium';

  const resumen: [string, React.ReactNode][] = [
    ['Cambio', <><b>{LABEL_ESTADO[estadoActual] ?? estadoActual}</b> → <b>{LABEL_ESTADO[estadoNuevo] ?? estadoNuevo}</b></>],
    ['Fecha', formatoFecha(fechaEstado || hoyISO())],
    ...(esDeposito ? [['Cuenta de depósito', cuentas.find(c => c.id === cuentaId)?.nombre ?? 'Cuenta de cheques']] as [string, React.ReactNode][] : []),
    ...(esEndoso ? [
      ['Proveedor', proveedores.find(p => p.id === proveedorId)?.nombre ?? '—'],
      ['Entregado el', formatoFecha(endosoFecha)],
      ['Cancela', endosoComprob.trim()],
    ] as [string, React.ReactNode][] : []),
    ...(esRechazo ? [['Causal', <b className="text-red-400">{CAUSALES_RECHAZO[causal]}</b>]] as [string, React.ReactNode][] : []),
    ...(observacion.trim() ? [['Observación', observacion.trim()]] as [string, React.ReactNode][] : []),
  ];

  // Qué impacta la operación, dicho antes de confirmar.
  const efecto =
    (tipo === 'recibido' && estadoNuevo === 'acreditado') ? 'Se acredita el importe en la cuenta de depósito.' :
    (tipo === 'emitido'  && estadoNuevo === 'debitado')   ? 'Se debita el importe de la cuenta de cheques.' :
    (tipo === 'recibido' && esRechazo) ? 'Si el cheque vino de una venta, se registra un egreso compensatorio en la caja abierta.' :
    esEndoso ? 'El cheque sale de cartera. No mueve banco ni caja.' :
    null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-kp-border text-kp-gray-lt hover:text-kp-white hover:border-kp-white transition-colors"
      >
        Cambiar estado
      </button>

      <Modal
          open={open}
          onClose={cerrar}
          title={paso === 'form' ? 'Cambiar estado del cheque' : 'Confirmar cambio de estado'}
          size="md"
        >

        {paso === 'confirmar' ? (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <tbody>
                {resumen.map(([k, v]) => (
                  <tr key={k} className="border-b border-kp-border/60 last:border-0">
                    <td className="py-1.5 pr-3 text-xs text-kp-gray whitespace-nowrap align-top">{k}</td>
                    <td className="py-1.5 text-kp-white">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {efecto && <p className="text-xs text-amber-400">{efecto}</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={confirmar}
                disabled={loading}
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando…' : 'Confirmar cambio'}
              </button>
              <button
                type="button"
                onClick={() => setPaso('form')}
                disabled={loading}
                className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
              >
                Corregir
              </button>
            </div>
          </div>
        ) : (
          <>
          <p className="text-sm text-kp-gray">
            Estado actual: <span className="font-semibold text-kp-white">{LABEL_ESTADO[estadoActual] ?? estadoActual}</span>
          </p>

          <form onSubmit={revisar} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Nuevo estado *</label>
              <select value={estadoNuevo} onChange={e => setEstadoNuevo(e.target.value)} className={inputCls}>
                <option value="">Seleccionar…</option>
                {siguientes.map(s => (
                  <option key={s} value={s}>{LABEL_ESTADO[s] ?? s}</option>
                ))}
              </select>
            </div>

            {esDeposito && (
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Cuenta de depósito</label>
                <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={inputCls}>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.esCheques ? ' (cuenta de cheques)' : ''}</option>
                  ))}
                </select>
                <span className="text-[11px] text-kp-gray">Al acreditarse, el importe entra en esta cuenta.</span>
              </div>
            )}

            {esEndoso && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 col-span-2">
                  <label className={labelCls}>Proveedor que lo recibe *</label>
                  <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className={inputCls}>
                    <option value="">Seleccionar…</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Fecha de entrega *</label>
                  <input type="date" value={endosoFecha} onChange={e => setEndosoFecha(e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Orden de pago / factura *</label>
                  <input value={endosoComprob} onChange={e => setEndosoComprob(e.target.value)} maxLength={50}
                    placeholder="OP 0001-00001234" className={inputCls} />
                </div>
              </div>
            )}

            {esRechazo && (
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Causal del rechazo *</label>
                <select value={causal} onChange={e => setCausal(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar…</option>
                  {Object.entries(CAUSALES_RECHAZO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Fecha del cambio</label>
              <input type="date" value={fechaEstado} onChange={e => setFechaEstado(e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls}>Observación{causal === 'otro' ? ' *' : ''}</label>
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
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors"
              >
                Revisar
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
          </>
        )}

        </Modal>
    </>
  );
}
