'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FiltrosEstadoResultados({
  fechaDesde, fechaHasta,
}: { fechaDesde: string; fechaHasta: string }) {
  const router = useRouter();
  const [desde, setDesde] = useState(fechaDesde);
  const [hasta, setHasta] = useState(fechaHasta);

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams({ tab: 'er' });
    if (desde) p.set('fecha_desde', desde);
    if (hasta) p.set('fecha_hasta', hasta);
    router.push(`/reportes?${p}`);
  }

  function setPreset(tipo: 'mes' | 'mes_ant' | 'trim' | 'anio') {
    const hoy = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (tipo === 'mes') {
      setDesde(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`);
      setHasta(iso(new Date(hoy.getFullYear(), hoy.getMonth()+1, 0)));
    } else if (tipo === 'mes_ant') {
      setDesde(iso(new Date(hoy.getFullYear(), hoy.getMonth()-1, 1)));
      setHasta(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)));
    } else if (tipo === 'trim') {
      const q = Math.floor(hoy.getMonth() / 3);
      setDesde(iso(new Date(hoy.getFullYear(), q * 3, 1)));
      setHasta(iso(new Date(hoy.getFullYear(), q * 3 + 3, 0)));
    } else {
      setDesde(`${hoy.getFullYear()}-01-01`);
      setHasta(`${hoy.getFullYear()}-12-31`);
    }
  }

  const btnCls = "px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors";

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">Desde</label>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red [color-scheme:dark]" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">Hasta</label>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red [color-scheme:dark]" />
      </div>
      <button type="submit"
        className="px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors">
        Aplicar
      </button>
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => setPreset('mes')}      className={btnCls}>Este mes</button>
        <button type="button" onClick={() => setPreset('mes_ant')}  className={btnCls}>Mes anterior</button>
        <button type="button" onClick={() => setPreset('trim')}     className={btnCls}>Trimestre</button>
        <button type="button" onClick={() => setPreset('anio')}     className={btnCls}>Este año</button>
      </div>
    </form>
  );
}
