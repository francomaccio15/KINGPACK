'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function FiltroFecha({ fecha }: { fecha: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const setFecha = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set('fecha', value);
    else params.delete('fecha');
    router.push(`/pago-clientes?${params.toString()}`);
  };

  const inputCls = 'bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-semibold uppercase tracking-widest text-kp-gray">Día</label>
      <input
        type="date"
        value={fecha}
        onChange={e => setFecha(e.target.value)}
        className={`${inputCls} w-44`}
      />
    </div>
  );
}
