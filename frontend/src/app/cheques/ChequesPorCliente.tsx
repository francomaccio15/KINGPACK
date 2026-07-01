'use client';

import { useState } from 'react';
import Link from 'next/link';
import CambiarEstado from './CambiarEstado';

interface ChequeDetalle {
  id: string;
  banco: string;
  numero_cheque: string;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  importe: string;
  estado: string;
  fecha_estado: string | null;
  venta_numero: number;
  venta_id: string;
  vencido: boolean;
}

interface ClienteCheques {
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cantidad: string;
  total: string;
  en_cartera: string;
  depositado: string;
  acreditado: string;
  rechazado: string;
  rechazado_cant: string;
  vencidos_cant: string;
  cheques: ChequeDetalle[];
}

const BADGE: Record<string, string> = {
  en_cartera: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  depositado:  'bg-purple-900/50 text-purple-300 border-purple-700/50',
  acreditado:  'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  endosado:    'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
  rechazado:   'bg-red-900/50 text-red-300 border-red-700/50',
  anulado:     'bg-zinc-800 text-zinc-400 border-zinc-600',
};

const LABEL_ESTADO: Record<string, string> = {
  en_cartera: 'En Cartera', depositado: 'Depositado', acreditado: 'Acreditado',
  endosado: 'Endosado', rechazado: 'Rechazado', anulado: 'Anulado',
};

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  // Puede venir como 'YYYY-MM-DD' o ISO completo; tomamos solo la fecha.
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

function FilaCliente({ c }: { c: ClienteCheques }) {
  const [abierto, setAbierto] = useState(false);
  const enCartera = parseFloat(c.en_cartera);
  const rechazado = parseFloat(c.rechazado);
  const vencidos  = parseInt(c.vencidos_cant);
  const hayCritico = rechazado > 0 || vencidos > 0;

  return (
    <>
      {/* Fila resumen del cliente */}
      <tr
        className={[
          'cursor-pointer transition-colors border-b border-kp-border',
          hayCritico ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-kp-surface2',
          abierto ? 'bg-kp-surface2' : '',
        ].join(' ')}
        onClick={() => setAbierto(a => !a)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`w-3.5 h-3.5 text-kp-gray transition-transform ${abierto ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div>
              <p className="font-semibold text-kp-white text-sm">{c.cliente_nombre}</p>
              {c.cliente_telefono && (
                <p className="text-xs text-kp-gray">{c.cliente_telefono}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-kp-white">
          {fmt(c.total)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm">
          <span className={enCartera > 0 ? 'text-blue-300 font-semibold' : 'text-kp-gray'}>
            {fmt(c.en_cartera)}
          </span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm">
          <span className={parseFloat(c.acreditado) > 0 ? 'text-emerald-400 font-semibold' : 'text-kp-gray'}>
            {fmt(c.acreditado)}
          </span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm">
          {rechazado > 0 ? (
            <span className="text-red-400 font-bold">{fmt(c.rechazado)}</span>
          ) : (
            <span className="text-kp-gray">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            {vencidos > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded border bg-amber-900/30 text-amber-300 border-amber-700/40">
                {vencidos} vencido{vencidos > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-kp-gray">{c.cantidad} cheque{parseInt(c.cantidad) > 1 ? 's' : ''}</span>
          </div>
        </td>
      </tr>

      {/* Detalle de cheques del cliente */}
      {abierto && (
        <tr>
          <td colSpan={6} className="bg-kp-surface2/50 border-b border-kp-border px-0 py-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-kp-border/60">
                  <th className="px-8 py-2 text-left text-kp-gray uppercase tracking-wide font-semibold">Banco / N°</th>
                  <th className="px-4 py-2 text-left text-kp-gray uppercase tracking-wide font-semibold">Emisión</th>
                  <th className="px-4 py-2 text-left text-kp-gray uppercase tracking-wide font-semibold">Vencimiento</th>
                  <th className="px-4 py-2 text-right text-kp-gray uppercase tracking-wide font-semibold">Importe</th>
                  <th className="px-4 py-2 text-left text-kp-gray uppercase tracking-wide font-semibold">Estado</th>
                  <th className="px-4 py-2 text-left text-kp-gray uppercase tracking-wide font-semibold">Venta</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-kp-border/40">
                {c.cheques.map(ch => (
                  <tr
                    key={ch.id}
                    className={[
                      'transition-colors',
                      ch.estado === 'rechazado' ? 'bg-red-950/20' : ch.vencido ? 'bg-amber-950/20' : '',
                    ].join(' ')}
                  >
                    <td className="px-8 py-2.5">
                      <p className="font-medium text-kp-white">{ch.banco}</p>
                      <p className="font-mono text-kp-gray">{ch.numero_cheque}</p>
                    </td>
                    <td className="px-4 py-2.5 text-kp-gray">{fmtFecha(ch.fecha_emision)}</td>
                    <td className="px-4 py-2.5">
                      <span className={ch.vencido ? 'text-amber-400 font-semibold' : ch.estado === 'rechazado' ? 'text-red-400' : 'text-kp-white'}>
                        {fmtFecha(ch.fecha_vencimiento)}
                      </span>
                      {ch.vencido && <p className="text-amber-400/70">Vencido</p>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-kp-white">
                      {fmt(ch.importe)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded border font-semibold ${BADGE[ch.estado] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600'}`}>
                        {LABEL_ESTADO[ch.estado] ?? ch.estado}
                      </span>
                      {ch.fecha_estado && <p className="text-kp-gray mt-0.5">{fmtFecha(ch.fecha_estado)}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/ventas/${ch.venta_id}`}
                        className="text-kp-red hover:text-red-400 font-semibold"
                        onClick={e => e.stopPropagation()}
                      >
                        #{ch.venta_numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                      <CambiarEstado chequeId={ch.id} tipo="recibido" estadoActual={ch.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ChequesPorCliente({ clientes }: { clientes: ClienteCheques[] }) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
        No hay cheques recibidos registrados.
      </div>
    );
  }

  const totalGeneral    = clientes.reduce((s, c) => s + parseFloat(c.total), 0);
  const enCarteraTotal  = clientes.reduce((s, c) => s + parseFloat(c.en_cartera), 0);
  const acreditadoTotal = clientes.reduce((s, c) => s + parseFloat(c.acreditado), 0);
  const rechazadoTotal  = clientes.reduce((s, c) => s + parseFloat(c.rechazado), 0);

  return (
    <div className="space-y-4">
      {/* Totales rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total registrado', value: fmt(totalGeneral),    cls: 'text-kp-white' },
          { label: 'En cartera',       value: fmt(enCarteraTotal),  cls: 'text-blue-300' },
          { label: 'Acreditado',       value: fmt(acreditadoTotal), cls: 'text-emerald-400' },
          { label: 'Rechazado',        value: fmt(rechazadoTotal),  cls: rechazadoTotal > 0 ? 'text-red-400 font-bold' : 'text-kp-gray' },
        ].map(card => (
          <div key={card.label} className="bg-kp-surface border border-kp-border rounded-xl p-4">
            <p className="text-xs text-kp-gray uppercase tracking-wide font-semibold mb-1">{card.label}</p>
            <p className={`text-xl font-bold tabular-nums ${card.cls}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla por cliente */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-kp-surface2 text-kp-gray text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">En Cartera</th>
              <th className="px-4 py-3 text-right font-semibold">Acreditado</th>
              <th className="px-4 py-3 text-right font-semibold">Rechazado</th>
              <th className="px-4 py-3 text-center font-semibold">Info</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <FilaCliente key={c.cliente_id} c={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
