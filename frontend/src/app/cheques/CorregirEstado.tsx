'use client';

// Corrección de un estado cargado por error (solo administrador). Deshace lo
// que el estado actual impactó (banco, endoso, caja del rechazo) y aplica el
// nuevo. Endosar/rechazar van por "Cambiar estado".

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';

const CORREGIBLES: Record<'recibido' | 'emitido', string[]> = {
  recibido: ['en_cartera', 'depositado', 'acreditado', 'anulado'],
  emitido:  ['emitido', 'presentado', 'debitado', 'anulado'],
};

const LABEL: Record<string, string> = {
  en_cartera: 'En Cartera', depositado: 'Depositado', acreditado: 'Acreditado',
  endosado: 'Endosado', rechazado: 'Rechazado', anulado: 'Anulado',
  emitido: 'Emitido', presentado: 'Presentado', debitado: 'Debitado',
};

interface Props {
  chequeId: string;
  tipo: 'recibido' | 'emitido';
  estadoActual: string;
}

// Lo que va a pasar con la plata, dicho antes de confirmar. Mismo criterio que
// el backend (POST /corregir-estado).
function efectos(tipo: 'recibido' | 'emitido', actual: string, nuevo: string): string[] {
  const e: string[] = [];
  const conBanco = (s: string) => (tipo === 'recibido' ? s === 'acreditado' : s === 'debitado');
  if (conBanco(actual) && !conBanco(nuevo)) {
    e.push(tipo === 'recibido' ? 'Se quita el ingreso del banco.' : 'Se devuelve al banco el importe debitado.');
  }
  if (!conBanco(actual) && conBanco(nuevo)) {
    e.push(tipo === 'recibido' ? 'Se acredita el importe en el banco.' : 'Se debita el importe del banco.');
  }
  if (actual === 'endosado') e.push('Se deshace el endoso (proveedor, fecha y comprobante).');
  if (actual === 'rechazado') e.push('Se borra la causal y, si vino de una venta, se compensa el egreso de caja del rechazo.');
  return e;
}

export default function CorregirEstado({ chequeId, tipo, estadoActual }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState<'form' | 'confirmar'>('form');
  const [estadoNuevo, setEstadoNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user?.rol !== 'administrador') return null;
  const opciones = CORREGIBLES[tipo].filter(s => s !== estadoActual);

  const cerrar = () => {
    setOpen(false); setPaso('form');
    setEstadoNuevo(''); setMotivo(''); setError('');
  };

  const revisar = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!estadoNuevo) return setError('Elegí el estado correcto');
    if (!motivo.trim()) return setError('Indicá el motivo de la corrección');
    setPaso('confirmar');
  };

  const confirmar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/cheques/${tipo}/${chequeId}/corregir-estado`, {
        method: 'POST',
        body: JSON.stringify({ estado_nuevo: estadoNuevo, motivo: motivo.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'No se pudo corregir el estado');
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
  const listaEfectos = estadoNuevo ? efectos(tipo, estadoActual, estadoNuevo) : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Corregir un estado cargado por error"
        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-700/60 text-amber-400 hover:text-amber-300 hover:border-amber-500 transition-colors"
      >
        Corregir
      </button>

      <Modal
        open={open}
        onClose={cerrar}
        title={paso === 'form' ? 'Corregir estado del cheque' : 'Confirmar corrección'}
        size="md"
      >
        {paso === 'confirmar' ? (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-kp-border/60">
                  <td className="py-1.5 pr-3 text-xs text-kp-gray whitespace-nowrap">Corrección</td>
                  <td className="py-1.5 text-kp-white"><b>{LABEL[estadoActual] ?? estadoActual}</b> → <b>{LABEL[estadoNuevo]}</b></td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-xs text-kp-gray whitespace-nowrap align-top">Motivo</td>
                  <td className="py-1.5 text-kp-white">{motivo.trim()}</td>
                </tr>
              </tbody>
            </table>
            {listaEfectos.length > 0 ? (
              <ul className="text-xs text-amber-400 space-y-1 list-disc pl-4">
                {listaEfectos.map(e => <li key={e}>{e}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-kp-gray">No mueve banco ni caja.</p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={confirmar} disabled={loading}
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50">
                {loading ? 'Corrigiendo…' : 'Confirmar corrección'}
              </button>
              <button type="button" onClick={() => setPaso('form')} disabled={loading}
                className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors">
                Volver
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={revisar} className="space-y-3">
            <p className="text-sm text-kp-gray">
              Estado actual: <span className="font-semibold text-kp-white">{LABEL[estadoActual] ?? estadoActual}</span>
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kp-gray font-medium">Estado correcto *</label>
              <select value={estadoNuevo} onChange={e => setEstadoNuevo(e.target.value)} className={inputCls}>
                <option value="">Seleccionar…</option>
                {opciones.map(s => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
              <span className="text-[11px] text-kp-gray">
                Para endosar o rechazar, primero volvelo a {tipo === 'recibido' ? 'En Cartera' : 'Emitido'} y usá “Cambiar estado”.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-kp-gray font-medium">Motivo *</label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
                placeholder="Ej: se marcó acreditado por error, el banco todavía no lo pagó"
                className="px-3 py-2 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red resize-none" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit"
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors">
                Revisar
              </button>
              <button type="button" onClick={cerrar}
                className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
