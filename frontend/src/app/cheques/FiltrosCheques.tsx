'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ESTADOS_RECIBIDO = ['en_cartera','depositado','acreditado','endosado','rechazado','anulado'];
const ESTADOS_EMITIDO  = ['emitido','presentado','debitado','rechazado','anulado'];

const LABEL_ESTADO: Record<string, string> = {
  en_cartera:  'En Cartera',
  depositado:  'Depositado',
  acreditado:  'Acreditado',
  endosado:    'Endosado',
  rechazado:   'Rechazado',
  anulado:     'Anulado',
  emitido:     'Emitido',
  presentado:  'Presentado',
  debitado:    'Debitado',
};

interface Props {
  defaultBanco?:    string;
  defaultEstado?:   string;
  defaultFechaDesde?: string;
  defaultFechaHasta?: string;
  tipoActivo: string;
}

export default function FiltrosCheques({
  defaultBanco, defaultEstado, defaultFechaDesde, defaultFechaHasta, tipoActivo,
}: Props) {
  const router = useRouter();
  const [banco,       setBanco]       = useState(defaultBanco       || '');
  const [estado,      setEstado]      = useState(defaultEstado      || '');
  const [fechaDesde,  setFechaDesde]  = useState(defaultFechaDesde  || '');
  const [fechaHasta,  setFechaHasta]  = useState(defaultFechaHasta  || '');

  const estados = tipoActivo === 'recibido' ? ESTADOS_RECIBIDO
                : tipoActivo === 'emitido'  ? ESTADOS_EMITIDO
                : [...new Set([...ESTADOS_RECIBIDO, ...ESTADOS_EMITIDO])];

  const aplicar = () => {
    const p = new URLSearchParams();
    if (tipoActivo !== 'todos') p.set('tipo', tipoActivo);
    if (banco)      p.set('banco',            banco.trim());
    if (estado)     p.set('estado',           estado);
    if (fechaDesde) p.set('fecha_venc_desde', fechaDesde);
    if (fechaHasta) p.set('fecha_venc_hasta', fechaHasta);
    router.push(`/cheques?${p}`);
  };

  const limpiar = () => {
    setBanco(''); setEstado(''); setFechaDesde(''); setFechaHasta('');
    const p = new URLSearchParams();
    if (tipoActivo !== 'todos') p.set('tipo', tipoActivo);
    router.push(`/cheques?${p}`);
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-kp-gray font-medium">Banco</label>
        <input
          type="text"
          placeholder="Buscar banco..."
          value={banco}
          onChange={e => setBanco(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && aplicar()}
          className="h-9 px-3 text-sm rounded-md bg-kp-surface border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red w-48"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-kp-gray font-medium">Estado</label>
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          className="h-9 px-3 text-sm rounded-md bg-kp-surface border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
        >
          <option value="">Todos los estados</option>
          {estados.map(e => (
            <option key={e} value={e}>{LABEL_ESTADO[e] ?? e}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-kp-gray font-medium">Vence desde</label>
        <input
          type="date"
          value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)}
          className="h-9 px-3 text-sm rounded-md bg-kp-surface border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-kp-gray font-medium">Vence hasta</label>
        <input
          type="date"
          value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)}
          className="h-9 px-3 text-sm rounded-md bg-kp-surface border border-kp-border text-kp-white focus:outline-none focus:border-kp-red"
        />
      </div>

      <button
        onClick={aplicar}
        className="h-9 px-4 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors"
      >
        Filtrar
      </button>

      {(banco || estado || fechaDesde || fechaHasta) && (
        <button
          onClick={limpiar}
          className="h-9 px-4 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
