'use client';

import { useEffect, useState } from 'react';
import { cn, cardCls, tableCls, theadRowCls, thCls, thNumCls, tdCls, tdNumCls, metaCls, errorCls } from '@/lib/ui';

interface Fila { proveedor_id: string | null; proveedor: string; impago: number; a_cuenta: number; neto: number }
interface Deuda {
  facturas_impagas: number; pagos_a_cuenta: number; a_pagar: number; a_favor: number; deuda_neta: number;
  detalle: Fila[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const money = (n: number) => (Math.round(n) === 0 ? '—' : ars.format(n));

// Deuda real con proveedores: facturas impagas menos los pagos a cuenta que
// todavía no se imputaron a ninguna factura (mismo cálculo que Flujo de Fondos).
export default function DeudaDetalle({ recargar }: { recargar: number }) {
  const [abierto, setAbierto] = useState(false);
  const [data, setData] = useState<Deuda | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
    fetch(`${API}/api/proveedores/deuda-detalle`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'No se pudo calcular la deuda');
        setData(body);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [recargar]);

  if (error) return <p role="alert" className={errorCls}>{error}</p>;
  if (!data) return <div className={cn(cardCls, 'px-4 py-3 text-sm text-kp-gray')}>Calculando deuda neta…</div>;

  return (
    <div className={cn(cardCls, 'overflow-hidden')}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-left hover:bg-kp-surface2/60 transition-colors"
      >
        <div>
          <span className="block text-xs uppercase tracking-widest text-kp-gray">Deuda neta (descontando pagos a cuenta)</span>
          <span className="text-lg font-bold tabular-nums text-kp-red">{money(data.deuda_neta)}</span>
        </div>
        <div className="text-sm text-kp-gray tabular-nums">
          Facturas impagas {money(data.facturas_impagas)} − pagos a cuenta sin imputar {money(data.pagos_a_cuenta)}
        </div>
        <div className="text-sm tabular-nums">
          <span className="text-kp-red">Debés {money(data.a_pagar)}</span>
          <span className="text-kp-gray"> · </span>
          <span className="text-green-400">a favor {money(data.a_favor)}</span>
        </div>
        <span className="ml-auto text-xs font-semibold text-kp-gray">{abierto ? 'Ocultar detalle ▲' : 'Ver detalle por proveedor ▼'}</span>
      </button>

      {abierto && (
        <>
          <div className="overflow-x-auto border-t border-kp-border">
            <table className={tableCls}>
              <thead>
                <tr className={theadRowCls}>
                  <th className={cn(thCls, 'min-w-[200px]')}>Proveedor</th>
                  <th className={thNumCls}>Facturas impagas</th>
                  <th className={thNumCls}>Pagado a cuenta sin imputar</th>
                  <th className={thNumCls}>Neto</th>
                </tr>
              </thead>
              <tbody>
                {data.detalle.map((p) => (
                  <tr key={p.proveedor_id ?? p.proveedor} className="border-t border-kp-border/50">
                    <td className={cn(tdCls, 'py-2')}>{p.proveedor}</td>
                    <td className={cn(tdNumCls, 'py-2 whitespace-nowrap')}>{money(p.impago)}</td>
                    <td className={cn(tdNumCls, 'py-2 whitespace-nowrap text-kp-gray')}>{money(p.a_cuenta)}</td>
                    <td className={cn(tdNumCls, 'py-2 whitespace-nowrap font-semibold',
                      p.neto > 0.5 ? 'text-kp-red' : p.neto < -0.5 ? 'text-green-400' : 'text-kp-gray')}>
                      {p.neto < -0.5 ? `a favor ${money(-p.neto)}` : money(p.neto)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-kp-border bg-kp-surface2 font-bold">
                  <td className={cn(tdCls, 'py-2')}>Deuda neta</td>
                  <td className={cn(tdNumCls, 'py-2 whitespace-nowrap')}>{money(data.facturas_impagas)}</td>
                  <td className={cn(tdNumCls, 'py-2 whitespace-nowrap')}>{money(data.pagos_a_cuenta)}</td>
                  <td className={cn(tdNumCls, 'py-2 whitespace-nowrap text-kp-red')}>{money(data.deuda_neta)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={cn(metaCls, 'px-4 py-3')}>
            Neto positivo = lo que se le debe; negativo = saldo a favor (se le pagó de más o por adelantado).
            Imputando los pagos a cuenta desde Pago a Proveedores, las facturas dejan de figurar impagas y este detalle coincide con la cuenta corriente.
          </p>
        </>
      )}
    </div>
  );
}
