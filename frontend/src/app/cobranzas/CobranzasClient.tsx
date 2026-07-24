'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import RegistrarPago from '../clientes/[id]/RegistrarPago';

export interface ClienteCobranza {
  id: string;
  razon_social: string;
  cuit: string | null;
  telefono: string | null;
  saldo_actual: string;
  lista_precio: string | null;
}

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3,
});

// Normaliza para buscar sin depender de tildes ni mayúsculas.
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function CobranzasClient({
  clientes,
  sucursalId,
}: {
  clientes: ClienteCobranza[];
  sucursalId?: string;
}) {
  const [q, setQ] = useState('');
  const [soloDeuda, setSoloDeuda] = useState(false);

  const filtrados = useMemo(() => {
    const term = norm(q.trim());
    return clientes
      .filter(c => (soloDeuda ? parseFloat(c.saldo_actual || '0') > 0 : true))
      .filter(c =>
        !term ||
        norm(c.razon_social).includes(term) ||
        (c.cuit ?? '').includes(term),
      )
      // Primero los que deben, de mayor a menor: es a quienes se les cobra.
      .sort((a, b) => parseFloat(b.saldo_actual || '0') - parseFloat(a.saldo_actual || '0'));
  }, [clientes, q, soloDeuda]);

  const totalDeuda = useMemo(
    () => clientes.reduce((acc, c) => acc + Math.max(parseFloat(c.saldo_actual || '0'), 0), 0),
    [clientes],
  );

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-green-500 rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Cobranzas</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            Buscá al cliente y registrá el pago que trae al mostrador.
          </p>
        </div>
        <div className="rounded-xl border border-kp-border bg-kp-surface px-4 py-2">
          <p className="text-[10px] text-kp-gray uppercase tracking-widest">Deuda total</p>
          <p className="text-lg font-bold tabular-nums text-amber-400">{ars.format(totalDeuda)}</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre o CUIT…"
          autoFocus
          className="flex-1 bg-kp-surface2 border border-kp-border rounded-lg px-4 py-2.5 text-sm text-kp-white
            placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setSoloDeuda(v => !v)}
          className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
            soloDeuda
              ? 'border-green-500 bg-green-500/10 text-green-300'
              : 'border-kp-border bg-kp-surface2 text-kp-gray hover:text-kp-white hover:border-kp-gray'
          }`}
        >
          Sólo con deuda
        </button>
      </div>

      {/* Listado */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">CUIT</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Saldo</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {filtrados.map(c => {
              const saldo = parseFloat(c.saldo_actual || '0');
              return (
                <tr key={c.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-kp-white hover:text-green-400 transition-colors">
                      {c.razon_social}
                    </Link>
                    {c.telefono && <p className="text-[11px] text-kp-gray">{c.telefono}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">{c.cuit || '—'}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-bold whitespace-nowrap ${
                    saldo > 0 ? 'text-amber-400' : saldo < 0 ? 'text-green-400' : 'text-kp-gray'
                  }`}>
                    {ars.format(saldo)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <RegistrarPago clienteId={c.id} saldoActual={saldo} sucursalId={sucursalId} />
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-kp-gray">
                  {q ? 'Ningún cliente coincide con la búsqueda.' : 'No hay clientes para mostrar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-kp-gray">
        Mostrando {filtrados.length} de {clientes.length} clientes activos.
      </p>
    </section>
  );
}
