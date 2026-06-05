'use client';

import CambiarEstado from './CambiarEstado';

interface Cheque {
  tipo:              'recibido' | 'emitido';
  id:                string;
  banco:             string;
  numero_cheque:     string;
  fecha_emision:     string | null;
  fecha_vencimiento: string;
  importe:           string;
  estado:            string;
  fecha_estado:      string | null;
  observaciones:     string | null;
  origen_nombre:     string;
  sucursal_nombre:   string;
  vencido:           boolean;
}

const BADGE: Record<string, string> = {
  en_cartera:  'bg-blue-900/50 text-blue-300 border-blue-700/50',
  depositado:  'bg-purple-900/50 text-purple-300 border-purple-700/50',
  acreditado:  'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  endosado:    'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
  rechazado:   'bg-red-900/50 text-red-300 border-red-700/50',
  anulado:     'bg-zinc-800 text-zinc-400 border-zinc-600',
  emitido:     'bg-blue-900/50 text-blue-300 border-blue-700/50',
  presentado:  'bg-purple-900/50 text-purple-300 border-purple-700/50',
  debitado:    'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
};

const LABEL_ESTADO: Record<string, string> = {
  en_cartera: 'En Cartera', depositado: 'Depositado', acreditado: 'Acreditado',
  endosado: 'Endosado', rechazado: 'Rechazado', anulado: 'Anulado',
  emitido: 'Emitido', presentado: 'Presentado', debitado: 'Debitado',
};

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR');
}

interface Props {
  cheques:     Cheque[];
  tipoActivo:  string;
}

export default function ChequesTabla({ cheques, tipoActivo }: Props) {
  if (cheques.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
        No hay cheques con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-kp-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-kp-surface2 text-kp-gray text-xs uppercase tracking-wide">
          <tr>
            {tipoActivo === 'todos' && (
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
            )}
            <th className="px-4 py-3 text-left font-semibold">Banco / N°</th>
            <th className="px-4 py-3 text-left font-semibold">Emisión</th>
            <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
            <th className="px-4 py-3 text-right font-semibold">Importe</th>
            <th className="px-4 py-3 text-left font-semibold">Estado</th>
            <th className="px-4 py-3 text-left font-semibold">Origen</th>
            <th className="px-4 py-3 text-left font-semibold">Sucursal</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-kp-border">
          {cheques.map(c => (
            <tr
              key={`${c.tipo}-${c.id}`}
              className={[
                'hover:bg-kp-surface2 transition-colors',
                c.vencido ? 'bg-red-950/20' : '',
              ].join(' ')}
            >
              {tipoActivo === 'todos' && (
                <td className="px-4 py-3">
                  <span className={[
                    'inline-block px-2 py-0.5 text-xs font-semibold rounded border',
                    c.tipo === 'recibido'
                      ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                      : 'bg-orange-900/30 text-orange-300 border-orange-700/40',
                  ].join(' ')}>
                    {c.tipo === 'recibido' ? 'Recibido' : 'Emitido'}
                  </span>
                </td>
              )}
              <td className="px-4 py-3">
                <p className="font-medium text-kp-white">{c.banco}</p>
                <p className="text-xs text-kp-gray font-mono">{c.numero_cheque}</p>
              </td>
              <td className="px-4 py-3 text-kp-gray">{fmtFecha(c.fecha_emision)}</td>
              <td className="px-4 py-3">
                <span className={c.vencido ? 'text-red-400 font-semibold' : 'text-kp-white'}>
                  {fmtFecha(c.fecha_vencimiento)}
                </span>
                {c.vencido && <p className="text-xs text-red-400">Vencido</p>}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-kp-white">
                {fmt(c.importe)}
              </td>
              <td className="px-4 py-3">
                <span className={[
                  'inline-block px-2 py-0.5 text-xs font-semibold rounded border',
                  BADGE[c.estado] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600',
                ].join(' ')}>
                  {LABEL_ESTADO[c.estado] ?? c.estado}
                </span>
                {c.fecha_estado && (
                  <p className="text-xs text-kp-gray mt-0.5">{fmtFecha(c.fecha_estado)}</p>
                )}
              </td>
              <td className="px-4 py-3 text-kp-gray max-w-[160px] truncate">{c.origen_nombre}</td>
              <td className="px-4 py-3 text-kp-gray text-xs">{c.sucursal_nombre}</td>
              <td className="px-4 py-3 text-right">
                <CambiarEstado
                  chequeId={c.id}
                  tipo={c.tipo}
                  estadoActual={c.estado}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
