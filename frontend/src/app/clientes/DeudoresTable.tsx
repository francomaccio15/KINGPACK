'use client';

import Link from 'next/link';

type Cliente = {
  id: string;
  razon_social: string;
  cuit: string | null;
  lista_precio: string | null;
  limite_credito: string;
  saldo_actual: string;
  plazo_dias: number | null;
  fecha_vencimiento: string | null;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

function estadoVencimiento(fechaStr: string | null): {
  label: string;
  className: string;
} {
  if (!fechaStr) return { label: 'Sin fecha', className: 'text-kp-gray' };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vto = new Date(fechaStr);
  vto.setHours(0, 0, 0, 0);
  const dias = Math.round((vto.getTime() - hoy.getTime()) / 86400000);

  if (dias < 0)  return { label: `Vencido hace ${Math.abs(dias)}d`, className: 'text-kp-red font-semibold' };
  if (dias === 0) return { label: 'Vence hoy',                       className: 'text-amber-400 font-semibold' };
  if (dias <= 7)  return { label: `Vence en ${dias}d`,               className: 'text-amber-400' };
  return {
    label: new Date(fechaStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    className: 'text-kp-gray-lt',
  };
}

export default function DeudoresTable({ clientes }: { clientes: Cliente[] }) {
  const deudores = clientes
    .filter(c => parseFloat(c.saldo_actual || '0') > 0)
    .sort((a, b) => parseFloat(b.saldo_actual) - parseFloat(a.saldo_actual));

  if (deudores.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface py-16 flex flex-col items-center gap-3">
        <svg className="w-10 h-10 text-green-500/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-kp-gray text-sm">No hay clientes con deuda pendiente.</p>
      </div>
    );
  }

  const totalDeuda = deudores.reduce((s, c) => s + parseFloat(c.saldo_actual || '0'), 0);

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-kp-gray">
          <span className="text-kp-white font-semibold">{deudores.length}</span> clientes con deuda
        </p>
        <p className="text-sm text-kp-gray">
          Total: <span className="text-kp-red font-bold tabular-nums">{fmt(totalDeuda)}</span>
        </p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">#</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Razón Social</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">CUIT</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Lista</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Límite</th>
              <th className="text-right px-4 py-3 uppercase tracking-widest text-xs font-semibold whitespace-nowrap">
                <span className="text-kp-red">Deuda</span>
              </th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Plazo</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Vencimiento</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {deudores.map((c, i) => {
              const saldo   = parseFloat(c.saldo_actual || '0');
              const limite  = parseFloat(c.limite_credito || '0');
              const excede  = limite > 0 && saldo > limite;
              const vto     = estadoVencimiento(c.fecha_vencimiento);

              return (
                <tr key={c.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 text-xs text-kp-border tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors">
                    {c.razon_social}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">{c.cuit || '—'}</td>
                  <td className="px-4 py-3">
                    {c.lista_precio
                      ? <span className="text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray-lt">{c.lista_precio}</span>
                      : <span className="text-xs text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-kp-gray">{fmt(c.limite_credito)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    <span className={`inline-flex items-center gap-1.5 ${excede ? 'text-kp-red' : 'text-amber-400'}`}>
                      {excede && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      )}
                      {fmt(saldo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-kp-gray tabular-nums">
                    {c.plazo_dias ? `${c.plazo_dias}d` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    <span className={vto.className}>{vto.label}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Link href={`/clientes/${c.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1
                        text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent
                        hover:border-kp-border hover:bg-kp-surface2">
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
